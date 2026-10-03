import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AuthUser } from "../auth/auth.types.js";
import { ScopeService } from "../auth/scope.service.js";
import type { PaginationDto } from "../common/dto/pagination.dto.js";
import { ApiException } from "../common/errors/api.exception.js";
import { ErrorCode } from "../common/errors/error-codes.js";
import { paginateById } from "../common/pagination/pagination.js";
import { PrismaService } from "../database/prisma.service.js";
import { OrderStatus, Prisma } from "../generated/prisma/client.js";
import type { CancelOrderDto, CloseOutstandingDto } from "./order.dto.js";
@Injectable()
export class OrderService {
  constructor(
    private db: PrismaService,
    private scope: ScopeService,
    private config: ConfigService,
  ) {}
  async list(u: AuthUser, q: PaginationDto) {
    const access = this.scope.constraintsFor(u, "order.read", [
      "facilityId",
      "stockLocationId",
    ]);
    const where: Prisma.FulfillmentOrderWhereInput = {
      organizationId: u.organizationId,
      ...(access
        ? {
            OR: access.flatMap((item) => {
              const location = {
                ...(item.facilityId ? { facilityId: item.facilityId } : {}),
                ...(item.stockLocationId ? { id: item.stockLocationId } : {}),
              };
              return [
                { destinationStockLocation: location },
                { sourceStockLocation: location },
              ];
            }),
          }
        : {}),
    };
    const { data, meta } = await paginateById(
      q,
      ({ skip, take, cursorId }) =>
        this.db.fulfillmentOrder.findMany({
          where,
          include: {
            supplier: true,
            sourceStockLocation: true,
            destinationStockLocation: true,
            _count: {
              select: { lines: true, dispatches: true, receipts: true },
            },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          ...(skip !== undefined ? { skip } : {}),
          take,
          ...(cursorId ? { cursor: { id: cursorId } } : {}),
        }),
      () => this.db.fulfillmentOrder.count({ where }),
    );
    return {
      data,
      message: "Lấy danh sách đơn thực hiện thành công.",
      meta,
    };
  }
  async detail(u: AuthUser, id: string) {
    const o = await this.db.fulfillmentOrder.findFirst({
      where: { id, organizationId: u.organizationId },
      include: {
        supplier: true,
        sourceStockLocation: true,
        destinationStockLocation: { include: { facility: true } },
        lines: { include: { ingredient: true } },
        dispatches: { include: { lines: true } },
        receipts: { include: { lines: true } },
      },
    });
    if (!o) this.notFound();
    const sourceFacility = o.sourceStockLocation?.facilityId;
    const allowed =
      this.scope.canAccess(u, "order.read", {
        facilityId: o.destinationStockLocation.facilityId,
        stockLocationId: o.destinationStockLocationId,
      }) ||
      (sourceFacility
        ? this.scope.canAccess(u, "order.read", {
            facilityId: sourceFacility,
            stockLocationId: o.sourceStockLocationId,
          })
        : false);
    if (!allowed) this.notFound();
    return { data: o, message: "Lấy chi tiết đơn thực hiện thành công." };
  }
  async supplierList(u: AuthUser, q: PaginationDto) {
    if (!u.supplierId) this.notFound();
    const where = {
      organizationId: u.organizationId,
      supplierId: u.supplierId,
      status: { not: "DRAFT" as const },
    };
    const { data, meta } = await paginateById(
      q,
      ({ skip, take, cursorId }) =>
        this.db.fulfillmentOrder.findMany({
          where,
          select: {
            id: true,
            code: true,
            status: true,
            releasedAt: true,
            destinationStockLocation: {
              select: { name: true, facility: { select: { name: true } } },
            },
            lines: {
              select: {
                id: true,
                approvedQuantity: true,
                receivedQuantity: true,
                unitCodeSnapshot: true,
                unitPriceSnapshot: true,
                ingredient: { select: { code: true, name: true } },
              },
            },
          },
          ...(skip !== undefined ? { skip } : {}),
          take,
          orderBy: [{ releasedAt: "desc" }, { id: "desc" }],
          ...(cursorId ? { cursor: { id: cursorId } } : {}),
        }),
      () => this.db.fulfillmentOrder.count({ where }),
    );
    return {
      data,
      message: "Lấy danh sách đơn của nhà cung ứng thành công.",
      meta,
    };
  }
  async supplierDetail(u: AuthUser, id: string) {
    if (!u.supplierId) this.notFound();
    const data = await this.db.fulfillmentOrder.findFirst({
      where: {
        id,
        organizationId: u.organizationId,
        supplierId: u.supplierId,
        status: { not: "DRAFT" },
      },
      select: {
        id: true,
        code: true,
        status: true,
        releasedAt: true,
        destinationStockLocation: {
          select: { name: true, facility: { select: { name: true } } },
        },
        lines: {
          select: {
            id: true,
            approvedQuantity: true,
            receivedQuantity: true,
            unitCodeSnapshot: true,
            unitPriceSnapshot: true,
            ingredient: { select: { code: true, name: true } },
          },
        },
      },
    });
    if (!data) this.notFound();
    return { data, message: "Lấy chi tiết đơn của nhà cung ứng thành công." };
  }

  async closeOutstanding(u: AuthUser, id: string, d: CloseOutstandingDto) {
    if (!this.config.get<boolean>("DEMO_POLICY_ENABLED", false))
      throw new ApiException(
        ErrorCode.POLICY_NOT_CONFIGURED,
        "Chính sách đóng phần còn thiếu chưa được chốt cho production.",
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    const order = await this.db.fulfillmentOrder.findFirst({
      where: { id, organizationId: u.organizationId },
      include: {
        destinationStockLocation: true,
        sourceStockLocation: true,
        lines: true,
        receipts: { include: { discrepancies: true } },
      },
    });
    if (!order) this.notFound();
    const allowed =
      this.scope.canAccess(u, "order.close_outstanding", {
        facilityId: order.destinationStockLocation.facilityId,
        stockLocationId: order.destinationStockLocationId,
      }) ||
      (order.sourceStockLocation
        ? this.scope.canAccess(u, "order.close_outstanding", {
            facilityId: order.sourceStockLocation.facilityId,
            stockLocationId: order.sourceStockLocationId,
          })
        : false);
    if (!allowed) this.notFound();
    if (order.version !== d.expected_version)
      throw new ApiException(
        ErrorCode.VERSION_CONFLICT,
        "Đơn đã được cập nhật. Vui lòng tải lại trước khi thao tác.",
        HttpStatus.CONFLICT,
      );
    if (
      order.status !== OrderStatus.RELEASED &&
      order.status !== OrderStatus.PARTIAL
    )
      throw new ApiException(
        ErrorCode.INVALID_STATE,
        "Trạng thái đơn không cho phép đóng phần còn thiếu.",
        HttpStatus.CONFLICT,
      );
    if (
      order.lines.some((line) =>
        line.dispatchedQuantity.gt(line.receivedQuantity),
      )
    )
      throw new ApiException(
        ErrorCode.INVALID_STATE,
        "Đơn còn hàng đang vận chuyển; cần nhận hoặc đối soát trước khi đóng.",
        HttpStatus.CONFLICT,
      );
    if (
      order.receipts.some((receipt) =>
        receipt.discrepancies.some((item) => item.status === "OPEN"),
      )
    )
      throw new ApiException(
        ErrorCode.INVALID_STATE,
        "Đơn còn chênh lệch chưa xử lý.",
        HttpStatus.CONFLICT,
      );
    const closable = order.lines
      .map((line) => ({
        id: line.id,
        quantity: line.approvedQuantity
          .sub(line.receivedQuantity)
          .sub(line.closedRemainingQuantity),
      }))
      .filter((line) => line.quantity.gt(0));
    if (closable.length === 0)
      throw new ApiException(
        ErrorCode.INVALID_STATE,
        "Đơn không còn số lượng cần đóng.",
        HttpStatus.CONFLICT,
      );
    const data = await this.db.$transaction(
      async (tx) => {
        const guard = await tx.fulfillmentOrder.updateMany({
          where: {
            id,
            version: d.expected_version,
            status: order.status,
          },
          data: { status: OrderStatus.CLOSED, version: { increment: 1 } },
        });
        if (guard.count !== 1)
          throw new ApiException(
            ErrorCode.VERSION_CONFLICT,
            "Đơn vừa được cập nhật bởi thao tác khác. Vui lòng tải lại.",
            HttpStatus.CONFLICT,
          );
        for (const line of closable)
          await tx.fulfillmentLine.update({
            where: { id: line.id },
            data: {
              closedRemainingQuantity: { increment: line.quantity },
              version: { increment: 1 },
            },
          });
        const updated = await tx.fulfillmentOrder.findUniqueOrThrow({
          where: { id },
          include: { lines: true },
        });
        await tx.auditEvent.create({
          data: {
            organizationId: u.organizationId,
            actorId: u.id,
            action: "order.close_outstanding",
            resourceType: "FulfillmentOrder",
            resourceId: id,
            requestId: `order-close:${id}:${d.expected_version}`,
            beforeData: { status: order.status, version: order.version },
            afterData: {
              status: updated.status,
              version: updated.version,
              reason: d.reason,
              closed_lines: closable.map((line) => ({
                id: line.id,
                quantity: line.quantity.toString(),
              })),
            },
          },
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return {
      data,
      message: "Đóng phần số lượng còn thiếu của đơn thành công.",
    };
  }

  async cancel(u: AuthUser, id: string, d: CancelOrderDto) {
    const order = await this.db.fulfillmentOrder.findFirst({
      where: { id, organizationId: u.organizationId },
      include: {
        destinationStockLocation: true,
        sourceStockLocation: true,
        dispatches: true,
        receipts: true,
      },
    });
    if (!order) this.notFound();
    const allowed =
      this.scope.canAccess(u, "order.cancel", {
        facilityId: order.destinationStockLocation.facilityId,
        stockLocationId: order.destinationStockLocationId,
      }) ||
      (order.sourceStockLocation
        ? this.scope.canAccess(u, "order.cancel", {
            facilityId: order.sourceStockLocation.facilityId,
            stockLocationId: order.sourceStockLocationId,
          })
        : false);
    if (!allowed) this.notFound();
    if (order.version !== d.expected_version)
      throw new ApiException(
        ErrorCode.VERSION_CONFLICT,
        "Đơn đã được cập nhật. Vui lòng tải lại trước khi thao tác.",
        HttpStatus.CONFLICT,
      );
    if (order.status !== OrderStatus.RELEASED)
      throw new ApiException(
        ErrorCode.INVALID_STATE,
        "Chỉ đơn đã phát hành nhưng chưa thực hiện mới được hủy.",
        HttpStatus.CONFLICT,
      );
    if (
      order.dispatches.some((item) => item.status === "POSTED") ||
      order.receipts.some((item) => item.status === "POSTED")
    )
      throw new ApiException(
        ErrorCode.INVALID_STATE,
        "Đơn đã có ledger giao nhận; không thể hủy làm mất dấu lịch sử.",
        HttpStatus.CONFLICT,
      );
    const data = await this.db.$transaction(
      async (tx) => {
        const guard = await tx.fulfillmentOrder.updateMany({
          where: {
            id,
            version: d.expected_version,
            status: OrderStatus.RELEASED,
          },
          data: { status: OrderStatus.CANCELLED, version: { increment: 1 } },
        });
        if (guard.count !== 1)
          throw new ApiException(
            ErrorCode.VERSION_CONFLICT,
            "Đơn vừa được cập nhật bởi thao tác khác. Vui lòng tải lại.",
            HttpStatus.CONFLICT,
          );
        await tx.dispatch.updateMany({
          where: { orderId: id, status: "DRAFT" },
          data: { status: "CANCELLED", version: { increment: 1 } },
        });
        await tx.receipt.updateMany({
          where: { orderId: id, status: "DRAFT" },
          data: { status: "CANCELLED", version: { increment: 1 } },
        });
        const updated = await tx.fulfillmentOrder.findUniqueOrThrow({
          where: { id },
        });
        await tx.auditEvent.create({
          data: {
            organizationId: u.organizationId,
            actorId: u.id,
            action: "order.cancel",
            resourceType: "FulfillmentOrder",
            resourceId: id,
            requestId: `order-cancel:${id}:${d.expected_version}`,
            beforeData: { status: order.status, version: order.version },
            afterData: {
              status: updated.status,
              version: updated.version,
              reason: d.reason,
            },
          },
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return { data, message: "Hủy đơn chưa phát sinh giao nhận thành công." };
  }
  private notFound(): never {
    throw new ApiException(
      ErrorCode.RESOURCE_NOT_FOUND,
      "Không tìm thấy đơn hoặc bạn không có quyền truy cập.",
      HttpStatus.NOT_FOUND,
    );
  }
}
