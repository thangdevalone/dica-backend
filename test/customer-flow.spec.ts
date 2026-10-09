import * as argon2 from "argon2";
import { PurgeService } from "../src/workflow/purge.service.js";
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../src/database/prisma.service.js";
import { ScopeService } from "../src/auth/scope.service.js";
import type { AuthUser } from "../src/auth/auth.types.js";
import {
  SYSTEM_PERMISSIONS,
  SYSTEM_ROLE_PERMISSIONS,
} from "../src/auth/access-control.catalog.js";
import { IdempotencyService } from "../src/common/idempotency/idempotency.service.js";
import { PaginationDto } from "../src/common/dto/pagination.dto.js";
import { InventoryService } from "../src/inventory/inventory.service.js";
import { NotificationListQueryDto } from "../src/inventory/inventory.dto.js";
import { DeliveryService } from "../src/delivery/delivery.service.js";
import { OrderService } from "../src/orders/order.service.js";
import { OperationService } from "../src/operations/operation.service.js";
import { ReportingService } from "../src/reporting/reporting.service.js";
import { IposService } from "../src/ipos/ipos.service.js";
import { TransferService } from "../src/transfers/transfer.service.js";
import { RequestService } from "../src/requests/request.service.js";
import { WorkflowService } from "../src/workflow/workflow.service.js";
import { WorkflowWorker } from "../src/workflow/workflow.worker.js";
import type { PushService } from "../src/push/push.service.js";
import type { R2StorageService } from "../src/attachments/r2-storage.service.js";
import { endOfBusinessDay } from "../src/common/utils/business-day.js";
import { visibleResponse } from "../src/common/utils/response-visibility.js";
import { Prisma } from "../src/generated/prisma/client.js";

test("midnight uses Vietnam business day including UTC date boundary", () => {
  assert.equal(
    endOfBusinessDay(new Date("2026-10-09T16:59:59Z")).toISOString(),
    "2026-10-09T17:00:00.000Z",
  );
  assert.equal(
    endOfBusinessDay(new Date("2026-10-09T17:00:00Z")).toISOString(),
    "2026-10-10T17:00:00.000Z",
  );
});

test("staff cannot cancel documents or read system stock by default", () => {
  for (const role of ["BRANCH_STAFF", "WAREHOUSE_STAFF"]) {
    for (const permission of [
      "request.cancel",
      "transfer.cancel",
      "stock.read",
      "stock_ledger.read",
      "price.read",
      "variance.read",
    ])
      assert.equal(
        SYSTEM_ROLE_PERMISSIONS[role]?.includes(permission),
        false,
        `${role}: ${permission}`,
      );
  }
});

test("prices and stocktake variance are redacted using the resource scope", () => {
  const user = {
    kind: "INTERNAL",
    grants: [
      {
        scopeType: "FACILITY",
        facilityId: "allowed",
        permissions: ["price.read", "variance.read"],
      },
    ],
  } as AuthUser;
  const data = ["allowed", "denied"].map((facilityId) => ({
    stockLocation: { facilityId },
    lines: [
      {
        unitPriceSnapshot: "10",
        expectedQuantitySnapshot: "20",
        countedQuantity: "18",
        varianceQuantity: "-2",
      },
    ],
  }));
  const result = visibleResponse(data, user) as typeof data;
  assert.equal(result[0]!.lines[0]!.unitPriceSnapshot, "10");
  assert.equal("unitPriceSnapshot" in result[1]!.lines[0]!, false);
  assert.equal("varianceQuantity" in result[1]!.lines[0]!, false);
  assert.equal(result[1]!.lines[0]!.countedQuantity, "18");
});

test("department price grants remain scoped on request responses", () => {
  const user = {
    kind: "INTERNAL",
    grants: [
      {
        scopeType: "DEPARTMENT",
        departmentId: "allowed",
        permissions: ["price.read"],
      },
    ],
  } as AuthUser;
  const result = visibleResponse(
    ["allowed", "denied"].map((departmentId) => ({
      departmentId,
      orders: [{ lines: [{ unitPriceSnapshot: "100" }] }],
    })),
    user,
  ) as Array<{ orders: Array<{ lines: Record<string, string>[] }> }>;
  assert.equal(result[0]!.orders[0]!.lines[0]!.unitPriceSnapshot, "100");
  assert.equal("unitPriceSnapshot" in result[1]!.orders[0]!.lines[0]!, false);
});

