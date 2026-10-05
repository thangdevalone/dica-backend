import { randomUUID } from "node:crypto";
import { HttpStatus, Injectable } from "@nestjs/common";
import type { AuthUser } from "../auth/auth.types.js";
import { ScopeService } from "../auth/scope.service.js";
import type { PaginationDto } from "../common/dto/pagination.dto.js";
import { ApiException } from "../common/errors/api.exception.js";
import { ErrorCode } from "../common/errors/error-codes.js";
import { IdempotencyService } from "../common/idempotency/idempotency.service.js";
import {
  normalizedSearch,
  paginateById,
} from "../common/pagination/pagination.js";
import { assertPositiveDecimal } from "../common/utils/decimal.js";
import { PrismaService } from "../database/prisma.service.js";
import {
  ApprovalDecision,
  FacilityType,
  OrderSourceType,
  Prisma,
  TransferStatus,
} from "../generated/prisma/client.js";
import type {
  CancelTransferDto,
  CreateTransferLineDto,
  CreateTransferDto,
  RejectTransferDto,
  TransferCommandDto,
  TransferListQueryDto,
  UpdateTransferDto,
} from "./transfer.dto.js";

@Injectable()
export class TransferService {
  constructor(
    private readonly db: PrismaService,
    private readonly scope: ScopeService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async list(user: AuthUser, query: TransferListQueryDto) {
    const access = this.scope.constraintsFor(user, "transfer.read", [
      "facilityId",
      "stockLocationId",
      "createdById",
    ]);
    const search = normalizedSearch(query);
    const filters: Prisma.TransferWhereInput[] = [];
    if (query.facility_id)
      filters.push({
        OR: [
          { fromStockLocation: { facilityId: query.facility_id } },
          { toStockLocation: { facilityId: query.facility_id } },
        ],
      });
    if (search)
      filters.push({
        OR: [
          { code: { contains: search, mode: "insensitive" } },
          { note: { contains: search, mode: "insensitive" } },
        ],
      });
    const where: Prisma.TransferWhereInput = {
      organizationId: user.organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(filters.length ? { AND: filters } : {}),
      ...(access
        ? {
            OR: access.map((item) => {
              const location = {
                ...(item.facilityId ? { facilityId: item.facilityId } : {}),
                ...(item.stockLocationId ? { id: item.stockLocationId } : {}),
              };
              return {
                ...(item.createdById ? { createdById: item.createdById } : {}),
                OR: [
                  { fromStockLocation: location },
                  { toStockLocation: location },
                ],
              };
            }),
          }
        : {}),
    };
    const { data, meta } = await paginateById(
      query,
      ({ skip, take, cursorId }) =>
        this.db.transfer.findMany({
          where,
          include: {
            fromStockLocation: { include: { facility: true } },
            toStockLocation: { include: { facility: true } },
            _count: { select: { lines: true, orders: true } },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          ...(skip !== undefined ? { skip } : {}),
          take,
          ...(cursorId ? { cursor: { id: cursorId } } : {}),
        }),
      () => this.db.transfer.count({ where }),
      { searchHandled: true },
    );
    return {
      data,
      message: "Lấy danh sách điều chuyển thành công.",
      meta,
    };
  }

  async detail(user: AuthUser, id: string) {
    const transfer = await this.db.transfer.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        fromStockLocation: { include: { facility: true } },
        toStockLocation: { include: { facility: true } },
        createdBy: { select: { id: true, username: true, displayName: true } },
        lines: { include: { ingredient: { include: { baseUnit: true } } } },
        approvals: { orderBy: { createdAt: "asc" } },
        orders: { include: { lines: true } },
      },
    });
    if (!transfer) this.notFound();
    const canReadSource = this.scope.canAccess(user, "transfer.read", {
      facilityId: transfer.fromStockLocation.facilityId,
      stockLocationId: transfer.fromStockLocationId,
      createdById: transfer.createdById,
    });
    const canReadDestination = this.scope.canAccess(user, "transfer.read", {
      facilityId: transfer.toStockLocation.facilityId,
      stockLocationId: transfer.toStockLocationId,
      createdById: transfer.createdById,
    });
    if (!canReadSource && !canReadDestination) this.notFound();
    return { data: transfer, message: "Lấy chi tiết điều chuyển thành công." };
  }

  async create(user: AuthUser, dto: CreateTransferDto) {
    if (dto.from_stock_location_id === dto.to_stock_location_id)
      this.invalid("Kho gửi và kho nhận phải khác nhau.");
    const [from, to] = await Promise.all([
      this.db.stockLocation.findFirst({
        where: {
          id: dto.from_stock_location_id,
          active: true,
          facility: { organizationId: user.organizationId, active: true },
        },
        include: { facility: true },
      }),
      this.db.stockLocation.findFirst({
        where: {
          id: dto.to_stock_location_id,
          active: true,
          facility: { organizationId: user.organizationId, active: true },
        },
        include: { facility: true },
      }),
    ]);
    if (!from || !to) this.notFound();
    this.assertPair(
      from.facility.type,
      to.facility.type,
      from.facilityId,
      to.facilityId,
    );
    this.scope.assertAccess(user, "transfer.create", {
      facilityId: from.facilityId,
      stockLocationId: from.id,
    });
    if (
      new Set(dto.lines.map((line) => line.ingredient_id)).size !==
      dto.lines.length
    )
      this.invalid("Một nguyên liệu chỉ được xuất hiện một lần.");
    const lines = await this.prepareLines(user, dto.lines, this.db);
    const data = await this.db.transfer.create({
      data: {
        organizationId: user.organizationId,
        code: this.code("TRF"),
        fromStockLocationId: from.id,
        toStockLocationId: to.id,
        createdById: user.id,
        ...(dto.note ? { note: dto.note } : {}),
        lines: { create: lines },
      },
      include: { lines: true },
    });
    return { data, message: "Tạo bản nháp điều chuyển thành công." };
  }

  async updateDraft(user: AuthUser, id: string, dto: UpdateTransferDto) {
    if (dto.from_stock_location_id === dto.to_stock_location_id)
      this.invalid("Kho gửi và kho nhận phải khác nhau.");
    const data = await this.db.$transaction(
      async (tx) => {
        const transfer = await this.load(tx, user, id);
        this.scope.assertAccess(user, "transfer.update_draft", {
          facilityId: transfer.fromStockLocation.facilityId,
          stockLocationId: transfer.fromStockLocationId,
        });
        this.assertState(
          transfer.status,
          transfer.version,
          TransferStatus.DRAFT,
          dto.expected_version,
        );
        const [from, to] = await Promise.all([
          tx.stockLocation.findFirst({
            where: {
              id: dto.from_stock_location_id,
              active: true,
              facility: { organizationId: user.organizationId, active: true },
            },
            include: { facility: true },
          }),
          tx.stockLocation.findFirst({
            where: {
              id: dto.to_stock_location_id,
              active: true,
              facility: { organizationId: user.organizationId, active: true },
            },
            include: { facility: true },
          }),
        ]);
        if (!from || !to) this.notFound();
        this.assertPair(
          from.facility.type,
          to.facility.type,
          from.facilityId,
          to.facilityId,
        );
        this.scope.assertAccess(user, "transfer.update_draft", {
          facilityId: from.facilityId,
          stockLocationId: from.id,
        });
        if (
          new Set(dto.lines.map((line) => line.ingredient_id)).size !==
          dto.lines.length
        )
          this.invalid("Một nguyên liệu chỉ được xuất hiện một lần.");
        const preparedLines = await this.prepareLines(user, dto.lines, tx);
        const lines: Prisma.TransferLineCreateManyInput[] = preparedLines.map(
          (line) => ({ transferId: id, ...line }),
        );
        const guard = await tx.transfer.updateMany({
          where: {
            id,
            status: TransferStatus.DRAFT,
            version: dto.expected_version,
          },
          data: {
            fromStockLocationId: from.id,
            toStockLocationId: to.id,
            note: dto.note ?? null,
            version: { increment: 1 },
          },
        });
        if (guard.count !== 1) this.version();
        await tx.transferLine.deleteMany({ where: { transferId: id } });
        await tx.transferLine.createMany({ data: lines });
        const updated = await tx.transfer.findUniqueOrThrow({
          where: { id },
          include: { lines: true },
        });
        await tx.auditEvent.create({
          data: {
            organizationId: user.organizationId,
            actorId: user.id,
            action: "transfer.update_draft",
            resourceType: "Transfer",
            resourceId: id,
            requestId: user.requestId,
            beforeData: {
              version: transfer.version,
              from_stock_location_id: transfer.fromStockLocationId,
              to_stock_location_id: transfer.toStockLocationId,
            },
            afterData: {
              version: updated.version,
              from_stock_location_id: updated.fromStockLocationId,
              to_stock_location_id: updated.toStockLocationId,
            },
          },
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return { data, message: "Cập nhật bản nháp điều chuyển thành công." };
  }

  async cancel(user: AuthUser, id: string, dto: CancelTransferDto) {
    const data = await this.db.$transaction(
      async (tx) => {
        const transfer = await this.load(tx, user, id);
        this.scope.assertAccess(user, "transfer.cancel", {
          facilityId: transfer.fromStockLocation.facilityId,
          stockLocationId: transfer.fromStockLocationId,
          createdById: transfer.createdById,
        });
        if (transfer.version !== dto.expected_version) this.version();
        if (
          transfer.status !== TransferStatus.DRAFT &&
          transfer.status !== TransferStatus.SUBMITTED &&
          transfer.status !== TransferStatus.REJECTED
        )
          this.invalidState();
        const guard = await tx.transfer.updateMany({
          where: {
            id,
            version: dto.expected_version,
            status: transfer.status,
            orders: { none: {} },
          },
          data: {
            status: TransferStatus.CANCELLED,
            decidedAt: new Date(),
            version: { increment: 1 },
          },
        });
        if (guard.count !== 1) this.version();
        const updated = await tx.transfer.findUniqueOrThrow({ where: { id } });
        await tx.auditEvent.create({
          data: {
            organizationId: user.organizationId,
            actorId: user.id,
            action: "transfer.cancel",
            resourceType: "Transfer",
            resourceId: id,
            requestId: user.requestId,
            beforeData: { status: transfer.status, version: transfer.version },
            afterData: {
              status: updated.status,
              version: updated.version,
              reason: dto.note,
            },
          },
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return { data, message: "Hủy điều chuyển thành công." };
  }

  async submit(user: AuthUser, id: string, dto: TransferCommandDto) {
    const result = await this.db.$transaction(
      async (tx) => {
        const transfer = await this.load(tx, user, id);
        this.scope.assertAccess(user, "transfer.submit", {
          facilityId: transfer.fromStockLocation.facilityId,
          stockLocationId: transfer.fromStockLocationId,
        });
        this.assertState(
          transfer.status,
          transfer.version,
          TransferStatus.DRAFT,
          dto.expected_version,
        );
        const autoApprove = this.isCentralPair(
          transfer.fromStockLocation.facility.type,
          transfer.toStockLocation.facility.type,
        );
        if (!autoApprove) {
          const submitted = await tx.transfer.update({
            where: { id },
            data: {
              status: TransferStatus.SUBMITTED,
              submittedAt: new Date(),
              version: { increment: 1 },
            },
          });
          await tx.outboxEvent.create({
            data: {
              type: "TRANSFER_SUBMITTED",
              aggregateType: "Transfer",
              aggregateId: id,
              payload: { transfer_id: id },
            },
          });
          return submitted;
        }
        const order = await this.createOrder(tx, transfer);
        await tx.transferApprovalEvent.create({
          data: {
            transferId: id,
            actorId: user.id,
            decision: ApprovalDecision.AUTO_APPROVED,
            policy: "NO_MANAGER_APPROVAL",
            ...(dto.note ? { note: dto.note } : {}),
          },
        });
        await tx.auditEvent.create({
          data: {
            organizationId: user.organizationId,
            actorId: user.id,
            action: "transfer.auto_approve",
            resourceType: "Transfer",
            resourceId: id,
            requestId: user.requestId,
            afterData: { status: "APPROVED", order_id: order.id },
          },
        });
        return tx.transfer.update({
          where: { id },
          data: {
            status: TransferStatus.APPROVED,
            submittedAt: new Date(),
            decidedAt: new Date(),
            version: { increment: 1 },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return {
      data: result,
      message:
        result.status === TransferStatus.APPROVED
          ? "Gửi và tự duyệt điều chuyển Kho tổng/Bếp tổng thành công."
          : "Gửi điều chuyển chờ Quản lý tổng duyệt thành công.",
    };
  }

  async approve(
    user: AuthUser,
    id: string,
    dto: TransferCommandDto,
    rawKey?: string,
  ) {
    const key = this.idempotency.requireKey(rawKey);
    const result = await this.idempotency.execute(
      user,
      `transfer.approve:${id}`,
      key,
      dto,
      async (tx) => {
        const transfer = await this.load(tx, user, id);
        this.scope.assertAccess(user, "transfer.approve", {
          facilityId: transfer.fromStockLocation.facilityId,
        });
        this.assertState(
          transfer.status,
          transfer.version,
          TransferStatus.SUBMITTED,
          dto.expected_version,
        );
        if (
          transfer.fromStockLocation.facility.type !== FacilityType.BRANCH ||
          transfer.toStockLocation.facility.type !== FacilityType.BRANCH
        )
          this.invalid(
            "Chỉ điều chuyển giữa hai chi nhánh mới đi qua bước duyệt này.",
          );
        const order = await this.createOrder(tx, transfer);
        await tx.transferApprovalEvent.create({
          data: {
            transferId: id,
            actorId: user.id,
            decision: ApprovalDecision.APPROVED,
            policy: "MANAGER_APPROVAL",
            ...(dto.note ? { note: dto.note } : {}),
          },
        });
        await tx.transfer.update({
          where: { id },
          data: {
            status: TransferStatus.APPROVED,
            decidedAt: new Date(),
            version: { increment: 1 },
          },
        });
        await tx.auditEvent.create({
          data: {
            organizationId: user.organizationId,
            actorId: user.id,
            action: "transfer.approve",
            resourceType: "Transfer",
            resourceId: id,
            requestId: user.requestId,
            afterData: { status: "APPROVED", order_id: order.id },
          },
        });
        return {
          transfer_id: id,
          status: "APPROVED",
          order_id: order.id,
        } as Prisma.JsonObject;
      },
    );
    return {
      data: result.value,
      message: result.replayed
        ? "Điều chuyển đã được duyệt trước đó; trả lại kết quả cũ."
        : "Duyệt điều chuyển giữa chi nhánh thành công.",
    };
  }

  async reject(user: AuthUser, id: string, dto: RejectTransferDto) {
    const data = await this.db.$transaction(async (tx) => {
      const transfer = await this.load(tx, user, id);
      this.scope.assertAccess(user, "transfer.reject", {
        facilityId: transfer.fromStockLocation.facilityId,
      });
      this.assertState(
        transfer.status,
        transfer.version,
        TransferStatus.SUBMITTED,
        dto.expected_version,
      );
      await tx.transferApprovalEvent.create({
        data: {
          transferId: id,
          actorId: user.id,
          decision: ApprovalDecision.REJECTED,
          policy: "MANAGER_APPROVAL",
          note: dto.note,
        },
      });
      return tx.transfer.update({
        where: { id },
        data: {
          status: TransferStatus.REJECTED,
          decidedAt: new Date(),
          version: { increment: 1 },
        },
      });
    });
    return { data, message: "Từ chối điều chuyển thành công." };
  }

  private async load(tx: Prisma.TransactionClient, user: AuthUser, id: string) {
    const transfer = await tx.transfer.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        fromStockLocation: { include: { facility: true } },
        toStockLocation: { include: { facility: true } },
        lines: true,
      },
    });
    if (!transfer) this.notFound();
    return transfer;
  }

  private async createOrder(
    tx: Prisma.TransactionClient,
    transfer: Awaited<ReturnType<TransferService["load"]>>,
  ) {
    return tx.fulfillmentOrder.create({
      data: {
        organizationId: transfer.organizationId,
        transferId: transfer.id,
        code: this.code("ORD"),
        sourceType: OrderSourceType.STOCK,
        sourceStockLocationId: transfer.fromStockLocationId,
        destinationStockLocationId: transfer.toStockLocationId,
        releasedAt: new Date(),
        lines: {
          create: transfer.lines.map((line) => ({
            transferLineId: line.id,
            ingredientId: line.ingredientId,
            approvedQuantity: line.quantity,
            unitCodeSnapshot: line.unitCodeSnapshot,
          })),
        },
      },
    });
  }

  private assertPair(
    from: FacilityType,
    to: FacilityType,
    fromId: string,
    toId: string,
  ) {
    const central = this.isCentralPair(from, to);
    const branches =
      from === FacilityType.BRANCH &&
      to === FacilityType.BRANCH &&
      fromId !== toId;
    if (!central && !branches)
      this.invalid(
        "Chỉ hỗ trợ Kho tổng ↔ Bếp tổng hoặc chi nhánh ↔ chi nhánh.",
      );
  }

  private isCentralPair(from: FacilityType, to: FacilityType) {
    return (
      (from === FacilityType.CENTRAL_WAREHOUSE &&
        to === FacilityType.CENTRAL_KITCHEN) ||
      (from === FacilityType.CENTRAL_KITCHEN &&
        to === FacilityType.CENTRAL_WAREHOUSE)
    );
  }

  private async prepareLines(
    user: AuthUser,
    requestedLines: CreateTransferLineDto[],
    tx: Prisma.TransactionClient | PrismaService,
  ) {
    requestedLines.forEach((line) => assertPositiveDecimal(line.quantity));
    const ingredientIds = requestedLines.map((line) => line.ingredient_id);
    const unitIds = [...new Set(requestedLines.map((line) => line.unit_id))];
    const now = new Date();
    const [ingredients, units, conversions] = await Promise.all([
      tx.ingredient.findMany({
        where: {
          id: { in: ingredientIds },
          organizationId: user.organizationId,
          active: true,
        },
        include: { baseUnit: true },
      }),
      tx.unit.findMany({
        where: {
          id: { in: unitIds },
          organizationId: user.organizationId,
          active: true,
        },
      }),
      tx.ingredientUnitConversion.findMany({
        where: {
          ingredientId: { in: ingredientIds },
          unitId: { in: unitIds },
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
        },
        orderBy: { version: "desc" },
      }),
    ]);
    const ingredientById = new Map(
      ingredients.map((ingredient) => [ingredient.id, ingredient]),
    );
    const unitIdSet = new Set(units.map((unit) => unit.id));
    const conversionByPair = new Map<string, (typeof conversions)[number]>();
    for (const conversion of conversions) {
      const key = `${conversion.ingredientId}:${conversion.unitId}`;
      if (!conversionByPair.has(key)) conversionByPair.set(key, conversion);
    }
    return requestedLines.map((line) => {
      const ingredient = ingredientById.get(line.ingredient_id);
      if (!ingredient)
        this.invalid("Nguyên liệu không hợp lệ hoặc đã ngừng hoạt động.");
      if (!unitIdSet.has(line.unit_id))
        this.invalid("Đơn vị không tồn tại hoặc khác tổ chức.");
      const factor =
        line.unit_id === ingredient.baseUnitId
          ? new Prisma.Decimal(1)
          : conversionByPair.get(`${line.ingredient_id}:${line.unit_id}`)
              ?.factorToBase;
      if (!factor) this.invalid("Chưa có quy đổi cho đơn vị đã chọn.");
      return {
        ingredientId: ingredient.id,
        quantity: new Prisma.Decimal(line.quantity).mul(factor),
        ingredientNameSnapshot: ingredient.name,
        unitCodeSnapshot: ingredient.baseUnit.code,
      };
    });
  }

  private assertState(
    actual: TransferStatus,
    actualVersion: number,
    expected: TransferStatus,
    expectedVersion: number,
  ) {
    if (actualVersion !== expectedVersion)
      throw new ApiException(
        ErrorCode.VERSION_CONFLICT,
        "Phiếu đã được cập nhật. Vui lòng tải lại.",
        HttpStatus.CONFLICT,
      );
    if (actual !== expected)
      throw new ApiException(
        ErrorCode.INVALID_STATE,
        `Không thể thao tác khi phiếu ở trạng thái ${actual}.`,
        HttpStatus.CONFLICT,
      );
  }

  private code(prefix: string) {
    return `${prefix}-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;
  }

  private version(): never {
    throw new ApiException(
      ErrorCode.VERSION_CONFLICT,
      "Phiếu đã được cập nhật. Vui lòng tải lại.",
      HttpStatus.CONFLICT,
    );
  }

  private invalidState(): never {
    throw new ApiException(
      ErrorCode.INVALID_STATE,
      "Trạng thái điều chuyển không cho phép thao tác.",
      HttpStatus.CONFLICT,
    );
  }

  private invalid(message: string): never {
    throw new ApiException(
      ErrorCode.VALIDATION_ERROR,
      message,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }

  private notFound(): never {
    throw new ApiException(
      ErrorCode.RESOURCE_NOT_FOUND,
      "Không tìm thấy điều chuyển hoặc bạn không có quyền truy cập.",
      HttpStatus.NOT_FOUND,
    );
  }
}
