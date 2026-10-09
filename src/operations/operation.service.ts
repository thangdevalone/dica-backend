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
  AdjustmentStatus,
  DamageStatus,
  LedgerEntryType,
  Prisma,
  StocktakeStatus,
} from "../generated/prisma/client.js";
import type {
  AdjustmentListQueryDto,
  CreateAdjustmentDto,
  CreateDamageDto,
  CreateStocktakeDto,
  DamageListQueryDto,
  OperationListQueryDto,
  StocktakeListQueryDto,
  UpdateDamageDto,
  UpdateStocktakeDto,
  VersionDto,
} from "./operation.dto.js";

/** Bộ lọc kho/cơ sở chung cho các danh sách nghiệp vụ kho. */
function locationFilter(query: OperationListQueryDto) {
  if (!query.facility_id && !query.stock_location_id) return {};
  return {
    AND: [
      {
        stockLocation: {
          ...(query.facility_id ? { facilityId: query.facility_id } : {}),
          ...(query.stock_location_id ? { id: query.stock_location_id } : {}),
        },
      },
    ],
  };
}

@Injectable()
export class OperationService {
  constructor(
    private readonly db: PrismaService,
    private readonly scope: ScopeService,
    private readonly config: ConfigService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async adjustments(user: AuthUser, query: AdjustmentListQueryDto) {
    const access = this.scope.constraintsFor(user, "adjustment.read", [
      "facilityId",
      "stockLocationId",
      "createdById",
    ]);
    const where: Prisma.InventoryAdjustmentWhereInput = {
      ...locationFilter(query),
      ...(query.status ? { status: query.status } : {}),
      stockLocation: {
        facility: {
          organizationId: user.organizationId,
        },
      },
      ...(access
        ? {
            OR: access.map((item) => ({
              ...(item.createdById ? { createdById: item.createdById } : {}),
              stockLocation: {
                ...(item.facilityId ? { facilityId: item.facilityId } : {}),
                ...(item.stockLocationId ? { id: item.stockLocationId } : {}),
              },
            })),
          }
        : {}),
    };
    const { data, meta } = await paginateById(
      query,
      ({ skip, take, cursorId }) =>
        this.db.inventoryAdjustment.findMany({
          where,
          include: {
            stockLocation: { include: { facility: true } },
            ingredient: { include: { baseUnit: true } },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          ...(skip !== undefined ? { skip } : {}),
          take,
          ...(cursorId ? { cursor: { id: cursorId } } : {}),
        }),
      () => this.db.inventoryAdjustment.count({ where }),
    );
    return {
      data,
      message: "Lấy danh sách điều chỉnh tồn kho thành công.",
      meta,
    };
  }

  async createAdjustment(user: AuthUser, dto: CreateAdjustmentDto) {
    const location = await this.location(user, dto.stock_location_id);
    this.scope.assertAccess(user, "adjustment.create", {
      facilityId: location.facilityId,
      stockLocationId: location.id,
      createdById: user.id,
    });
    const quantity = new Prisma.Decimal(dto.quantity);
    if (quantity.isZero()) this.invalid("Số lượng điều chỉnh phải khác 0.");
    if (Boolean(dto.source_type) !== Boolean(dto.source_id))
      this.invalid("Loại và mã chứng từ nguồn phải được cung cấp cùng nhau.");
    const ingredient = await this.db.ingredient.findFirst({
      where: {
        id: dto.ingredient_id,
        organizationId: user.organizationId,
        active: true,
      },
    });
    if (!ingredient)
      this.invalid("Nguyên liệu không hợp lệ hoặc đã ngừng sử dụng.");
    const data = await this.db.inventoryAdjustment.create({
      data: {
        stockLocationId: location.id,
        ingredientId: ingredient.id,
        quantity,
        reason: dto.reason,
        createdById: user.id,
        ...(dto.source_type ? { sourceType: dto.source_type } : {}),
        ...(dto.source_id ? { sourceId: dto.source_id } : {}),
      },
      include: { stockLocation: true, ingredient: true },
    });
    return {
      data,
      message:
        "Tạo bản nháp điều chỉnh tồn kho thành công; tồn kho chưa thay đổi.",
    };
  }

  async approveAdjustment(user: AuthUser, id: string, dto: VersionDto) {
    const adjustment = await this.loadAdjustment(user, id);
    this.scope.assertAccess(user, "adjustment.approve", {
      facilityId: adjustment.stockLocation.facilityId,
      stockLocationId: adjustment.stockLocationId,
    });
    if (adjustment.version !== dto.expected_version) this.version();
    if (adjustment.status !== AdjustmentStatus.DRAFT) this.state();
    const data = await this.db.$transaction(async (tx) => {
      const guard = await tx.inventoryAdjustment.updateMany({
        where: {
          id,
          version: dto.expected_version,
          status: AdjustmentStatus.DRAFT,
        },
        data: {
          status: AdjustmentStatus.APPROVED,
          approvedById: user.id,
          approvedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (guard.count !== 1) this.version();
      const updated = await tx.inventoryAdjustment.findUniqueOrThrow({
        where: { id },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: user.organizationId,
          actorId: user.id,
          action: "adjustment.approve",
          resourceType: "InventoryAdjustment",
          resourceId: id,
          requestId: user.requestId,
          beforeData: {
            status: adjustment.status,
            version: adjustment.version,
          },
          afterData: { status: updated.status, version: updated.version },
        },
      });
      return updated;
    });
    return {
      data,
      message: "Duyệt điều chỉnh tồn kho thành công; tồn kho chưa thay đổi.",
    };
  }

  async postAdjustment(
    user: AuthUser,
    id: string,
    dto: VersionDto,
    rawKey?: string,
  ) {
    const key = this.idempotency.requireKey(rawKey);
    const result = await this.idempotency.execute(
      user,
      `adjustment.post:${id}`,
      key,
      dto,
      async (tx) => {
        const adjustment = await tx.inventoryAdjustment.findFirst({
          where: {
            id,
            stockLocation: {
              facility: { organizationId: user.organizationId },
            },
          },
          include: { stockLocation: true },
        });
        if (!adjustment) this.notFound("phiếu điều chỉnh tồn kho");
        this.scope.assertAccess(user, "adjustment.post", {
          facilityId: adjustment.stockLocation.facilityId,
          stockLocationId: adjustment.stockLocationId,
        });
        if (adjustment.version !== dto.expected_version) this.version();
        if (adjustment.status !== AdjustmentStatus.APPROVED) this.state();
        await tx.stockLedgerEntry.create({
          data: {
            stockLocationId: adjustment.stockLocationId,
            ingredientId: adjustment.ingredientId,
            entryType: LedgerEntryType.ADJUSTMENT,
            quantity: adjustment.quantity,
            sourceType: "InventoryAdjustment",
            sourceId: adjustment.id,
            sourceLineId: adjustment.id,
            postingKey: `ADJUSTMENT:${adjustment.id}:${adjustment.stockLocationId}`,
            postedById: user.id,
          },
        });
        const balance = await tx.stockBalance.upsert({
          where: {
            stockLocationId_ingredientId: {
              stockLocationId: adjustment.stockLocationId,
              ingredientId: adjustment.ingredientId,
            },
          },
          create: {
            stockLocationId: adjustment.stockLocationId,
            ingredientId: adjustment.ingredientId,
            quantity: adjustment.quantity,
          },
          update: {
            quantity: { increment: adjustment.quantity },
            version: { increment: 1 },
          },
        });
        const stockQuantity = balance.quantity;
        const updated = await tx.inventoryAdjustment.update({
          where: { id },
          data: {
            status: AdjustmentStatus.POSTED,
            postedById: user.id,
            postedAt: new Date(),
            version: { increment: 1 },
          },
        });
        await tx.auditEvent.create({
          data: {
            organizationId: user.organizationId,
            actorId: user.id,
            action: "adjustment.post",
            resourceType: "InventoryAdjustment",
            resourceId: id,
            requestId: user.requestId,
            beforeData: {
              status: adjustment.status,
              version: adjustment.version,
            },
            afterData: {
              status: updated.status,
              version: updated.version,
              quantity: adjustment.quantity.toString(),
            },
          },
        });
        return {
          adjustment_id: id,
          status: updated.status,
          version: updated.version,
          stock_quantity: stockQuantity.toString(),
        } as Prisma.JsonObject;
      },
    );
    return {
      data: result.value,
      message: result.replayed
        ? "Điều chỉnh tồn kho đã được hạch toán trước đó; trả lại kết quả cũ."
        : "Hạch toán điều chỉnh tồn kho thành công.",
    };
  }

  async stocktakes(user: AuthUser, query: StocktakeListQueryDto) {
    const access = this.scope.constraintsFor(user, "stocktake.read", [
      "facilityId",
      "stockLocationId",
      "createdById",
    ]);
    const where: Prisma.StocktakeWhereInput = {
      ...locationFilter(query),
      ...(query.status ? { status: query.status } : {}),
      stockLocation: {
        facility: {
          organizationId: user.organizationId,
        },
      },
      ...(access
        ? {
            OR: access.map((item) => ({
              ...(item.createdById ? { createdById: item.createdById } : {}),
              stockLocation: {
                ...(item.facilityId ? { facilityId: item.facilityId } : {}),
                ...(item.stockLocationId ? { id: item.stockLocationId } : {}),
              },
            })),
          }
        : {}),
    };
    const { data, meta } = await paginateById(
      query,
      ({ skip, take, cursorId }) =>
        this.db.stocktake.findMany({
          where,
          include: {
            stockLocation: { include: { facility: true } },
            lines: {
              include: { ingredient: { include: { baseUnit: true } } },
            },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          ...(skip !== undefined ? { skip } : {}),
          take,
          ...(cursorId ? { cursor: { id: cursorId } } : {}),
        }),
      () => this.db.stocktake.count({ where }),
    );
    return {
      data,
      message: "Lấy danh sách kiểm kê thành công.",
      meta,
    };
  }

  async createStocktake(user: AuthUser, dto: CreateStocktakeDto) {
    const location = await this.location(user, dto.stock_location_id);
    this.scope.assertAccess(user, "stocktake.create", {
      facilityId: location.facilityId,
      stockLocationId: location.id,
    });
    if (new Date(dto.cutoff_at) > new Date())
      this.invalid("Thời điểm chốt kiểm kê không được nằm trong tương lai.");
    if (
      new Set(dto.lines.map((line) => line.ingredient_id)).size !==
      dto.lines.length
    )
      this.invalid("Một nguyên liệu chỉ được đếm một lần trong phiếu.");
    const ingredientIds = dto.lines.map((line) => line.ingredient_id);
    const validCount = await this.db.ingredient.count({
      where: {
        id: { in: ingredientIds },
        organizationId: user.organizationId,
        active: true,
      },
    });
    if (validCount !== ingredientIds.length)
      this.invalid("Có nguyên liệu không hợp lệ.");
    const data = await this.db.stocktake.create({
      data: {
        stockLocationId: location.id,
        businessDate: new Date(`${dto.business_date}T00:00:00.000Z`),
        cutoffAt: new Date(dto.cutoff_at),
        createdById: user.id,
        lines: {
          create: dto.lines.map((line) => ({
            ingredientId: line.ingredient_id,
            countedQuantity: line.counted_quantity,
            countedById: user.id,
          })),
        },
      },
      include: { lines: true },
    });
    return { data, message: "Tạo bản nháp kiểm kê thành công." };
  }

  async updateStocktake(user: AuthUser, id: string, dto: UpdateStocktakeDto) {
    const location = await this.location(user, dto.stock_location_id);
    this.scope.assertAccess(user, "stocktake.update_draft", {
      facilityId: location.facilityId,
      stockLocationId: location.id,
      createdById: user.id,
    });
    if (new Date(dto.cutoff_at) > new Date())
      this.invalid("Thời điểm chốt kiểm kê không được nằm trong tương lai.");
    if (
      new Set(dto.lines.map((line) => line.ingredient_id)).size !==
      dto.lines.length
    )
      this.invalid("Một nguyên liệu chỉ được đếm một lần trong phiếu.");
    const ingredientIds = dto.lines.map((line) => line.ingredient_id);
    const validCount = await this.db.ingredient.count({
      where: {
        id: { in: ingredientIds },
        organizationId: user.organizationId,
        active: true,
      },
    });
    if (validCount !== ingredientIds.length)
      this.invalid("Có nguyên liệu không hợp lệ.");
    const data = await this.db.$transaction(
      async (tx) => {
        const stocktake = await tx.stocktake.findFirst({
          where: {
            id,
            stockLocation: {
              facility: { organizationId: user.organizationId },
            },
          },
          include: { stockLocation: true },
        });
        if (!stocktake) this.notFound("phiếu kiểm kê");
        this.scope.assertAccess(user, "stocktake.update_draft", {
          facilityId: stocktake.stockLocation.facilityId,
          stockLocationId: stocktake.stockLocationId,
          createdById: stocktake.createdById,
        });
        if (stocktake.version !== dto.expected_version) this.version();
        if (
          stocktake.status !== StocktakeStatus.DRAFT &&
          stocktake.status !== StocktakeStatus.REOPENED
        )
          this.state();
        const guard = await tx.stocktake.updateMany({
          where: {
            id,
            version: dto.expected_version,
            status: stocktake.status,
          },
          data: {
            stockLocationId: location.id,
            businessDate: new Date(`${dto.business_date}T00:00:00.000Z`),
            cutoffAt: new Date(dto.cutoff_at),
            submittedAt: null,
            version: { increment: 1 },
          },
        });
        if (guard.count !== 1) this.version();
        await tx.stocktakeLine.deleteMany({ where: { stocktakeId: id } });
        await tx.stocktakeLine.createMany({
          data: dto.lines.map((line) => ({
            stocktakeId: id,
            ingredientId: line.ingredient_id,
            countedQuantity: line.counted_quantity,
            countedById: user.id,
          })),
        });
        return tx.stocktake.findUniqueOrThrow({
          where: { id },
          include: { lines: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return { data, message: "Cập nhật bản nháp kiểm kê thành công." };
  }

  async submitStocktake(user: AuthUser, id: string, dto: VersionDto) {
    const data = await this.db.$transaction(
      async (tx) => {
        const stocktake = await tx.stocktake.findFirst({
          where: {
            id,
            stockLocation: {
              facility: { organizationId: user.organizationId },
            },
          },
          include: { stockLocation: true },
        });
        if (!stocktake) this.notFound("phiếu kiểm kê");
        this.scope.assertAccess(user, "stocktake.submit", {
          facilityId: stocktake.stockLocation.facilityId,
          stockLocationId: stocktake.stockLocationId,
        });
        if (stocktake.version !== dto.expected_version) this.version();
        if (
          stocktake.status !== StocktakeStatus.DRAFT &&
          stocktake.status !== StocktakeStatus.REOPENED
        )
          this.state();
        // Chụp snapshot cho toàn bộ dòng bằng một câu query để tránh 2N query
        // và rút ngắn thời gian giữ transaction Serializable.
        await tx.$executeRaw`
          WITH movement AS (
            SELECT ingredient_id, COALESCE(SUM(quantity), 0::numeric) AS quantity
            FROM stock_ledger_entries
            WHERE stock_location_id = ${stocktake.stockLocationId}::uuid
              AND posted_at <= ${stocktake.cutoffAt}
            GROUP BY ingredient_id
          ), snapshot AS (
            SELECT line.id,
              COALESCE(movement.quantity, 0::numeric) AS expected_quantity
            FROM stocktake_lines AS line
            LEFT JOIN movement ON movement.ingredient_id = line.ingredient_id
            WHERE line.stocktake_id = ${stocktake.id}::uuid
          )
          UPDATE stocktake_lines AS line
          SET expected_quantity_snapshot = snapshot.expected_quantity,
              variance_quantity = line.counted_quantity - snapshot.expected_quantity
          FROM snapshot
          WHERE line.id = snapshot.id
        `;
        const updated = await tx.stocktake.update({
          where: { id },
          data: {
            status: StocktakeStatus.SUBMITTED,
            submittedAt: new Date(),
            version: { increment: 1 },
          },
          include: { lines: true },
        });
        await tx.auditEvent.create({
          data: {
            organizationId: user.organizationId,
            actorId: user.id,
            action: "stocktake.submit",
            resourceType: "Stocktake",
            resourceId: id,
            requestId: user.requestId,
            afterData: {
              status: "SUBMITTED",
              version: updated.version,
              highlight: updated.lines.some(
                (line) => line.varianceQuantity?.isZero() === false,
              )
                ? "RED"
                : null,
              variances: updated.lines
                .filter((line) => line.varianceQuantity?.isZero() === false)
                .map((line) => ({
                  ingredient_id: line.ingredientId,
                  expected: line.expectedQuantitySnapshot?.toString(),
                  counted: line.countedQuantity.toString(),
                  variance: line.varianceQuantity?.toString(),
                })),
            },
          },
        });
        await tx.outboxEvent.create({
          data: {
            type: "STOCKTAKE_SUBMITTED",
            aggregateType: "Stocktake",
            aggregateId: id,
            payload: { stocktake_id: id },
          },
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return {
      data,
      message:
        "Gửi kiểm kê và chụp số tồn dự kiến thành công; tồn kho chưa bị điều chỉnh.",
    };
  }

  async reopenStocktake(user: AuthUser, id: string, dto: VersionDto) {
    this.assertDemoPolicy(
      "Chính sách mở lại kiểm kê chưa được chốt cho production.",
    );
    const data = await this.db.$transaction(
      async (tx) => {
        const stocktake = await tx.stocktake.findFirst({
          where: {
            id,
            stockLocation: {
              facility: { organizationId: user.organizationId },
            },
          },
          include: { stockLocation: true },
        });
        if (!stocktake) this.notFound("phiếu kiểm kê");
        this.scope.assertAccess(user, "stocktake.reopen", {
          facilityId: stocktake.stockLocation.facilityId,
          stockLocationId: stocktake.stockLocationId,
        });
        if (stocktake.version !== dto.expected_version) this.version();
        if (stocktake.status !== StocktakeStatus.SUBMITTED) this.state();
        const guard = await tx.stocktake.updateMany({
          where: {
            id,
            version: dto.expected_version,
            status: StocktakeStatus.SUBMITTED,
          },
          data: {
            status: StocktakeStatus.REOPENED,
            submittedAt: null,
            version: { increment: 1 },
          },
        });
        if (guard.count !== 1) this.version();
        const updated = await tx.stocktake.findUniqueOrThrow({
          where: { id },
          include: { lines: true },
        });
        await tx.auditEvent.create({
          data: {
            organizationId: user.organizationId,
            actorId: user.id,
            action: "stocktake.reopen",
            resourceType: "Stocktake",
            resourceId: id,
            requestId: user.requestId,
            beforeData: {
              status: stocktake.status,
              version: stocktake.version,
            },
            afterData: { status: updated.status, version: updated.version },
          },
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return { data, message: "Mở lại kiểm kê theo policy demo thành công." };
  }

  async damages(user: AuthUser, query: DamageListQueryDto) {
    const access = this.scope.constraintsFor(user, "damage.read", [
      "facilityId",
      "stockLocationId",
      "createdById",
    ]);
    const where: Prisma.DamageReportWhereInput = {
      ...locationFilter(query),
      ...(query.status ? { status: query.status } : {}),
      stockLocation: {
        facility: {
          organizationId: user.organizationId,
        },
      },
      ...(access
        ? {
            OR: access.map((item) => ({
              ...(item.createdById ? { createdById: item.createdById } : {}),
              stockLocation: {
                ...(item.facilityId ? { facilityId: item.facilityId } : {}),
                ...(item.stockLocationId ? { id: item.stockLocationId } : {}),
              },
            })),
          }
        : {}),
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
      message: "Lấy danh sách báo hỏng thành công.",
      meta,
    };
  }

  async createDamage(user: AuthUser, dto: CreateDamageDto) {
    const location = await this.location(user, dto.stock_location_id);
    this.scope.assertAccess(user, "damage.create", {
      facilityId: location.facilityId,
      stockLocationId: location.id,
      createdById: user.id,
    });
    if (
      new Set(dto.lines.map((line) => line.ingredient_id)).size !==
      dto.lines.length
    )
      this.invalid("Một nguyên liệu chỉ được khai báo một lần.");
    const ingredients = await this.db.ingredient.findMany({
      where: {
        id: { in: dto.lines.map((line) => line.ingredient_id) },
        organizationId: user.organizationId,
        active: true,
      },
      include: { baseUnit: true },
    });
    if (ingredients.length !== dto.lines.length)
      this.invalid("Có nguyên liệu không hợp lệ.");
    for (const line of dto.lines) assertPositiveDecimal(line.quantity);
    const data = await this.db.damageReport.create({
      data: {
        stockLocationId: location.id,
        code: this.code("DMG"),
        reason: dto.reason,
        createdById: user.id,
        lines: {
          create: dto.lines.map((line) => ({
            ingredientId: line.ingredient_id,
            quantity: line.quantity,
            unitCode: ingredients.find(
              (item) => item.id === line.ingredient_id,
            )!.baseUnit.code,
            ...(line.reason ? { reason: line.reason } : {}),
          })),
        },
      },
      include: { lines: true },
    });
    return { data, message: "Tạo bản nháp báo hỏng thành công." };
  }

  async updateDamage(user: AuthUser, id: string, dto: UpdateDamageDto) {
    const location = await this.location(user, dto.stock_location_id);
    this.scope.assertAccess(user, "damage.update_draft", {
      facilityId: location.facilityId,
      stockLocationId: location.id,
      createdById: user.id,
    });
    if (
      new Set(dto.lines.map((line) => line.ingredient_id)).size !==
      dto.lines.length
    )
      this.invalid("Một nguyên liệu chỉ được khai báo một lần.");
    const ingredients = await this.db.ingredient.findMany({
      where: {
        id: { in: dto.lines.map((line) => line.ingredient_id) },
        organizationId: user.organizationId,
        active: true,
      },
      include: { baseUnit: true },
    });
    if (ingredients.length !== dto.lines.length)
      this.invalid("Có nguyên liệu không hợp lệ.");
    for (const line of dto.lines) assertPositiveDecimal(line.quantity);
    const data = await this.db.$transaction(
      async (tx) => {
        const report = await tx.damageReport.findFirst({
          where: {
            id,
            stockLocation: {
              facility: { organizationId: user.organizationId },
            },
          },
          include: { stockLocation: true },
        });
        if (!report) this.notFound("báo hỏng");
        this.scope.assertAccess(user, "damage.update_draft", {
          facilityId: report.stockLocation.facilityId,
          stockLocationId: report.stockLocationId,
          createdById: report.createdById,
        });
        if (report.version !== dto.expected_version) this.version();
        if (report.status !== DamageStatus.DRAFT) this.state();
        const guard = await tx.damageReport.updateMany({
          where: {
            id,
            version: dto.expected_version,
            status: DamageStatus.DRAFT,
          },
          data: {
            stockLocationId: location.id,
            reason: dto.reason,
            version: { increment: 1 },
          },
        });
        if (guard.count !== 1) this.version();
        await tx.damageLine.deleteMany({ where: { reportId: id } });
        await tx.damageLine.createMany({
          data: dto.lines.map((line) => ({
            reportId: id,
            ingredientId: line.ingredient_id,
            quantity: line.quantity,
            unitCode: ingredients.find(
              (item) => item.id === line.ingredient_id,
            )!.baseUnit.code,
            reason: line.reason ?? null,
          })),
        });
        return tx.damageReport.findUniqueOrThrow({
          where: { id },
          include: { lines: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return { data, message: "Cập nhật bản nháp báo hỏng thành công." };
  }

  async submitDamage(user: AuthUser, id: string, dto: VersionDto) {
    const report = await this.db.damageReport.findFirst({
      where: {
        id,
        stockLocation: { facility: { organizationId: user.organizationId } },
      },
      include: { stockLocation: true, lines: true },
    });
    if (!report) this.notFound("báo hỏng");
    this.scope.assertAccess(user, "damage.submit", {
      facilityId: report.stockLocation.facilityId,
      stockLocationId: report.stockLocationId,
      createdById: report.createdById,
    });
    if (report.version !== dto.expected_version) this.version();
    if (report.status !== DamageStatus.DRAFT) this.state();
    const data = await this.db.$transaction(
      async (tx) => {
        const images = await tx.attachment.count({
          where: {
            organizationId: user.organizationId,
            resourceType: "DAMAGE_REPORT",
            resourceId: id,
            uploadStatus: "READY",
          },
        });
        if (images < 1 || images > 10)
          this.invalid("Báo hỏng cần từ 1 đến 10 ảnh.");
        const guard = await tx.damageReport.updateMany({
          where: {
            id,
            version: dto.expected_version,
            status: DamageStatus.DRAFT,
          },
          data: {
            status: DamageStatus.SUBMITTED,
            submittedAt: new Date(),
            version: { increment: 1 },
          },
        });
        if (guard.count !== 1) this.version();
        for (const line of [...report.lines].sort((a, b) =>
          a.ingredientId.localeCompare(b.ingredientId),
        )) {
          await tx.stockLedgerEntry.create({
            data: {
              stockLocationId: report.stockLocationId,
              ingredientId: line.ingredientId,
              entryType: LedgerEntryType.DAMAGE,
              quantity: line.quantity.neg(),
              sourceType: "DamageReport",
              sourceId: id,
              sourceLineId: line.id,
              postingKey: `DAMAGE:${line.id}`,
              postedById: user.id,
            },
          });
          await tx.stockBalance.upsert({
            where: {
              stockLocationId_ingredientId: {
                stockLocationId: report.stockLocationId,
                ingredientId: line.ingredientId,
              },
            },
            create: {
              stockLocationId: report.stockLocationId,
              ingredientId: line.ingredientId,
              quantity: line.quantity.neg(),
            },
            update: {
              quantity: { decrement: line.quantity },
              version: { increment: 1 },
            },
          });
        }
        await tx.auditEvent.create({
          data: {
            organizationId: user.organizationId,
            actorId: user.id,
            action: "damage.submit",
            resourceType: "DamageReport",
            resourceId: id,
            requestId: user.requestId,
            afterData: { inventory_posted: true },
          },
        });
        const updated = await tx.damageReport.findUniqueOrThrow({
          where: { id },
        });
        await tx.outboxEvent.create({
          data: {
            type: "DAMAGE_SUBMITTED",
            aggregateType: "DamageReport",
            aggregateId: id,
            payload: { damage_report_id: id },
          },
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return {
      data,
      message: "Gửi báo hỏng và ghi giảm tồn kho thành công.",
    };
  }

  async confirmDamage(user: AuthUser, id: string, dto: VersionDto) {
    const report = await this.db.damageReport.findFirst({
      where: {
        id,
        stockLocation: { facility: { organizationId: user.organizationId } },
      },
      include: { stockLocation: true },
    });
    if (!report) this.notFound("báo hỏng");
    this.scope.assertAccess(user, "damage.confirm", {
      facilityId: report.stockLocation.facilityId,
      stockLocationId: report.stockLocationId,
    });
    if (report.version !== dto.expected_version) this.version();
    if (report.status !== DamageStatus.SUBMITTED) this.state();
    const data = await this.db.$transaction(async (tx) => {
      const guard = await tx.damageReport.updateMany({
        where: {
          id,
          status: DamageStatus.SUBMITTED,
          version: dto.expected_version,
        },
        data: {
          status: DamageStatus.CONFIRMED,
          confirmedById: user.id,
          confirmedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (guard.count !== 1) this.version();
      const updated = await tx.damageReport.findUniqueOrThrow({
        where: { id },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: user.organizationId,
          actorId: user.id,
          action: "damage.confirm",
          resourceType: "DamageReport",
          resourceId: id,
          requestId: user.requestId,
          afterData: {
            status: "CONFIRMED",
            inventory_posted: true,
            policy: "CUSTOMER_FLOW_20261008",
          },
        },
      });
      await tx.outboxEvent.create({
        data: {
          type: "DAMAGE_CONFIRMED",
          aggregateType: "DamageReport",
          aggregateId: id,
          payload: { damage_report_id: id },
        },
      });
      return updated;
    });
    return {
      data,
      message:
        "Xác nhận báo hỏng thành công; không ghi giảm tồn kho lần thứ hai.",
    };
  }

  private async loadAdjustment(user: AuthUser, id: string) {
    const adjustment = await this.db.inventoryAdjustment.findFirst({
      where: {
        id,
        stockLocation: { facility: { organizationId: user.organizationId } },
      },
      include: { stockLocation: true },
    });
    if (!adjustment) this.notFound("phiếu điều chỉnh tồn kho");
    return adjustment;
  }

  private assertDemoPolicy(message: string) {
    if (!this.config.get<boolean>("DEMO_POLICY_ENABLED", false))
      throw new ApiException(
        ErrorCode.POLICY_NOT_CONFIGURED,
        message,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
  }

  private async location(user: AuthUser, id: string) {
    const location = await this.db.stockLocation.findFirst({
      where: {
        id,
        active: true,
        facility: { organizationId: user.organizationId },
      },
    });
    if (!location) this.notFound("kho");
    return location;
  }

  private code(prefix: string) {
    return `${prefix}-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;
  }

  private version(): never {
    throw new ApiException(
      ErrorCode.VERSION_CONFLICT,
      "Chứng từ đã được cập nhật. Vui lòng tải lại.",
      HttpStatus.CONFLICT,
    );
  }

  private state(): never {
    throw new ApiException(
      ErrorCode.INVALID_STATE,
      "Trạng thái chứng từ không cho phép thao tác.",
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

  private notFound(resource: string): never {
    throw new ApiException(
      ErrorCode.RESOURCE_NOT_FOUND,
      `Không tìm thấy ${resource} hoặc bạn không có quyền truy cập.`,
      HttpStatus.NOT_FOUND,
    );
  }
}
