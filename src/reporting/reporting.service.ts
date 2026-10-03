import { HttpStatus, Injectable } from "@nestjs/common";
import type { AuthUser } from "../auth/auth.types.js";
import { ScopeService } from "../auth/scope.service.js";
import type { PaginationDto } from "../common/dto/pagination.dto.js";
import { ApiException } from "../common/errors/api.exception.js";
import { ErrorCode } from "../common/errors/error-codes.js";
import { paginateById } from "../common/pagination/pagination.js";
import { IdempotencyService } from "../common/idempotency/idempotency.service.js";
import { PrismaService } from "../database/prisma.service.js";
import { PaymentStatus, Prisma, UserKind } from "../generated/prisma/client.js";
import type { ReportQueryDto, UpdatePaymentDto } from "./reporting.dto.js";

@Injectable()
export class ReportingService {
  constructor(
    private readonly db: PrismaService,
    private readonly scope: ScopeService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async payment(user: AuthUser, orderId: string) {
    this.assertInternal(user);
    const order = await this.loadOrder(user, orderId, "payment_tracking.read");
    const reconciledValue = this.reconciledValue(order.lines);
    const tracking = await this.db.paymentTracking.findUnique({
      where: { orderId },
    });
    return {
      data: {
        order_id: order.id,
        order_code: order.code,
        reconciled_value: reconciledValue.toFixed(4),
        paid_value: tracking?.paidValue.toFixed(4) ?? "0.0000",
        status: tracking?.status ?? PaymentStatus.UNPAID,
        version: tracking?.version ?? 0,
      },
      message: "Lấy thông tin đối soát thanh toán thành công.",
    };
  }

  async updatePayment(
    user: AuthUser,
    orderId: string,
    dto: UpdatePaymentDto,
    rawKey?: string,
  ) {
    this.assertInternal(user);
    const key = this.idempotency.requireKey(rawKey);
    const result = await this.idempotency.execute(
      user,
      `payment.update:${orderId}`,
      key,
      dto,
      async (tx) => {
        const order = await tx.fulfillmentOrder.findFirst({
          where: { id: orderId, organizationId: user.organizationId },
          include: {
            destinationStockLocation: true,
            sourceStockLocation: true,
            lines: true,
          },
        });
        if (!order) this.notFound();
        this.assertOrderScope(user, "payment_tracking.update", order);
        const reconciledValue = this.reconciledValue(order.lines);
        const paidValue = new Prisma.Decimal(dto.paid_value);
        if (paidValue.gt(reconciledValue))
          throw new ApiException(
            ErrorCode.VALIDATION_ERROR,
            "Số tiền đã ghi nhận không được vượt giá trị đối soát.",
            HttpStatus.UNPROCESSABLE_ENTITY,
            { reconciled_value: reconciledValue.toFixed(4) },
          );
        const existing = await tx.paymentTracking.findUnique({
          where: { orderId },
        });
        if ((existing?.version ?? 0) !== dto.expected_version)
          throw new ApiException(
            ErrorCode.VERSION_CONFLICT,
            "Thông tin thanh toán đã được cập nhật. Vui lòng tải lại.",
            HttpStatus.CONFLICT,
          );
        const status = paidValue.eq(0)
          ? PaymentStatus.UNPAID
          : paidValue.gte(reconciledValue)
            ? PaymentStatus.PAID
            : PaymentStatus.PARTIAL;
        const tracking = await tx.paymentTracking.upsert({
          where: { orderId },
          create: {
            orderId,
            reconciledValue,
            paidValue,
            status,
            updatedById: user.id,
          },
          update: {
            reconciledValue,
            paidValue,
            status,
            updatedById: user.id,
            version: { increment: 1 },
          },
        });
        await tx.auditEvent.create({
          data: {
            organizationId: user.organizationId,
            actorId: user.id,
            action: "payment_tracking.update",
            resourceType: "FulfillmentOrder",
            resourceId: orderId,
            requestId: key,
            ...(existing
              ? {
                  beforeData: {
                    paid_value: existing.paidValue.toString(),
                    status: existing.status,
                    version: existing.version,
                  },
                }
              : {}),
            afterData: {
              paid_value: tracking.paidValue.toString(),
              status: tracking.status,
              version: tracking.version,
            },
          },
        });
        return {
          order_id: orderId,
          reconciled_value: tracking.reconciledValue.toString(),
          paid_value: tracking.paidValue.toString(),
          status: tracking.status,
          version: tracking.version,
        } as Prisma.JsonObject;
      },
    );
    return {
      data: result.value,
      message: result.replayed
        ? "Khoản thanh toán đã được ghi nhận trước đó; trả lại kết quả cũ."
        : "Cập nhật đối soát thanh toán thành công.",
    };
  }

  async stockReport(user: AuthUser, query: ReportQueryDto) {
    const where: Prisma.StockBalanceWhereInput = {
      stockLocation: {
        facility: { organizationId: user.organizationId },
        ...this.stockLocationScope(user, "report.stock"),
        ...this.facilityFilter(query),
      },
    };
    const { data, meta } = await paginateById(
      query,
      ({ skip, take, cursorId }) =>
        this.db.stockBalance.findMany({
          where,
          include: {
            stockLocation: { include: { facility: true } },
            ingredient: { include: { baseUnit: true } },
          },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          ...(skip !== undefined ? { skip } : {}),
          take,
          ...(cursorId ? { cursor: { id: cursorId } } : {}),
        }),
      () => this.db.stockBalance.count({ where }),
    );
    return {
      data,
      message: "Lấy báo cáo tồn kho thành công.",
      meta,
    };
  }

  async fulfillmentReport(user: AuthUser, query: ReportQueryDto) {
    const where: Prisma.FulfillmentOrderWhereInput = {
      organizationId: user.organizationId,
      destinationStockLocation: {
        ...this.stockLocationScope(user, "report.fulfillment"),
        ...this.facilityFilter(query),
      },
    };
    const { data, meta } = await paginateById(
      query,
      ({ skip, take, cursorId }) =>
        this.db.fulfillmentOrder.findMany({
          where,
          include: {
            supplier: true,
            sourceStockLocation: { include: { facility: true } },
            destinationStockLocation: { include: { facility: true } },
            lines: true,
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
      message: "Lấy báo cáo thực hiện đơn thành công.",
      meta,
    };
  }

  async damageReport(user: AuthUser, query: ReportQueryDto) {
    const where: Prisma.DamageReportWhereInput = {
      stockLocation: {
        facility: { organizationId: user.organizationId },
        ...this.stockLocationScope(user, "report.damage"),
        ...this.facilityFilter(query),
      },
    };
    const { data, meta } = await paginateById(
      query,
      ({ skip, take, cursorId }) =>
        this.db.damageReport.findMany({
          where,
          include: {
            stockLocation: { include: { facility: true } },
            lines: { include: { ingredient: true } },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          ...(skip !== undefined ? { skip } : {}),
          take,
          ...(cursorId ? { cursor: { id: cursorId } } : {}),
        }),
      () => this.db.damageReport.count({ where }),
    );
    return {
      data,
      message: "Lấy báo cáo hàng hỏng thành công.",
      meta,
    };
  }

  async varianceReport(user: AuthUser, query: ReportQueryDto) {
    const where: Prisma.VarianceResultWhereInput = {
      organizationId: user.organizationId,
      stockLocation: {
        ...this.stockLocationScope(user, "report.variance"),
        ...this.facilityFilter(query),
      },
    };
    const { data, meta } = await paginateById(
      query,
      ({ skip, take, cursorId }) =>
        this.db.varianceResult.findMany({
          where,
          include: {
            stockLocation: { include: { facility: true } },
            ingredient: { include: { baseUnit: true } },
            stocktake: true,
          },
          orderBy: [{ calculatedAt: "desc" }, { id: "desc" }],
          ...(skip !== undefined ? { skip } : {}),
          take,
          ...(cursorId ? { cursor: { id: cursorId } } : {}),
        }),
      () => this.db.varianceResult.count({ where }),
    );
    return {
      data,
      message: "Lấy báo cáo hao hụt/chênh lệch thành công.",
      meta,
    };
  }

  async paymentReport(user: AuthUser, query: ReportQueryDto) {
    this.assertInternal(user);
    const where: Prisma.PaymentTrackingWhereInput = {
      order: {
        organizationId: user.organizationId,
        destinationStockLocation: {
          ...this.stockLocationScope(user, "report.payment"),
          ...this.facilityFilter(query),
        },
      },
    };
    const { data, meta } = await paginateById(
      query,
      ({ skip, take, cursorId }) =>
        this.db.paymentTracking.findMany({
          where,
          include: {
            order: {
              include: {
                supplier: true,
                destinationStockLocation: { include: { facility: true } },
              },
            },
          },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          ...(skip !== undefined ? { skip } : {}),
          take,
          ...(cursorId ? { cursor: { id: cursorId } } : {}),
        }),
      () => this.db.paymentTracking.count({ where }),
    );
    return {
      data,
      message: "Lấy báo cáo thanh toán thành công.",
      meta,
    };
  }

  private async loadOrder(user: AuthUser, id: string, permission: string) {
    const order = await this.db.fulfillmentOrder.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        destinationStockLocation: true,
        sourceStockLocation: true,
        lines: true,
      },
    });
    if (!order) this.notFound();
    this.assertOrderScope(user, permission, order);
    return order;
  }

  private assertOrderScope(
    user: AuthUser,
    permission: string,
    order: {
      destinationStockLocationId: string;
      destinationStockLocation: { facilityId: string };
      sourceStockLocationId: string | null;
      sourceStockLocation: { facilityId: string } | null;
    },
  ) {
    const destination = this.scope.canAccess(user, permission, {
      facilityId: order.destinationStockLocation.facilityId,
      stockLocationId: order.destinationStockLocationId,
    });
    const source = order.sourceStockLocation
      ? this.scope.canAccess(user, permission, {
          facilityId: order.sourceStockLocation.facilityId,
          stockLocationId: order.sourceStockLocationId,
        })
      : false;
    if (!destination && !source) this.notFound();
  }

  /** Lọc theo cơ sở do người dùng chọn (AND với phạm vi quyền). */
  private facilityFilter(query: ReportQueryDto): Prisma.StockLocationWhereInput {
    return query.facility_id ? { AND: [{ facilityId: query.facility_id }] } : {};
  }

  private stockLocationScope(
    user: AuthUser,
    permission: string,
  ): Prisma.StockLocationWhereInput {
    const access = this.scope.constraintsFor(user, permission, [
      "facilityId",
      "stockLocationId",
    ]);
    if (access === null) return {};
    return {
      OR: access.map((item) => ({
        ...(item.facilityId ? { facilityId: item.facilityId } : {}),
        ...(item.stockLocationId ? { id: item.stockLocationId } : {}),
      })),
    };
  }

  private reconciledValue(
    lines: Array<{
      receivedQuantity: Prisma.Decimal;
      acceptedExcessQuantity: Prisma.Decimal;
      unitPriceSnapshot: Prisma.Decimal | null;
    }>,
  ) {
    if (lines.some((line) => line.unitPriceSnapshot === null))
      throw new ApiException(
        ErrorCode.DATA_INCOMPLETE,
        "Đơn có dòng chưa có đơn giá snapshot nên chưa thể đối soát.",
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    return lines.reduce(
      (sum, line) =>
        sum.add(
          line.receivedQuantity
            .add(line.acceptedExcessQuantity)
            .mul(line.unitPriceSnapshot!),
        ),
      new Prisma.Decimal(0),
    );
  }

  private assertInternal(user: AuthUser) {
    if (user.kind !== UserKind.INTERNAL) this.notFound();
  }

  private notFound(): never {
    throw new ApiException(
      ErrorCode.RESOURCE_NOT_FOUND,
      "Không tìm thấy dữ liệu đối soát hoặc bạn không có quyền truy cập.",
      HttpStatus.NOT_FOUND,
    );
  }
}
