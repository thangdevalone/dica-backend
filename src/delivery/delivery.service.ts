import { randomUUID } from "node:crypto";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AuthUser } from "../auth/auth.types.js";
import { ScopeService } from "../auth/scope.service.js";
import type { PaginationDto } from "../common/dto/pagination.dto.js";
import { ApiException } from "../common/errors/api.exception.js";
import { ErrorCode } from "../common/errors/error-codes.js";
import { IdempotencyService } from "../common/idempotency/idempotency.service.js";
import { paginateById } from "../common/pagination/pagination.js";
import { assertPositiveDecimal } from "../common/utils/decimal.js";
import { PrismaService } from "../database/prisma.service.js";
import {
  DispatchStatus,
  DiscrepancyStatus,
  LedgerEntryType,
  OrderSourceType,
  OrderStatus,
  Prisma,
  ReceiptStatus,
  StockLocationType,
} from "../generated/prisma/client.js";
import type {
  CreateDispatchDto,
  CreateReceiptDto,
  PostDocumentDto,
  ResolveDiscrepancyDto,
} from "./delivery.dto.js";
@Injectable()
export class DeliveryService {
  constructor(
    private db: PrismaService,
    private scope: ScopeService,
    private idem: IdempotencyService,
    private config: ConfigService,
  ) {}