test(
  "customer flow against PostgreSQL",
  { skip: !process.env.TEST_DATABASE_URL },
  async (t) => {
    const db = new PrismaService(
      new ConfigService({ DATABASE_URL: process.env.TEST_DATABASE_URL }),
    );
    await db.$connect();
    t.after(() => db.$disconnect());
    const scope = new ScopeService();
    const config = new ConfigService({
      NODE_ENV: "test",
      DEMO_POLICY_ENABLED: false,
    });
    const idem = new IdempotencyService(db);
    const delivery = new DeliveryService(db, scope, idem, config);
    const inventory = new InventoryService(db, scope);
    const operations = new OperationService(db, scope, config, idem);
    const orders = new OrderService(db, scope, config);
    const reporting = new ReportingService(db, scope, idem);
    const workflow = new WorkflowService(db, scope, idem);
    const transfer = new TransferService(db, scope, idem);
    const requests = new RequestService(db, scope, idem);
    const sent: string[] = [];
    const worker = new WorkflowWorker(
      db,
      config,
      {
        sendNotifications: async (rows: { id: string }[]) => {
          sent.push(...rows.map((row) => row.id));
        },
      } as PushService,
      { delete: async () => undefined } as unknown as R2StorageService,
    );
    const org = await db.organization.create({
      data: { code: `TEST-${randomUUID()}`, name: "Customer flow test" },
    });
    const employee = await db.user.create({
      data: {
        organizationId: org.id,
        username: "owner",
        displayName: "Owner",
        passwordHash: "not-a-login",
      },
    });
    const reviewer = await db.user.create({
      data: {
        organizationId: org.id,
        username: "reviewer",
        displayName: "Reviewer",
        passwordHash: "not-a-login",
      },
    });
    const user: AuthUser = {
      ...employee,
      sessionId: randomUUID(),
      requestId: randomUUID(),
      grants: [
        {
          id: randomUUID(),
          roleCode: "ADMIN_OWNER",
          scopeType: "ORGANIZATION",
          permissions: [...SYSTEM_PERMISSIONS],
          facilityId: null,
          stockLocationId: null,
          departmentId: null,
        },
      ],
    };
    const second: AuthUser = { ...user, id: reviewer.id };
    const notificationPermissions = [
      "price_alert.read",
      "payment_tracking.update",
      "payment_tracking.confirm",
      "variance.read",
    ];
    await db.permission.createMany({
      data: notificationPermissions.map((code) => ({
        code,
        description: code,
      })),
      skipDuplicates: true,
    });
    const notificationRole = await db.role.create({
      data: {
        organizationId: org.id,
        code: "TEST_RECIPIENT",
        name: "Recipient",
        permissions: {
          create: notificationPermissions.map((permissionCode) => ({
            permissionCode,
          })),
        },
      },
    });
    await db.roleGrant.create({
      data: {
        userId: user.id,
        roleId: notificationRole.id,
        scopeType: "ORGANIZATION",
      },
    });
    await db.roleGrant.create({
      data: {
        userId: second.id,
        roleId: notificationRole.id,
        scopeType: "ORGANIZATION",
      },
    });
    const branch = await db.facility.create({
      data: {
        organizationId: org.id,
        code: "BR",
        name: "Branch",
        type: "BRANCH",
      },
    });
    const kitchen = await db.facility.create({
      data: {
        organizationId: org.id,
        code: "CK",
        name: "Kitchen",
        type: "CENTRAL_KITCHEN",
      },
    });
    const central = await db.facility.create({
      data: {
        organizationId: org.id,
        code: "CW",
        name: "Warehouse",
        type: "CENTRAL_WAREHOUSE",
      },
    });
    const destination = await db.stockLocation.create({
      data: { facilityId: branch.id, code: "MAIN", name: "Branch stock" },
    });
    const source = await db.stockLocation.create({
      data: { facilityId: kitchen.id, code: "MAIN", name: "Kitchen stock" },
    });
    const warehouse = await db.stockLocation.create({
      data: { facilityId: central.id, code: "MAIN", name: "Central stock" },
    });
    await db.stockLocation.create({
      data: {
        facilityId: kitchen.id,
        code: "TRANSIT",
        name: "Transit",
        type: "IN_TRANSIT",
      },
    });
    const unit = await db.unit.create({
      data: { organizationId: org.id, code: "KG", name: "Kilogram" },
    });
    const ingredient = await db.ingredient.create({
      data: {
        organizationId: org.id,
        code: "RICE",
        name: "Rice",
        baseUnitId: unit.id,
      },
    });
    const supplier = await db.supplier.create({
      data: {
        organizationId: org.id,
        code: "SUP",
        name: "Supplier",
        phone: "0123456789",
      },
    });
    await db.supplierIngredient.create({
      data: {
        supplierId: supplier.id,
        ingredientId: ingredient.id,
        referencePrice: 100,
      },
    });
    async function order(kind: "SUPPLIER" | "STOCK" = "SUPPLIER") {
      return db.fulfillmentOrder.create({
        data: {
          organizationId: org.id,
          code: `ORD-${randomUUID()}`,
          sourceType: kind,
          destinationStockLocationId: destination.id,
          ...(kind === "SUPPLIER"
            ? { supplierId: supplier.id }
            : { sourceStockLocationId: source.id }),
          releasedAt: new Date(),
          shortageDeadlineAt: endOfBusinessDay(new Date()),
          lines: {
            create: {
              ingredientId: ingredient.id,
              approvedQuantity: 10,
              unitCodeSnapshot: "KG",
              unitPriceSnapshot: 100,
            },
          },
        },
        include: { lines: true },
      });
    }
    async function photo(resourceType: string, resourceId: string, count = 1) {
      await db.attachment.createMany({
        data: Array.from({ length: count }, () => ({
          organizationId: org.id,
          uploadedById: user.id,
          resourceType,
          resourceId,
          fileName: "proof.jpg",
          mimeType: "image/jpeg",
          sizeBytes: 1,
          content: Buffer.from([1]),
        })),
      });
    }
    async function receipt(
      o: Awaited<ReturnType<typeof order>>,
      qty: string,
      dispatchId?: string,
    ) {
      const result = await delivery.createReceipt(user, {
        order_id: o.id,
        ...(dispatchId ? { dispatch_id: dispatchId } : {}),
        lines: [{ order_line_id: o.lines[0]!.id, quantity: qty }],
      });
      await photo("RECEIPT", result.data.id);
      return result.data;
    }
    async function stock(location = destination.id) {
      return (
        (
          await db.stockBalance.findUnique({
            where: {
              stockLocationId_ingredientId: {
                stockLocationId: location,
                ingredientId: ingredient.id,
              },
            },
          })
        )?.quantity ?? new Prisma.Decimal(0)
      );
    }

    await t.test(
      "converted requests keep requested units while released orders use base units and prices",
      async () => {
        const department = await db.department.create({
          data: {
            facilityId: branch.id,
            stockLocationId: destination.id,
            code: "CONVERT",
            name: "Conversion test",
            type: "KITCHEN",
          },
        });
        const bag = await db.unit.create({
          data: { organizationId: org.id, code: "BAG", name: "Bag" },
        });
        await db.ingredientUnitConversion.create({
          data: {
            ingredientId: ingredient.id,
            unitId: bag.id,
            factorToBase: 5,
          },
        });
        await db.itemEligibility.create({
          data: {
            facilityId: branch.id,
            departmentId: department.id,
            ingredientId: ingredient.id,
          },
        });
        await db.sourceRule.create({
          data: {
            facilityId: branch.id,
            ingredientId: ingredient.id,
            sourceType: "SUPPLIER",
            supplierId: supplier.id,
          },
        });
        const req = await requests.create(user, {
          facility_id: branch.id,
          department_id: department.id,
          required_date: new Date().toISOString().slice(0, 10),
          lines: [
            { ingredient_id: ingredient.id, unit_id: bag.id, quantity: "2" },
          ],
        });
        await requests.submit(user, req.data.id, { expected_version: 1 });
        await requests.approve(
          user,
          req.data.id,
          { expected_version: 2 },
          randomUUID(),
        );
        const requestLine = await db.requestLine.findFirstOrThrow({
          where: { requestId: req.data.id },
        });
        assert.equal(requestLine.unitCodeSnapshot, "BAG");
        assert.equal(requestLine.requestedQuantity.toString(), "2");
        const o = await db.fulfillmentOrder.findFirstOrThrow({
          where: { requestId: req.data.id },
          include: { lines: true },
        });
        assert.equal(o.lines[0]!.unitCodeSnapshot, "KG");
        assert.equal(o.lines[0]!.approvedQuantity.toString(), "10");
        const r = await receipt(o, "10");
        await delivery.postReceipt(
          user,
          r.id,
          { expected_version: 1 },
          randomUUID(),
        );
        assert.equal(
          (await reporting.payment(user, o.id)).data.reconciledValue,
          "1000.0000",
        );
      },
    );

    await t.test(
      "all receipts require 1–10 images; excess increments stock and value once",
      async () => {
        const o = await order();
        const r = await delivery.createReceipt(user, {
          order_id: o.id,
          lines: [{ order_line_id: o.lines[0]!.id, quantity: "12" }],
        });
        await assert.rejects(
          delivery.postReceipt(
            user,
            r.data.id,
            { expected_version: 1 },
            randomUUID(),
          ),
        );
        await photo("RECEIPT", r.data.id, 11);
        await assert.rejects(
          delivery.postReceipt(
            user,
            r.data.id,
            { expected_version: 1 },
            randomUUID(),
          ),
        );
        const extra = await db.attachment.findFirstOrThrow({
          where: { resourceId: r.data.id },
        });
        await db.attachment.delete({ where: { id: extra.id } });
        const before = await stock();
        const key = randomUUID();
        await delivery.postReceipt(
          user,
          r.data.id,
          { expected_version: 1 },
          key,
        );
        await delivery.postReceipt(
          user,
          r.data.id,
          { expected_version: 1 },
          key,
        );
        assert.equal((await stock()).sub(before).toString(), "12");
        const line = await db.fulfillmentLine.findUniqueOrThrow({
          where: { id: o.lines[0]!.id },
        });
        assert.equal(line.receivedQuantity.toString(), "10");
        assert.equal(line.acceptedExcessQuantity.toString(), "2");
        assert.equal(
          (await reporting.payment(user, o.id)).data.reconciledValue,
          "1200.0000",
        );
        await assert.rejects(
          orders.cancel(user, o.id, {
            expected_version: 2,
            reason: "cannot cancel after receipt",
          }),
        );
      },
    );

    await t.test(
      "multiple make-up deliveries are accepted before midnight, then missing quantity closes",
      async () => {
        const o = await order();
        for (const quantity of ["3", "2", "1"]) {
          const r = await receipt(o, quantity);
          await delivery.postReceipt(
            user,
            r.id,
            { expected_version: 1 },
            randomUUID(),
          );
        }
        const deadline = new Date(Date.now() - 1000);
        await db.fulfillmentOrder.update({
          where: { id: o.id },
          data: { shortageDeadlineAt: deadline },
        });
        const late = await receipt(o, "4");
        await assert.rejects(
          delivery.postReceipt(
            user,
            late.id,
            { expected_version: 1 },
            randomUUID(),
          ),
        );
        const before = await stock();
        await worker.closeShortages(new Date());
        await worker.closeShortages(new Date());
        const closed = await db.fulfillmentOrder.findUniqueOrThrow({
          where: { id: o.id },
          include: { lines: true },
        });
        assert.equal(closed.status, "CLOSED");
        assert.equal(closed.lines[0]!.closedRemainingQuantity.toString(), "4");
        assert.equal((await stock()).toString(), before.toString());
        assert.equal(
          (await reporting.payment(user, o.id)).data.reconciledValue,
          "600.0000",
        );
      },
    );

    await t.test(
      "dispatch supports negative stock and cancellation reverses transit before receiving",
      async () => {
        const o = await order("STOCK");
        const d = await delivery.createDispatch(user, {
          order_id: o.id,
          lines: [{ order_line_id: o.lines[0]!.id, quantity: "10" }],
        });
        const before = await stock(source.id);
        await delivery.postDispatch(
          user,
          d.data.id,
          { expected_version: 1 },
          randomUUID(),
        );
        assert.equal((await stock(source.id)).sub(before).toString(), "-10");
        await orders.cancel(user, o.id, {
          expected_version: 2,
          reason: "Create replacement request",
        });
        assert.equal((await stock(source.id)).toString(), before.toString());
        await assert.rejects(
          delivery.postDispatch(
            user,
            d.data.id,
            { expected_version: 2 },
            randomUUID(),
          ),
        );
      },
    );

    await t.test(
      "transfer routes and arrival window are enforced",
      async () => {
        const dto = {
          from_stock_location_id: warehouse.id,
          to_stock_location_id: destination.id,
          expected_arrival_at: new Date().toISOString(),
          expected_arrival_end_at: new Date(Date.now() + 3600000).toISOString(),
          lines: [
            { ingredient_id: ingredient.id, unit_id: unit.id, quantity: "1" },
          ],
        };
        await assert.rejects(transfer.create(user, dto));
        await assert.rejects(
          transfer.create(user, {
            ...dto,
            to_stock_location_id: source.id,
            expected_arrival_end_at: dto.expected_arrival_at,
          }),
        );
        const centralTransfer = await transfer.create(user, {
          ...dto,
          to_stock_location_id: source.id,
        });
        assert.equal(
          (
            await transfer.submit(user, centralTransfer.data.id, {
              expected_version: 1,
            })
          ).data.status,
          "APPROVED",
        );
        const normal = await transfer.create(user, {
          ...dto,
          from_stock_location_id: source.id,
        });
        assert.equal(
          (await transfer.submit(user, normal.data.id, { expected_version: 1 }))
            .data.status,
          "SUBMITTED",
        );
      },
    );

    await t.test(
      "damage deducts at report once and confirmation does not deduct again",
      async () => {
        const d = await operations.createDamage(user, {
          stock_location_id: destination.id,
          reason: "Damaged during inspection",
          lines: [{ ingredient_id: ingredient.id, quantity: "2" }],
        });
        await assert.rejects(
          operations.submitDamage(user, d.data.id, { expected_version: 1 }),
        );
        await photo("DAMAGE_REPORT", d.data.id);
        const before = await stock();
        await operations.submitDamage(user, d.data.id, { expected_version: 1 });
        await assert.rejects(
          operations.submitDamage(user, d.data.id, { expected_version: 1 }),
        );
        await operations.confirmDamage(user, d.data.id, {
          expected_version: 2,
        });
        assert.equal((await stock()).sub(before).toString(), "-2");
      },
    );

    await t.test(
      "approved partial returns settle once at day end and reduce invoice",
      async () => {
        const o = await order();
        const r = await receipt(o, "10");
        await delivery.postReceipt(
          user,
          r.id,
          { expected_version: 1 },
          randomUUID(),
        );
        const ret = await workflow.createReturn(user, {
          order_id: o.id,
          note: "Return damaged packaging",
          lines: [{ order_line_id: o.lines[0]!.id, quantity: "3" }],
        });
        await photo("RETURN", ret.data.id);
        await workflow.returnCommand(
          user,
          ret.data.id,
          { expected_version: 1 },
          "SUBMITTED",
        );
        await workflow.returnCommand(
          user,
          ret.data.id,
          { expected_version: 2 },
          "APPROVED",
        );
        const list = await workflow.returns(user, new PaginationDto());
        assert.equal(
          list.data.find((row) => row.id === ret.data.id)?.order
            .destinationStockLocation.facilityId,
          branch.id,
        );
        const before = await stock();
        await worker.settleReturns(new Date());
        assert.equal((await stock()).toString(), before.toString());
        const end = endOfBusinessDay(new Date());
        await worker.settleReturns(end);
        await worker.settleReturns(end);
        assert.equal((await stock()).sub(before).toString(), "-3");
        assert.equal(
          (await reporting.payment(user, o.id)).data.reconciledValue,
          "700.0000",
        );
      },
    );

    await t.test(
      "payment separation requires a different confirmer; prices persist for next order",
      async () => {
        const o = await order();
        const r = await receipt(o, "10");
        await delivery.postReceipt(
          user,
          r.id,
          { expected_version: 1 },
          randomUUID(),
        );
        await workflow.updatePolicy(user, {
          payment_approval_required: true,
          attachment_retention_months: 12,
        });
        await workflow.updateRule(user, {
          ingredient_id: ingredient.id,
          base_price: "100",
          tolerance_percent: "10",
        });
        await workflow.prices(
          user,
          o.id,
          {
            expected_version: 2,
            payment_term_days: 7,
            lines: [{ order_line_id: o.lines[0]!.id, unit_price: "120" }],
          },
          randomUUID(),
        );
        assert.equal(
          await db.notification.count({
            where: {
              resourceId: o.id,
              title: "Đơn giá vượt ngưỡng",
              userId: user.id,
            },
          }),
          1,
        );
        assert.equal(
          (
            await db.supplierIngredient.findFirstOrThrow({
              where: { supplierId: supplier.id },
            })
          ).referencePrice?.toString(),
          "120",
        );
        const result = await reporting.updatePayment(
          user,
          o.id,
          { expected_version: 0, paid_value: "1200" },
          randomUUID(),
        );
        assert.equal(result.data.paidValue, "0");
        assert.equal(result.data.pendingPaidValue, "1200");
        assert.equal(
          await db.notification.count({
            where: {
              resourceId: o.id,
              title: "Thanh toán chờ xác nhận",
              userId: second.id,
            },
          }),
          1,
        );
        assert.equal(
          await db.notification.count({
            where: {
              resourceId: o.id,
              title: "Thanh toán chờ xác nhận",
              userId: user.id,
            },
          }),
          0,
        );
        const scoped = {
          ...user,
          grants: [
            {
              ...user.grants[0]!,
              scopeType: "FACILITY" as const,
              facilityId: branch.id,
            },
          ],
        };
        const pending = (await reporting.payment(scoped, o.id)).data;
        assert.equal(pending.paymentApprovalRequired, true);
        assert.equal(pending.updatedById, user.id);
        assert.equal(
          (visibleResponse(pending, scoped) as typeof pending).pendingPaidValue,
          "1200.0000",
        );
        await assert.rejects(
          workflow.confirmPayment(
            user,
            o.id,
            { expected_version: 1 },
            randomUUID(),
          ),
        );
        const confirmKey = randomUUID();
        await workflow.confirmPayment(
          second,
          o.id,
          { expected_version: 1 },
          confirmKey,
        );
        await workflow.confirmPayment(
          second,
          o.id,
          { expected_version: 1 },
          confirmKey,
        );
        const confirmed = (await reporting.payment(user, o.id)).data;
        assert.equal(confirmed.status, "PAID");
        assert.equal(confirmed.confirmedById, second.id);
        assert.equal(
          await db.notification.count({
            where: {
              resourceId: o.id,
              title: "Thanh toán đã được xác nhận",
              userId: user.id,
            },
          }),
          1,
        );
      },
    );

    await t.test(
      "rejected returns expose the reason and notify the requester without posting stock",
      async () => {
        const o = await order();
        const r = await receipt(o, "5");
        await delivery.postReceipt(
          user,
          r.id,
          { expected_version: 1 },
          randomUUID(),
        );
        const ret = await workflow.createReturn(user, {
          order_id: o.id,
          note: "Return one unit",
          lines: [{ order_line_id: o.lines[0]!.id, quantity: "1" }],
        });
        await photo("RETURN", ret.data.id);
        await workflow.returnCommand(
          user,
          ret.data.id,
          { expected_version: 1 },
          "SUBMITTED",
        );
        const before = await stock();
        await workflow.returnCommand(
          second,
          ret.data.id,
          { expected_version: 2, note: "  Keep the goods  " },
          "REJECTED",
        );
        const rejected = (await workflow.returnDetail(user, ret.data.id)).data;
        assert.equal(rejected.note, "Return one unit");
        assert.equal(rejected.decisionNote, "Keep the goods");
        assert.equal(rejected.postedAt, null);
        const alert = await db.notification.findFirstOrThrow({
          where: {
            resourceId: ret.data.id,
            userId: user.id,
            title: "Phiếu hoàn bị từ chối",
          },
        });
        assert.ok(
          (
            await inventory.notifications(user, new NotificationListQueryDto())
          ).data.some((row) => row.id === alert.id),
        );
        assert.equal(
          (await inventory.notification(user, alert.id)).data.message.includes(
            "Keep the goods",
          ),
          true,
        );
        const revoked = {
          ...user,
          grants: user.grants.map((grant) => ({
            ...grant,
            permissions: grant.permissions.filter(
              (permission) => permission !== "return.read",
            ),
          })),
        };
        await assert.rejects(inventory.markNotificationRead(revoked, alert.id));
        assert.deepEqual(
          await inventory.readableNotificationIds(revoked, [alert.id]),
          [],
        );
        await inventory.markNotificationRead(user, alert.id);
        assert.deepEqual(
          await inventory.readableNotificationIds(user, [alert.id]),
          [],
        );
        assert.equal((await stock()).toString(), before.toString());
        assert.equal(
          await db.notification.count({
            where: {
              resourceId: ret.data.id,
              userId: user.id,
              title: "Phiếu hoàn bị từ chối",
              message: { contains: "Keep the goods" },
            },
          }),
          1,
        );
      },
    );

    await t.test(
      "unread reminders repeat hourly and stop on read",
      async () => {
        const now = new Date();
        const n = await db.notification.create({
          data: {
            organizationId: org.id,
            userId: user.id,
            title: "Test reminder",
            message: "Message",
            resourceType: "Test",
            resourceId: randomUUID(),
            lastRemindedAt: new Date(now.getTime() - 3600001),
          },
        });
        await worker.remind(now);
        await worker.remind(now);
        assert.equal(sent.filter((id) => id === n.id).length, 1);
        await worker.remind(new Date(now.getTime() + 3600000));
        assert.equal(sent.filter((id) => id === n.id).length, 2);
        await db.notification.update({
          where: { id: n.id },
          data: { status: "READ", readAt: now },
        });
        await worker.remind(new Date(now.getTime() + 7200000));
        assert.equal(sent.filter((id) => id === n.id).length, 2);
      },
    );

    await t.test("rejected requests remain immutable", async () => {
      const department = await db.department.create({
        data: {
          facilityId: branch.id,
          stockLocationId: destination.id,
          code: "K",
          name: "Kitchen",
          type: "KITCHEN",
        },
      });
      const req = await db.supplyRequest.create({
        data: {
          organizationId: org.id,
          facilityId: branch.id,
          departmentId: department.id,
          createdById: user.id,
          code: `REQ-${randomUUID()}`,
          requiredDate: new Date(),
          status: "REJECTED",
        },
      });
      await assert.rejects(
        requests.revise(user, req.id, {
          expected_version: 1,
          facility_id: branch.id,
          department_id: department.id,
          required_date: "2026-10-09",
          lines: [
            { ingredient_id: ingredient.id, unit_id: unit.id, quantity: "1" },
          ],
        }),
      );
      assert.equal(
        (await db.supplyRequest.findUniqueOrThrow({ where: { id: req.id } }))
          .status,
        "REJECTED",
      );
    });
    await t.test(
      "due notifications reach records after the first page without duplicate inbox entries",
      async () => {
        const dueIds: string[] = [];
        for (let index = 0; index < 101; index++) {
          const o = await order();
          dueIds.push(o.id);
          await db.fulfillmentOrder.update({
            where: { id: o.id },
            data: {
              paymentDueAt: new Date(0),
              lines: {
                update: {
                  where: { id: o.lines[0]!.id },
                  data: { receivedQuantity: 1 },
                },
              },
            },
          });
        }
        await worker.dueNotifications(new Date());
        await worker.dueNotifications(new Date());
        assert.equal(
          await db.notification.count({
            where: {
              resourceId: { in: dueIds },
              userId: user.id,
              title: "Thanh toán quá hạn",
            },
          }),
          101,
        );
      },
    );
    await t.test(
      "stocktake audit highlights variance and sale cancellation preserves history once",
      async () => {
        const now = new Date();
        const st = await operations.createStocktake(user, {
          stock_location_id: destination.id,
          business_date: now.toISOString().slice(0, 10),
          cutoff_at: now.toISOString(),
          lines: [{ ingredient_id: ingredient.id, counted_quantity: "999" }],
        });
        await operations.submitStocktake(user, st.data.id, {
          expected_version: 1,
        });
        const audit = await db.auditEvent.findFirstOrThrow({
          where: { resourceId: st.data.id, action: "stocktake.submit" },
        });
        assert.equal(
          (audit.afterData as { highlight: string }).highlight,
          "RED",
        );
        const batch = await db.salesImportBatch.create({
          data: {
            organizationId: org.id,
            facilityId: branch.id,
            source: "TEST",
            externalKey: randomUUID(),
            createdById: user.id,
            status: "COMMITTED",
          },
        });
        const sale = await db.salesRecord.create({
          data: {
            organizationId: org.id,
            batchId: batch.id,
            source: "TEST",
            externalKey: randomUUID(),
            externalItemKey: "RICE",
            soldAt: new Date(now.getTime() - 1000),
            quantity: 2,
          },
        });
        await db.varianceResult.create({
          data: {
            organizationId: org.id,
            stocktakeId: st.data.id,
            stockLocationId: destination.id,
            ingredientId: ingredient.id,
            version: 1,
            dataStatus: "COMPLETE",
            actualClosingSnapshot: 999,
            calculatedById: user.id,
          },
        });
        const ipos = new IposService(db, scope, idem);
        const key = randomUUID();
        await ipos.cancelSale(user, sale.id, "Invoice cancelled", key);
        await ipos.cancelSale(user, sale.id, "Invoice cancelled", key);
        const cancelled = await db.salesRecord.findUniqueOrThrow({
          where: { id: sale.id },
        });
        assert.ok(cancelled.cancelledAt);
        assert.equal(cancelled.quantity.toString(), "2");
        assert.equal(
          await db.auditEvent.count({
            where: { resourceId: sale.id, action: "sales_record.cancel" },
          }),
          1,
        );
        assert.equal(
          await db.notification.count({
            where: { resourceId: sale.id, userId: user.id },
          }),
          1,
        );
        const saleAlert = await db.notification.findFirstOrThrow({
          where: { resourceId: sale.id, userId: user.id },
        });
        await inventory.markNotificationRead(user, saleAlert.id);
        const supplierAlert = await db.notification.create({
          data: {
            organizationId: org.id,
            userId: user.id,
            title: "Price alert",
            message: "Supplier price changed",
            resourceType: "Supplier",
            resourceId: supplier.id,
          },
        });
        assert.equal(
          (await inventory.notification(user, supplierAlert.id)).data.id,
          supplierAlert.id,
        );
        await inventory.markNotificationRead(user, supplierAlert.id);
        assert.equal(
          (
            await db.varianceResult.findFirstOrThrow({
              where: { stocktakeId: st.data.id },
            })
          ).dataStatus,
          "DATA_INCOMPLETE",
        );
      },
    );
    await t.test(
      "permanent deletion requires ADMIN password and current preview; linked history is removed",
      async () => {
        const purge = new PurgeService(db);
        await db.user.update({
          where: { id: user.id },
          data: { passwordHash: await argon2.hash("Test-only-password-123") },
        });
        const preview = await purge.preview(user, "ingredient", ingredient.id);
        assert.ok(preview.data.counts.fulfillment_orders! > 0);
        await assert.rejects(
          purge.execute(
            user,
            "ingredient",
            ingredient.id,
            "wrong",
            preview.data.previewHash,
          ),
        );
        const newOrder = await order();
        await assert.rejects(
          purge.execute(
            user,
            "ingredient",
            ingredient.id,
            "Test-only-password-123",
            preview.data.previewHash,
          ),
        );
        const fresh = await purge.preview(user, "ingredient", ingredient.id);
        await purge.execute(
          user,
          "ingredient",
          ingredient.id,
          "Test-only-password-123",
          fresh.data.previewHash,
        );
        assert.equal(
          await db.ingredient.count({ where: { id: ingredient.id } }),
          0,
        );
        assert.equal(
          await db.fulfillmentOrder.count({ where: { id: newOrder.id } }),
          0,
        );
        assert.equal(
          await db.stockLedgerEntry.count({
            where: { ingredientId: ingredient.id },
          }),
          0,
        );
        assert.equal(await db.facility.count({ where: { id: branch.id } }), 1);
        assert.equal(await db.user.count({ where: { id: user.id } }), 1);
      },
    );
    await t.test(
      "permanent deletion also supports supplier, stock location and facility roots",
      async () => {
        const purge = new PurgeService(db);
        for (const [kind, id] of [
          ["supplier", supplier.id],
          ["stock_location", source.id],
          ["facility", branch.id],
        ] as const) {
          const preview = await purge.preview(user, kind, id);
          await purge.execute(
            user,
            kind,
            id,
            "Test-only-password-123",
            preview.data.previewHash,
          );
          await assert.rejects(purge.preview(user, kind, id));
        }
        assert.equal(await db.user.count({ where: { id: user.id } }), 1);
      },
    );
  },
);
