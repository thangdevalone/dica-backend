import { HttpStatus, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { AuthUser } from "../auth/auth.types.js";
import { ScopeService } from "../auth/scope.service.js";
import { PrismaService } from "../database/prisma.service.js";
import { Prisma } from "../generated/prisma/client.js";
import { ApiException } from "../common/errors/api.exception.js";
import { ErrorCode } from "../common/errors/error-codes.js";
import { IdempotencyService } from "../common/idempotency/idempotency.service.js";
import type { PaginationDto } from "../common/dto/pagination.dto.js";
import { paginateById } from "../common/pagination/pagination.js";
import { endOfBusinessDay } from "../common/utils/business-day.js";
import { paymentStatus, paymentValue } from "../common/utils/payment.js";
import { notifyPermission } from "../common/utils/notify.js";
import type {
  CreateReturnDto,
  OrderPricesDto,
  PriceRuleDto,
  WorkflowCommandDto,
  WorkflowPolicyDto,
} from "./workflow.dto.js";

@Injectable()
export class WorkflowService {
  constructor(
    private readonly db: PrismaService,
    private readonly scope: ScopeService,
    private readonly idem: IdempotencyService,
  ) {}

  async policy(user: AuthUser) {
    this.scope.assertAccess(user, "workflow_policy.manage", {});
    return {
      data: await this.db.organization.findUniqueOrThrow({
        where: { id: user.organizationId },
        select: {
          paymentApprovalRequired: true,
          attachmentRetentionMonths: true,
        },
      }),
    };
  }

  async updatePolicy(user: AuthUser, dto: WorkflowPolicyDto) {
    this.scope.assertAccess(user, "workflow_policy.manage", {});
    const data = await this.db.$transaction(async (tx) => {
      const before = await tx.organization.findUniqueOrThrow({
        where: { id: user.organizationId },
        select: {
          paymentApprovalRequired: true,
          attachmentRetentionMonths: true,
        },
      });
      const updated = await tx.organization.update({
        where: { id: user.organizationId },
        data: {
          paymentApprovalRequired: dto.payment_approval_required,
          attachmentRetentionMonths: dto.attachment_retention_months,
        },
        select: {
          paymentApprovalRequired: true,
          attachmentRetentionMonths: true,
        },
      });
      await this.audit(
        tx,
        user,
        "config.workflow_policy",
        "Organization",
        user.organizationId,
        before,
        updated,
      );
      return updated;
    });
    return { data, message: "Đã lưu chính sách nghiệp vụ." };
  }

  async rules(user: AuthUser, query: PaginationDto) {
    this.scope.assertAccess(user, "price_rule.manage", {});
    const where = { organizationId: user.organizationId };
    return paginateById(
      query,
      ({ skip, take, cursorId }) =>
        this.db.priceRule.findMany({
          where,
          take,
          ...(skip !== undefined ? { skip } : {}),
          ...(cursorId ? { cursor: { id: cursorId } } : {}),
          orderBy: { id: "asc" },
        }),
      () => this.db.priceRule.count({ where }),
    );
  }

  async updateRule(user: AuthUser, dto: PriceRuleDto) {
    this.scope.assertAccess(user, "price_rule.manage", {});
    if (new Prisma.Decimal(dto.base_price).lte(0))
      this.invalid("Giá chuẩn phải lớn hơn 0.");
    const ingredient = await this.db.ingredient.findFirst({
      where: {
        id: dto.ingredient_id,
        organizationId: user.organizationId,
        active: true,
      },
    });
    if (!ingredient) this.missing();
    const data = await this.db.$transaction(async (tx) => {
      const where = {
        organizationId_ingredientId: {
          organizationId: user.organizationId,
          ingredientId: ingredient.id,
        },
      };
      const before = await tx.priceRule.findUnique({ where });
      const updated = await tx.priceRule.upsert({
        where,
        create: {
          organizationId: user.organizationId,
          ingredientId: ingredient.id,
          basePrice: dto.base_price,
          tolerancePercent: dto.tolerance_percent,
        },
        update: {
          basePrice: dto.base_price,
          tolerancePercent: dto.tolerance_percent,
        },
      });
      await this.audit(
        tx,
        user,
        "config.price_rule",
        "PriceRule",
        updated.id,
        before,
        updated,
      );
      return updated;
    });
    return { data, message: "Đã lưu giá chuẩn theo đơn vị cơ sở." };
  }

  async prices(
    user: AuthUser,
    id: string,
    dto: OrderPricesDto,
    rawKey?: string,
  ) {
    if (
      new Set(dto.lines.map((line) => line.order_line_id)).size !==
      dto.lines.length
    )
      this.invalid("Dòng hàng bị trùng.");
    const result = await this.idem.execute(
      user,
      `order.prices:${id}`,
      this.idem.requireKey(rawKey),
      dto,
      async (tx) => {
        const order = await this.order(tx, user, id, "price.update");
        if (
          order.sourceType !== "SUPPLIER" ||
          !order.supplierId ||
          order.status === "CANCELLED"
        )
          this.invalid("Chỉ nhập giá cho đơn nhà cung cấp còn hiệu lực.");
        if (order.version !== dto.expected_version) this.conflict();
        for (const input of dto.lines) {
          const line = order.lines.find(
            (item) => item.id === input.order_line_id,
          );
          if (!line) this.missing();
          const price = new Prisma.Decimal(input.unit_price);
          await tx.fulfillmentLine.update({
            where: { id: line.id },
            data: { unitPriceSnapshot: price, version: { increment: 1 } },
          });
          await tx.supplierIngredient.updateMany({
            where: {
              supplierId: order.supplierId,
              ingredientId: line.ingredientId,
            },
            data: { referencePrice: price },
          });
          const rule = await tx.priceRule.findUnique({
            where: {
              organizationId_ingredientId: {
                organizationId: user.organizationId,
                ingredientId: line.ingredientId,
              },
            },
          });
          if (
            rule &&
            price
              .sub(rule.basePrice)
              .abs()
              .mul(100)
              .gt(rule.basePrice.mul(rule.tolerancePercent))
          ) {
            await notifyPermission(
              tx,
              user.organizationId,
              "price_alert.read",
              this.orderScope(order),
              "Đơn giá vượt ngưỡng",
              `Đơn ${order.code}: đơn giá ${price} lệch giá chuẩn ${rule.basePrice} quá ${rule.tolerancePercent}%.`,
              "FulfillmentOrder",
              id,
            );
          }
        }
        const updated = await tx.fulfillmentOrder.update({
          where: { id },
          data: {
            version: { increment: 1 },
            ...(dto.payment_term_days !== undefined
              ? {
                  paymentDueAt: new Date(
                    endOfBusinessDay(
                      order.releasedAt ?? order.createdAt,
                    ).getTime() +
                      dto.payment_term_days * 86_400_000,
                  ),
                }
              : {}),
          },
          include: { lines: true },
        });
        await this.audit(
          tx,
          user,
          "order.prices",
          "FulfillmentOrder",
          id,
          { lines: order.lines },
          { lines: updated.lines, paymentDueAt: updated.paymentDueAt },
        );
        await this.reconcile(tx, id);
        return { order_id: id, version: updated.version };
      },
    );
    return {
      data: result.value,
      message: "Đã lưu giá đơn hàng và giá lần sau của nhà cung cấp.",
    };
  }

  async confirmPayment(
    user: AuthUser,
    id: string,
    dto: WorkflowCommandDto,
    rawKey?: string,
  ) {
    const result = await this.idem.execute(
      user,
      `payment.confirm:${id}`,
      this.idem.requireKey(rawKey),
      dto,
      async (tx) => {
        const order = await this.order(
          tx,
          user,
          id,
          "payment_tracking.confirm",
        );
        const payment = await tx.paymentTracking.findUnique({
          where: { orderId: id },
        });
        if (!payment || payment.version !== dto.expected_version)
          this.conflict();
        if (payment.pendingPaidValue === null)
          this.invalid("Không có thanh toán chờ xác nhận.");
        if (payment.updatedById === user.id)
          this.invalid("Người nhập không được tự xác nhận thanh toán.");
        const value = paymentValue(order.lines);
        if (value === null || payment.pendingPaidValue.gt(value))
          this.invalid("Cần đối soát lại giá trị thanh toán.");
        const updated = await tx.paymentTracking.update({
          where: { orderId: id },
          data: {
            paidValue: payment.pendingPaidValue,
            pendingPaidValue: null,
            confirmedById: user.id,
            reconciledValue: value,
            status: paymentStatus(payment.pendingPaidValue, value),
            version: { increment: 1 },
          },
        });
        await this.audit(
          tx,
          user,
          "payment_tracking.confirm",
          "FulfillmentOrder",
          id,
          payment,
          updated,
        );
        await tx.notification.create({
          data: {
            organizationId: user.organizationId,
            userId: payment.updatedById,
            title: "Thanh toán đã được xác nhận",
            message: `Khoản thanh toán của đơn ${order.code} đã được xác nhận.`,
            resourceType: "FulfillmentOrder",
            resourceId: id,
            lastRemindedAt: new Date(0),
          },
        });
        return {
          order_id: id,
          version: updated.version,
          status: updated.status,
        };
      },
    );
    return { data: result.value, message: "Đã xác nhận thanh toán." };
  }

  async returns(user: AuthUser, query: PaginationDto) {
    const access = this.scope.constraintsFor(user, "return.read", [
      "facilityId",
      "stockLocationId",
      "createdById",
    ]);
    const where: Prisma.ReturnDocumentWhereInput = {
      order: { organizationId: user.organizationId },
      ...(access
        ? {
            OR: access.map((item) => ({
              ...(item.createdById ? { createdById: item.createdById } : {}),
              order: {
                destinationStockLocation: {
                  ...(item.facilityId ? { facilityId: item.facilityId } : {}),
                  ...(item.stockLocationId ? { id: item.stockLocationId } : {}),
                },
              },
            })),
          }
        : {}),
    };
    return paginateById(
      query,
      ({ skip, take, cursorId }) =>
        this.db.returnDocument.findMany({
          where,
          include: {
            lines: true,
            order: { include: { destinationStockLocation: true } },
          },
          take,
          ...(skip !== undefined ? { skip } : {}),
          ...(cursorId ? { cursor: { id: cursorId } } : {}),
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        }),
      () => this.db.returnDocument.count({ where }),
    );
  }

  async returnDetail(user: AuthUser, id: string) {
    const document = await this.db.returnDocument.findFirst({
      where: { id, order: { organizationId: user.organizationId } },
      include: {
        lines: true,
        order: { include: { destinationStockLocation: true } },
      },
    });
    if (!document) this.missing();
    this.scope.assertAccess(user, "return.read", {
      ...this.orderScope(document.order),
      createdById: document.createdById,
    });
    return { data: document };
  }

  async createReturn(user: AuthUser, dto: CreateReturnDto) {
    if (
      new Set(dto.lines.map((line) => line.order_line_id)).size !==
      dto.lines.length
    )
      this.invalid("Dòng hàng bị trùng.");
    const data = await this.db.$transaction(async (tx) => {
      const order = await this.order(tx, user, dto.order_id, "return.create");
      for (const line of dto.lines) {
        const source = order.lines.find(
          (item) => item.id === line.order_line_id,
        );
        if (
          !source ||
          new Prisma.Decimal(line.quantity).lte(0) ||
          new Prisma.Decimal(line.quantity).gt(
            source.receivedQuantity
              .add(source.acceptedExcessQuantity)
              .sub(source.returnedQuantity),
          )
        )
          this.invalid("Số lượng hoàn vượt số thực nhận còn lại.");
      }
      return tx.returnDocument.create({
        data: {
          orderId: order.id,
          code: `RET-${randomUUID().slice(0, 12)}`,
          createdById: user.id,
          note: dto.note,
          lines: {
            create: dto.lines.map((line) => ({
              orderLineId: line.order_line_id,
              quantity: line.quantity,
            })),
          },
        },
        include: { lines: true },
      });
    });
    return {
      data,
      message:
        "Đã tạo phiếu hoàn. Đính kèm ảnh hàng cùng hóa đơn trước khi gửi.",
    };
  }

  async returnCommand(
    user: AuthUser,
    id: string,
    dto: WorkflowCommandDto,
    status: "SUBMITTED" | "APPROVED" | "REJECTED",
  ) {
    const data = await this.db.$transaction(
      async (tx) => {
        const document = await tx.returnDocument.findFirst({
          where: { id, order: { organizationId: user.organizationId } },
          include: {
            lines: { include: { orderLine: true } },
            order: { include: { destinationStockLocation: true } },
          },
        });
        if (!document) this.missing();
        this.scope.assertAccess(
          user,
          status === "SUBMITTED" ? "return.create" : "return.approve",
          {
            ...this.orderScope(document.order),
            createdById: document.createdById,
          },
        );
        if (
          document.version !== dto.expected_version ||
          document.status !== (status === "SUBMITTED" ? "DRAFT" : "SUBMITTED")
        )
          this.conflict();
        if (status === "REJECTED" && (!dto.note || dto.note.trim().length < 3))
          this.invalid("Cần nhập lý do từ chối.");
        const images = await tx.attachment.count({
          where: {
            organizationId: user.organizationId,
            resourceType: "RETURN",
            resourceId: id,
            uploadStatus: "READY",
          },
        });
        if (status !== "REJECTED" && (images < 1 || images > 10))
          this.invalid("Phiếu hoàn cần 1–10 ảnh chụp hàng cùng hóa đơn.");
        if (status === "APPROVED")
          for (const line of document.lines) {
            const reserved = await tx.returnLine.aggregate({
              where: {
                orderLineId: line.orderLineId,
                document: { status: "APPROVED", postedAt: null },
              },
              _sum: { quantity: true },
            });
            const available = line.orderLine.receivedQuantity
              .add(line.orderLine.acceptedExcessQuantity)
              .sub(line.orderLine.returnedQuantity)
              .sub(reserved._sum.quantity ?? 0);
            if (line.quantity.gt(available))
              this.invalid("Số lượng hoàn đã được dùng bởi phiếu khác.");
          }
        const updated = await tx.returnDocument.update({
          where: { id },
          data: {
            status,
            version: { increment: 1 },
            ...(status !== "SUBMITTED"
              ? { decisionNote: dto.note?.trim() || null }
              : {}),
            ...(status === "APPROVED"
              ? {
                  approvedById: user.id,
                  approvedAt: new Date(),
                  settleAt: endOfBusinessDay(new Date()),
                }
              : {}),
          },
          include: { lines: true },
        });
        await this.audit(
          tx,
          user,
          `return.${status.toLowerCase()}`,
          "ReturnDocument",
          id,
          { status: document.status },
          { status, note: dto.note ?? null },
        );
        if (status === "SUBMITTED")
          await notifyPermission(
            tx,
            user.organizationId,
            "return.approve",
            this.orderScope(document.order),
            "Phiếu hoàn chờ duyệt",
            `Phiếu ${document.code} chờ duyệt hoàn về nơi cấp.`,
            "ReturnDocument",
            id,
          );
        else
          await tx.notification.create({
            data: {
              organizationId: user.organizationId,
              userId: document.createdById,
              title:
                status === "APPROVED"
                  ? "Phiếu hoàn đã được duyệt"
                  : "Phiếu hoàn bị từ chối",
              message:
                status === "APPROVED"
                  ? `Phiếu ${document.code} được duyệt; tồn kho và hóa đơn sẽ cập nhật khi chốt cuối ngày.`
                  : `Phiếu ${document.code} bị từ chối: ${updated.decisionNote}`,
              resourceType: "ReturnDocument",
              resourceId: id,
              lastRemindedAt: new Date(0),
            },
          });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return { data, message: "Đã cập nhật phiếu hoàn hàng." };
  }

  private async order(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    id: string,
    permission: string,
  ) {
    const order = await tx.fulfillmentOrder.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { destinationStockLocation: true, lines: true },
    });
    if (!order) this.missing();
    this.scope.assertAccess(user, permission, this.orderScope(order));
    return order;
  }
  private orderScope(order: {
    destinationStockLocationId: string;
    destinationStockLocation: { facilityId: string };
  }) {
    return {
      facilityId: order.destinationStockLocation.facilityId,
      stockLocationId: order.destinationStockLocationId,
    };
  }
  private async reconcile(tx: Prisma.TransactionClient, orderId: string) {
    const lines = await tx.fulfillmentLine.findMany({ where: { orderId } });
    const value = paymentValue(lines);
    const payment = await tx.paymentTracking.findUnique({ where: { orderId } });
    if (value !== null && payment)
      await tx.paymentTracking.update({
        where: { orderId },
        data: {
          reconciledValue: value,
          status: paymentStatus(payment.paidValue, value),
          version: { increment: 1 },
        },
      });
  }
  private async audit(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    action: string,
    resourceType: string,
    resourceId: string,
    before: unknown,
    after: unknown,
  ) {
    await tx.auditEvent.create({
      data: {
        organizationId: user.organizationId,
        actorId: user.id,
        action,
        resourceType,
        resourceId,
        requestId: user.requestId,
        beforeData: JSON.parse(JSON.stringify(before)) as Prisma.InputJsonValue,
        afterData: JSON.parse(JSON.stringify(after)) as Prisma.InputJsonValue,
      },
    });
  }
  private invalid(message: string): never {
    throw new ApiException(
      ErrorCode.VALIDATION_ERROR,
      message,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
  private missing(): never {
    throw new ApiException(
      ErrorCode.RESOURCE_NOT_FOUND,
      "Không tìm thấy dữ liệu trong phạm vi quyền.",
      HttpStatus.NOT_FOUND,
    );
  }
  private conflict(): never {
    throw new ApiException(
      ErrorCode.VERSION_CONFLICT,
      "Phiếu đã thay đổi hoặc không còn ở trạng thái cho phép. Vui lòng tải lại.",
      HttpStatus.CONFLICT,
    );
  }
}