  async discrepancies(u: AuthUser, q: PaginationDto) {
    const access = this.scope.constraintsFor(u, "discrepancy.read", [
      "facilityId",
      "stockLocationId",
    ]);
    const where: Prisma.DiscrepancyCaseWhereInput = {
      receipt: {
        order: {
          organizationId: u.organizationId,
          destinationStockLocation: {
            ...(access
              ? {
                  OR: access.map((item) => ({
                    ...(item.facilityId ? { facilityId: item.facilityId } : {}),
                    ...(item.stockLocationId
                      ? { id: item.stockLocationId }
                      : {}),
                  })),
                }
              : {}),
          },
        },
      },
    };
    const { data, meta } = await paginateById(
      q,
      ({ skip, take, cursorId }) =>
        this.db.discrepancyCase.findMany({
          where,
          include: {
            receipt: {
              include: {
                order: { include: { destinationStockLocation: true } },
              },
            },
            receiptLine: { include: { orderLine: true } },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          ...(skip !== undefined ? { skip } : {}),
          take,
          ...(cursorId ? { cursor: { id: cursorId } } : {}),
        }),
      () => this.db.discrepancyCase.count({ where }),
    );
    return {
      data,
      message: "Lấy danh sách chênh lệch giao nhận thành công.",
      meta,
    };
  }

  async resolveDiscrepancy(u: AuthUser, id: string, d: ResolveDiscrepancyDto) {
    if (!this.config.get<boolean>("DEMO_POLICY_ENABLED", false))
      throw new ApiException(
        ErrorCode.POLICY_NOT_CONFIGURED,
        "Chính sách xử lý chênh lệch chưa được chốt cho production.",
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    const discrepancy = await this.db.discrepancyCase.findFirst({
      where: { id, receipt: { order: { organizationId: u.organizationId } } },
      include: {
        receipt: {
          include: {
            order: { include: { destinationStockLocation: true } },
          },
        },
      },
    });
    if (!discrepancy) this.notFound("chênh lệch giao nhận");
    const destination = discrepancy.receipt.order.destinationStockLocation;
    this.scope.assertAccess(u, "discrepancy.resolve", {
      facilityId: destination.facilityId,
      stockLocationId: destination.id,
    });
    if (discrepancy.status !== DiscrepancyStatus.OPEN) this.state();
    const data = await this.db.$transaction(async (tx) => {
      const guard = await tx.discrepancyCase.updateMany({
        where: { id, status: DiscrepancyStatus.OPEN },
        data: {
          status: DiscrepancyStatus.RESOLVED,
          resolution: d.resolution,
          resolvedById: u.id,
          resolvedAt: new Date(),
        },
      });
      if (guard.count !== 1) this.state();
      const updated = await tx.discrepancyCase.findUniqueOrThrow({
        where: { id },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: u.organizationId,
          actorId: u.id,
          action: "discrepancy.resolve",
          resourceType: "DiscrepancyCase",
          resourceId: id,
          requestId: `discrepancy-resolve:${id}`,
          beforeData: { status: discrepancy.status },
          afterData: {
            status: updated.status,
            resolution: updated.resolution,
            inventory_posted: false,
          },
        },
      });
      return updated;
    });
    return {
      data,
      message:
        "Xử lý chênh lệch thành công; thao tác này không tự điều chỉnh tồn kho.",
    };
  }
  async createDispatch(u: AuthUser, d: CreateDispatchDto) {
    const o = await this.db.fulfillmentOrder.findFirst({
      where: { id: d.order_id, organizationId: u.organizationId },
      include: { sourceStockLocation: true, lines: true },
    });
    if (!o || o.sourceType !== OrderSourceType.STOCK || !o.sourceStockLocation)
      this.notFound("đơn xuất kho");
    this.scope.assertAccess(u, "dispatch.create", {
      facilityId: o.sourceStockLocation.facilityId,
      stockLocationId: o.sourceStockLocation.id,
    });
    if (o.status !== OrderStatus.RELEASED && o.status !== OrderStatus.PARTIAL)
      this.state();
    this.unique(d.lines.map((x) => x.order_line_id));
    for (const x of d.lines) {
      assertPositiveDecimal(x.quantity);
      const l = o.lines.find((y) => y.id === x.order_line_id);
      if (
        !l ||
        new Prisma.Decimal(x.quantity).gt(
          l.approvedQuantity.sub(l.dispatchedQuantity),
        )
      )
        this.exceeds(x.order_line_id);
    }
    const data = await this.db.dispatch.create({
      data: {
        orderId: o.id,
        code: this.code("DSP"),
        createdById: u.id,
        ...(d.note ? { note: d.note } : {}),
        lines: {
          create: d.lines.map((x) => ({
            orderLineId: x.order_line_id,
            quantity: x.quantity,
          })),
        },
      },
      include: { lines: true },
    });
    return { data, message: "Tạo phiếu xuất kho thành công." };
  }
  async postDispatch(
    u: AuthUser,
    id: string,
    d: PostDocumentDto,
    raw?: string,
  ) {
    const key = this.idem.requireKey(raw);
    const out = await this.idem.execute(
      u,
      `dispatch.post:${id}`,
      key,
      d,
      async (tx) => {
        const doc = await tx.dispatch.findUnique({
          where: { id },
          include: {
            order: { include: { sourceStockLocation: true } },
            lines: {
              include: { orderLine: { include: { ingredient: true } } },
            },
          },
        });
        if (!doc || !doc.order.sourceStockLocation) this.notFound("phiếu xuất");
        this.scope.assertAccess(u, "dispatch.post", {
          facilityId: doc.order.sourceStockLocation.facilityId,
          stockLocationId: doc.order.sourceStockLocation.id,
        });
        if (doc.status !== DispatchStatus.DRAFT) this.state();
        if (doc.version !== d.expected_version) this.version();
        const transit = await tx.stockLocation.findFirst({
          where: {
            facilityId: doc.order.sourceStockLocation.facilityId,
            type: StockLocationType.IN_TRANSIT,
            active: true,
          },
        });
        if (!transit)
          throw new ApiException(
            ErrorCode.DATA_INCOMPLETE,
            "Cơ sở gửi chưa có vị trí hàng đang vận chuyển.",
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        const orderedLines = [...doc.lines].sort((left, right) =>
          left.orderLine.ingredientId.localeCompare(
            right.orderLine.ingredientId,
          ),
        );
        for (const l of orderedLines) {
          const current = l.orderLine,
            qty = l.quantity;
          if (qty.gt(current.approvedQuantity.sub(current.dispatchedQuantity)))
            this.exceeds(l.orderLineId);
          const balance = await tx.stockBalance.findUnique({
            where: {
              stockLocationId_ingredientId: {
                stockLocationId: doc.order.sourceStockLocation.id,
                ingredientId: current.ingredientId,
              },
            },
          });
          if (!balance || balance.quantity.lt(qty))
            throw new ApiException(
              ErrorCode.INSUFFICIENT_STOCK,
              "Tồn kho không đủ để xuất.",
              HttpStatus.CONFLICT,
              {
                order_line_id: l.orderLineId,
                available: balance?.quantity.toString() ?? "0",
              },
            );
          await this.postBalance(
            tx,
            doc.order.sourceStockLocation.id,
            current.ingredientId,
            qty.neg(),
            LedgerEntryType.DISPATCH_OUT,
            "Dispatch",
            doc.id,
            l.id,
            key,
            u.id,
          );
          await this.postBalance(
            tx,
            transit.id,
            current.ingredientId,
            qty,
            LedgerEntryType.TRANSIT_IN,
            "Dispatch",
            doc.id,
            l.id,
            key,
            u.id,
          );
          await tx.fulfillmentLine.update({
            where: { id: current.id },
            data: {
              dispatchedQuantity: { increment: qty },
              version: { increment: 1 },
            },
          });
        }
        await tx.dispatch.update({
          where: { id },
          data: {
            status: DispatchStatus.POSTED,
            postedById: u.id,
            postedAt: new Date(),
            version: { increment: 1 },
          },
        });
        await this.refreshOrder(tx, doc.orderId);
        await tx.auditEvent.create({
          data: {
            organizationId: u.organizationId,
            actorId: u.id,
            action: "dispatch.post",
            resourceType: "Dispatch",
            resourceId: id,
            requestId: key,
            afterData: { status: "POSTED" },
          },
        });
        return { dispatch_id: id, status: "POSTED" } as Prisma.JsonObject;
      },
    );
    return {
      data: out.value,
      message: out.replayed
        ? "Phiếu xuất đã được hạch toán trước đó."
        : "Hạch toán xuất kho thành công.",
    };
  }
  async createReceipt(u: AuthUser, d: CreateReceiptDto) {
    const o = await this.db.fulfillmentOrder.findFirst({
      where: { id: d.order_id, organizationId: u.organizationId },
      include: { destinationStockLocation: true, lines: true },
    });
    if (!o) this.notFound("đơn nhận");
    this.scope.assertAccess(u, "receipt.create", {
      facilityId: o.destinationStockLocation.facilityId,
      stockLocationId: o.destinationStockLocationId,
    });
    if (o.status !== OrderStatus.RELEASED && o.status !== OrderStatus.PARTIAL)
      this.state();
    if (o.sourceType === OrderSourceType.STOCK) {
      if (!d.dispatch_id)
        throw new ApiException(
          ErrorCode.VALIDATION_ERROR,
          "Đơn nội bộ phải tham chiếu phiếu xuất.",
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      const dispatch = await this.db.dispatch.findFirst({
        where: {
          id: d.dispatch_id,
          orderId: o.id,
          status: DispatchStatus.POSTED,
        },
        include: { lines: true },
      });
      if (
        !dispatch ||
        d.lines.some(
          (line) =>
            !dispatch.lines.some(
              (dispatchLine) => dispatchLine.orderLineId === line.order_line_id,
            ),
        )
      )
        this.notFound("phiếu xuất hoặc dòng phiếu xuất");
    } else if (d.dispatch_id) {
      throw new ApiException(
        ErrorCode.VALIDATION_ERROR,
        "Đơn từ nhà cung ứng không được tham chiếu phiếu xuất nội bộ.",
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    this.unique(d.lines.map((x) => x.order_line_id));
    for (const x of d.lines) {
      assertPositiveDecimal(x.quantity);
      if (!o.lines.some((y) => y.id === x.order_line_id))
        this.notFound("dòng đơn");
    }
    const data = await this.db.receipt.create({
      data: {
        orderId: o.id,
        ...(d.dispatch_id ? { dispatchId: d.dispatch_id } : {}),
        code: this.code("RCT"),
        createdById: u.id,
        ...(d.note ? { note: d.note } : {}),
        lines: {
          create: d.lines.map((x) => ({
            orderLineId: x.order_line_id,
            reportedQuantity: x.quantity,
          })),
        },
      },
      include: { lines: true },
    });
    return { data, message: "Tạo phiếu nhận hàng thành công." };
  }
  async postReceipt(u: AuthUser, id: string, d: PostDocumentDto, raw?: string) {
    const key = this.idem.requireKey(raw);
    const out = await this.idem.execute(
      u,
      `receipt.post:${id}`,
      key,
      d,
      async (tx) => {
        const doc = await tx.receipt.findUnique({
          where: { id },
          include: {
            order: {
              include: {
                destinationStockLocation: true,
                sourceStockLocation: true,
              },
            },
            dispatch: { include: { lines: true } },
            lines: { include: { orderLine: true } },
          },
        });
        if (!doc) this.notFound("phiếu nhận");
        this.scope.assertAccess(u, "receipt.post", {
          facilityId: doc.order.destinationStockLocation.facilityId,
          stockLocationId: doc.order.destinationStockLocationId,
        });
        if (doc.status !== ReceiptStatus.DRAFT) this.state();
        if (doc.version !== d.expected_version) this.version();
        if (
          doc.order.status !== OrderStatus.RELEASED &&
          doc.order.status !== OrderStatus.PARTIAL
        )
          this.state();
        let transitId: string | undefined;
        const acceptedByOrderLine = new Map<string, Prisma.Decimal>();
        if (doc.order.sourceType === OrderSourceType.STOCK) {
          if (
            !doc.dispatch ||
            doc.dispatch.orderId !== doc.orderId ||
            doc.dispatch.status !== DispatchStatus.POSTED
          )
            this.state();
          const t = await tx.stockLocation.findFirst({
            where: {
              facilityId: doc.order.sourceStockLocation!.facilityId,
              type: StockLocationType.IN_TRANSIT,
              active: true,
            },
          });
          if (!t)
            throw new ApiException(
              ErrorCode.DATA_INCOMPLETE,
              "Không tìm thấy vị trí hàng đang vận chuyển.",
              HttpStatus.UNPROCESSABLE_ENTITY,
            );
          transitId = t.id;
          const totals = await tx.receiptLine.groupBy({
            by: ["orderLineId"],
            where: {
              orderLineId: { in: doc.lines.map((line) => line.orderLineId) },
              receipt: {
                dispatchId: doc.dispatch.id,
                status: ReceiptStatus.POSTED,
              },
            },
            _sum: { acceptedQuantity: true },
          });
          totals.forEach((item) =>
            acceptedByOrderLine.set(
              item.orderLineId,
              item._sum.acceptedQuantity ?? new Prisma.Decimal(0),
            ),
          );
        }
        const orderedLines = [...doc.lines].sort((left, right) =>
          left.orderLine.ingredientId.localeCompare(
            right.orderLine.ingredientId,
          ),
        );
        for (const l of orderedLines) {
          const current = l.orderLine,
            orderOpen = current.approvedQuantity
              .sub(current.receivedQuantity)
              .sub(current.closedRemainingQuantity),
            dispatchLine = doc.dispatch?.lines.find(
              (line) => line.orderLineId === l.orderLineId,
            ),
            dispatchOpen = dispatchLine
              ? Prisma.Decimal.max(
                  dispatchLine.quantity.sub(
                    acceptedByOrderLine.get(l.orderLineId) ??
                      new Prisma.Decimal(0),
                  ),
                  0,
                )
              : orderOpen,
            expected = Prisma.Decimal.min(orderOpen, dispatchOpen),
            accepted = Prisma.Decimal.min(l.reportedQuantity, expected),
            excess = Prisma.Decimal.max(l.reportedQuantity.sub(expected), 0);
          if (doc.order.sourceType === OrderSourceType.STOCK && !dispatchLine)
            this.notFound("dòng phiếu xuất");
          if (accepted.gt(0) && transitId) {
            const b = await tx.stockBalance.findUnique({
              where: {
                stockLocationId_ingredientId: {
                  stockLocationId: transitId,
                  ingredientId: current.ingredientId,
                },
              },
            });
            if (!b || b.quantity.lt(accepted))
              throw new ApiException(
                ErrorCode.QUANTITY_EXCEEDS_REMAINING,
                "Số lượng nhận vượt lượng đang vận chuyển.",
                HttpStatus.CONFLICT,
                { order_line_id: l.orderLineId },
              );
            await this.postBalance(
              tx,
              transitId,
              current.ingredientId,
              accepted.neg(),
              LedgerEntryType.TRANSIT_OUT,
              "Receipt",
              doc.id,
              l.id,
              key,
              u.id,
            );
            await this.postBalance(
              tx,
              doc.order.destinationStockLocationId,
              current.ingredientId,
              accepted,
              LedgerEntryType.RECEIPT_IN,
              "Receipt",
              doc.id,
              l.id,
              key,
              u.id,
            );
          } else if (accepted.gt(0))
            await this.postBalance(
              tx,
              doc.order.destinationStockLocationId,
              current.ingredientId,
              accepted,
              LedgerEntryType.SUPPLIER_RECEIPT_IN,
              "Receipt",
              doc.id,
              l.id,
              key,
              u.id,
            );
          await tx.receiptLine.update({
            where: { id: l.id },
            data: { acceptedQuantity: accepted, excessQuantity: excess },
          });
          await tx.fulfillmentLine.update({
            where: { id: current.id },
            data: {
              receivedQuantity: { increment: accepted },
              version: { increment: 1 },
            },
          });
          if (!l.reportedQuantity.eq(expected))
            await tx.discrepancyCase.create({
              data: {
                receiptId: doc.id,
                receiptLineId: l.id,
                type: l.reportedQuantity.lt(expected) ? "SHORTAGE" : "EXCESS",
                expectedQuantity: expected,
                actualQuantity: l.reportedQuantity,
              },
            });
        }
        await tx.receipt.update({
          where: { id },
          data: {
            status: ReceiptStatus.POSTED,
            postedById: u.id,
            postedAt: new Date(),
            version: { increment: 1 },
          },
        });
        await this.refreshOrder(tx, doc.orderId);
        await tx.auditEvent.create({
          data: {
            organizationId: u.organizationId,
            actorId: u.id,
            action: "receipt.post",
            resourceType: "Receipt",
            resourceId: id,
            requestId: key,
            afterData: { status: "POSTED" },
          },
        });
        return { receipt_id: id, status: "POSTED" } as Prisma.JsonObject;
      },
    );
    return {
      data: out.value,
      message: out.replayed
        ? "Phiếu nhận đã được hạch toán trước đó."
        : "Hạch toán nhận hàng thành công.",
    };
  }
  private async postBalance(
    tx: Prisma.TransactionClient,
    loc: string,
    item: string,
    qty: Prisma.Decimal,
    type: LedgerEntryType,
    sourceType: string,
    sourceId: string,
    lineId: string,
    key: string,
    user: string,
  ) {
    await tx.stockLedgerEntry.create({
      data: {
        stockLocationId: loc,
        ingredientId: item,
        entryType: type,
        quantity: qty,
        sourceType,
        sourceId,
        sourceLineId: lineId,
        postingKey: `${type}:${lineId}:${loc}`,
        postedById: user,
      },
    });
    if (qty.isNegative()) {
      const changed = await tx.stockBalance.updateMany({
        where: {
          stockLocationId: loc,
          ingredientId: item,
          quantity: { gte: qty.abs() },
        },
        data: { quantity: { increment: qty }, version: { increment: 1 } },
      });
      if (changed.count !== 1)
        throw new ApiException(
          ErrorCode.INSUFFICIENT_STOCK,
          "Tồn kho đã thay đổi hoặc không đủ để hạch toán.",
          HttpStatus.CONFLICT,
          { stock_location_id: loc, ingredient_id: item },
        );
      return;
    }
    await tx.stockBalance.upsert({
      where: {
        stockLocationId_ingredientId: {
          stockLocationId: loc,
          ingredientId: item,
        },
      },
      create: { stockLocationId: loc, ingredientId: item, quantity: qty },
      update: { quantity: { increment: qty }, version: { increment: 1 } },
    });
  }
  private async refreshOrder(tx: Prisma.TransactionClient, id: string) {
    const lines = await tx.fulfillmentLine.findMany({ where: { orderId: id } }),
      done = lines.every((x) =>
        x.receivedQuantity
          .add(x.closedRemainingQuantity)
          .gte(x.approvedQuantity),
      ),
      partial = lines.some(
        (x) => x.receivedQuantity.gt(0) || x.dispatchedQuantity.gt(0),
      );
    await tx.fulfillmentOrder.update({
      where: { id },
      data: {
        status: done
          ? OrderStatus.COMPLETED
          : partial
            ? OrderStatus.PARTIAL
            : OrderStatus.RELEASED,
        version: { increment: 1 },
      },
    });
  }
  private unique(ids: string[]) {
    if (new Set(ids).size !== ids.length)
      throw new ApiException(
        ErrorCode.VALIDATION_ERROR,
        "Dòng đơn bị trùng.",
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
  }
  private exceeds(id: string): never {
    throw new ApiException(
      ErrorCode.QUANTITY_EXCEEDS_REMAINING,
      "Số lượng vượt phần còn lại của đơn.",
      HttpStatus.CONFLICT,
      { order_line_id: id },
    );
  }
  private state(): never {
    throw new ApiException(
      ErrorCode.INVALID_STATE,
      "Trạng thái chứng từ không cho phép thao tác.",
      HttpStatus.CONFLICT,
    );
  }
  private version(): never {
    throw new ApiException(
      ErrorCode.VERSION_CONFLICT,
      "Chứng từ đã được cập nhật. Vui lòng tải lại.",
      HttpStatus.CONFLICT,
    );
  }
  private notFound(x: string): never {
    throw new ApiException(
      ErrorCode.RESOURCE_NOT_FOUND,
      `Không tìm thấy ${x} hoặc bạn không có quyền truy cập.`,
      HttpStatus.NOT_FOUND,
    );
  }
  private code(p: string) {
    return `${p}-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;
  }
}
