import { HttpStatus, Injectable } from "@nestjs/common";
import type { AuthUser } from "../auth/auth.types.js";
import { ScopeService } from "../auth/scope.service.js";
import { ApiException } from "../common/errors/api.exception.js";
import { ErrorCode } from "../common/errors/error-codes.js";
import { IdempotencyService } from "../common/idempotency/idempotency.service.js";
import {
  normalizedSearch,
  paginateById,
} from "../common/pagination/pagination.js";
import { assertPositiveDecimal } from "../common/utils/decimal.js";
import { notifyPermission } from "../common/utils/notify.js";
import { PrismaService } from "../database/prisma.service.js";
import {
  Prisma,
  SalesImportStatus,
  StocktakeStatus,
  VarianceDataStatus,
} from "../generated/prisma/client.js";
import type {
  CreateAlertRuleDto,
  CreateMappingDto,
  CreateRecipeDto,
  CreateSalesImportDto,
  IposListQueryDto,
  RecalculateVarianceDto,
  RecipeListQueryDto,
  VarianceListQueryDto,
} from "./ipos.dto.js";

@Injectable()
export class IposService {
  constructor(
    private readonly db: PrismaService,
    private readonly scope: ScopeService,
    private readonly idempotency: IdempotencyService,
  ) {}

  adapterStatus() {
    return {
      data: {
        adapter: "MANUAL_IMPORT",
        real_ipos_api_connected: false,
        status: "WAITING_FOR_OPEN_05",
      },
      message:
        "Chưa tích hợp API iPOS thật; hiện dùng contract import thủ công cho demo.",
    };
  }

  async cancelSale(
    user: AuthUser,
    id: string,
    reason: string,
    rawKey?: string,
  ) {
    const result = await this.idempotency.execute(
      user,
      `sale.cancel:${id}`,
      this.idempotency.requireKey(rawKey),
      { reason },
      async (tx) => {
        const record = await tx.salesRecord.findFirst({
          where: { id, organizationId: user.organizationId },
          include: { batch: true },
        });
        if (!record) this.notFound("dữ liệu bán hàng");
        this.scope.assertAccess(user, "sales_import.commit", {
          facilityId: record.batch.facilityId,
        });
        if (record.cancelledAt) return { sales_record_id: id, cancelled: true };
        await tx.salesRecord.update({
          where: { id },
          data: { cancelledAt: new Date(), cancellationReason: reason },
        });
        await tx.varianceResult.updateMany({
          where: {
            organizationId: user.organizationId,
            stockLocation: { facilityId: record.batch.facilityId },
            stocktake: { cutoffAt: { gte: record.soldAt } },
          },
          data: {
            dataStatus: "DATA_INCOMPLETE",
            missingData: {
              reason: "SALES_RECORD_CANCELLED",
              sales_record_id: id,
            },
          },
        });
        await tx.auditEvent.create({
          data: {
            organizationId: user.organizationId,
            actorId: user.id,
            action: "sales_record.cancel",
            resourceType: "SalesRecord",
            resourceId: id,
            requestId: user.requestId,
            afterData: {
              external_key: record.externalKey,
              reason,
              original_quantity: record.quantity.toString(),
            },
          },
        });
        await notifyPermission(
          tx,
          user.organizationId,
          "variance.read",
          { facilityId: record.batch.facilityId },
          "Dữ liệu hóa đơn đã bị hủy",
          `Bản ghi ${record.externalKey} đã hủy: ${reason}. Cần tính lại báo cáo tiêu hao liên quan.`,
          "SalesRecord",
          id,
        );
        return { sales_record_id: id, cancelled: true };
      },
    );
    return {
      data: result.value,
      message: "Đã lưu lịch sử hủy và gửi thông báo.",
    };
  }

  async salesImports(user: AuthUser, query: IposListQueryDto) {
    const facilityIds = this.scope.facilityIds(user, "sales_import.read");
    const where: Prisma.SalesImportBatchWhereInput = {
      organizationId: user.organizationId,
      ...(facilityIds ? { facilityId: { in: facilityIds } } : {}),
      ...(query.facility_id
        ? { AND: [{ facilityId: query.facility_id }] }
        : {}),
    };
    const { data, meta } = await paginateById(
      query,
      ({ skip, take, cursorId }) =>
        this.db.salesImportBatch.findMany({
          where,
          include: { facility: true, _count: { select: { records: true } } },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          ...(skip !== undefined ? { skip } : {}),
          take,
          ...(cursorId ? { cursor: { id: cursorId } } : {}),
        }),
      () => this.db.salesImportBatch.count({ where }),
    );
    return {
      data,
      message: "Lấy danh sách lô import bán hàng thành công.",
      meta,
    };
  }

  async mappings(user: AuthUser, query: IposListQueryDto) {
    const facilityIds = this.scope.facilityIds(user, "ipos_mapping.read");
    const search = normalizedSearch(query);
    const where: Prisma.MenuItemMappingWhereInput = {
      organizationId: user.organizationId,
      ...(facilityIds ? { facilityId: { in: facilityIds } } : {}),
      ...(query.facility_id
        ? { AND: [{ facilityId: query.facility_id }] }
        : {}),
      ...(search
        ? {
            OR: [
              {
                menuItemName: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                externalItemKey: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    };
    const { data, meta } = await paginateById(
      query,
      ({ skip, take, cursorId }) =>
        this.db.menuItemMapping.findMany({
          where,
          include: {
            facility: true,
            _count: { select: { recipeVersions: true } },
          },
          orderBy: [{ menuItemName: "asc" }, { id: "asc" }],
          ...(skip !== undefined ? { skip } : {}),
          take,
          ...(cursorId ? { cursor: { id: cursorId } } : {}),
        }),
      () => this.db.menuItemMapping.count({ where }),
      { searchHandled: true },
    );
    return {
      data,
      message: "Lấy danh sách mapping món iPOS thành công.",
      meta,
    };
  }

  async createMapping(user: AuthUser, dto: CreateMappingDto) {
    this.scope.assertAccess(user, "ipos_mapping.manage", {
      facilityId: dto.facility_id,
    });
    if (
      !(await this.db.facility.count({
        where: {
          id: dto.facility_id,
          organizationId: user.organizationId,
          active: true,
        },
      }))
    )
      this.invalid("Cơ sở không hợp lệ.");
    const data = await this.db.menuItemMapping.upsert({
      where: {
        organizationId_facilityId_source_externalItemKey: {
          organizationId: user.organizationId,
          facilityId: dto.facility_id,
          source: dto.source,
          externalItemKey: dto.external_item_key,
        },
      },
      create: {
        organizationId: user.organizationId,
        facilityId: dto.facility_id,
        source: dto.source,
        externalItemKey: dto.external_item_key,
        menuItemName: dto.menu_item_name,
      },
      update: { menuItemName: dto.menu_item_name, active: true },
    });
    return { data, message: "Cập nhật mapping món iPOS thành công." };
  }

  async recipes(user: AuthUser, query: RecipeListQueryDto) {
    const access = this.scope.constraintsFor(user, "recipe.read", [
      "facilityId",
      "stockLocationId",
    ]);
    const where: Prisma.RecipeVersionWhereInput = {
      mapping: {
        organizationId: user.organizationId,
        ...(query.facility_id ? { facilityId: query.facility_id } : {}),
      },
      ...(query.mapping_id ? { mappingId: query.mapping_id } : {}),
      ...(access
        ? {
            OR: access.map((item) => ({
              ...(item.facilityId
                ? { mapping: { facilityId: item.facilityId } }
                : {}),
              ...(item.stockLocationId
                ? { stockLocationId: item.stockLocationId }
                : {}),
            })),
          }
        : {}),
    };
    const { data, meta } = await paginateById(
      query,
      ({ skip, take, cursorId }) =>
        this.db.recipeVersion.findMany({
          where,
          include: {
            mapping: { include: { facility: true } },
            stockLocation: { include: { facility: true } },
            ingredients: {
              include: { ingredient: { include: { baseUnit: true } } },
            },
          },
          orderBy: [{ effectiveFrom: "desc" }, { id: "desc" }],
          ...(skip !== undefined ? { skip } : {}),
          take,
          ...(cursorId ? { cursor: { id: cursorId } } : {}),
        }),
      () => this.db.recipeVersion.count({ where }),
    );
    return {
      data,
      message: "Lấy danh sách phiên bản định mức thành công.",
      meta,
    };
  }

  async createRecipe(user: AuthUser, dto: CreateRecipeDto) {
    const mapping = await this.db.menuItemMapping.findFirst({
      where: {
        id: dto.mapping_id,
        organizationId: user.organizationId,
        active: true,
      },
    });
    if (!mapping) this.invalid("Mapping món không hợp lệ.");
    const location = await this.db.stockLocation.findFirst({
      where: {
        id: dto.stock_location_id,
        facilityId: mapping.facilityId,
        active: true,
      },
    });
    if (!location)
      this.invalid("Kho tiêu thụ không thuộc cơ sở của mapping món.");
    this.scope.assertAccess(user, "recipe.manage", {
      facilityId: mapping.facilityId,
      stockLocationId: location.id,
    });
    if (
      new Set(dto.ingredients.map((item) => item.ingredient_id)).size !==
      dto.ingredients.length
    )
      this.invalid("Nguyên liệu trong định mức bị trùng.");
    const ingredientCount = await this.db.ingredient.count({
      where: {
        id: { in: dto.ingredients.map((item) => item.ingredient_id) },
        organizationId: user.organizationId,
        active: true,
      },
    });
    if (ingredientCount !== dto.ingredients.length)
      this.invalid("Có nguyên liệu không hợp lệ.");
    for (const item of dto.ingredients) {
      if (Number(item.base_quantity) <= 0)
        this.invalid("Định lượng phải lớn hơn 0.");
    }
    const effectiveFrom = new Date(dto.effective_from);
    const effectiveTo = dto.effective_to ? new Date(dto.effective_to) : null;
    if (effectiveTo && effectiveTo <= effectiveFrom)
      this.invalid("Thời gian kết thúc phải sau thời gian bắt đầu.");
    const overlap = await this.db.recipeVersion.count({
      where: {
        mappingId: mapping.id,
        stockLocationId: location.id,
        effectiveFrom: {
          lt: effectiveTo ?? new Date("9999-12-31T00:00:00.000Z"),
        },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }],
      },
    });
    if (overlap)
      this.invalid("Khoảng hiệu lực định mức bị chồng lấn phiên bản hiện có.");
    const latest = await this.db.recipeVersion.findFirst({
      where: { mappingId: mapping.id },
      orderBy: { version: "desc" },
    });
    const data = await this.db.recipeVersion.create({
      data: {
        mappingId: mapping.id,
        stockLocationId: location.id,
        version: (latest?.version ?? 0) + 1,
        effectiveFrom,
        effectiveTo,
        createdById: user.id,
        ingredients: {
          create: dto.ingredients.map((item) => ({
            ingredientId: item.ingredient_id,
            baseQuantity: item.base_quantity,
          })),
        },
      },
      include: { ingredients: true },
    });
    return { data, message: "Tạo phiên bản định mức thành công." };
  }

  async createImport(user: AuthUser, dto: CreateSalesImportDto) {
    this.scope.assertAccess(user, "sales_import.create", {
      facilityId: dto.facility_id,
    });
    if (
      !(await this.db.facility.count({
        where: {
          id: dto.facility_id,
          organizationId: user.organizationId,
          active: true,
        },
      }))
    )
      this.invalid("Cơ sở import không hợp lệ.");
    if (
      new Set(dto.records.map((item) => item.external_key)).size !==
      dto.records.length
    )
      this.invalid("External key trong batch bị trùng.");
    for (const record of dto.records) assertPositiveDecimal(record.quantity);
    const existing = await this.db.salesRecord.findMany({
      where: {
        organizationId: user.organizationId,
        source: dto.source,
        externalKey: { in: dto.records.map((item) => item.external_key) },
      },
      select: { externalKey: true },
    });
    if (existing.length)
      throw new ApiException(
        ErrorCode.VERSION_CONFLICT,
        "Có bản ghi bán hàng đã được import trước đó; hệ thống không nhân đôi dữ liệu.",
        HttpStatus.CONFLICT,
        { external_keys: existing.map((item) => item.externalKey) },
      );
    const mappings = await this.db.menuItemMapping.findMany({
      where: {
        organizationId: user.organizationId,
        facilityId: dto.facility_id,
        source: dto.source,
        externalItemKey: {
          in: dto.records.map((item) => item.external_item_key),
        },
        active: true,
      },
    });
    const data = await this.db.salesImportBatch.create({
      data: {
        organizationId: user.organizationId,
        facilityId: dto.facility_id,
        source: dto.source,
        externalKey: dto.external_batch_key,
        createdById: user.id,
        records: {
          create: dto.records.map((record) => {
            const mapping = mappings.find(
              (item) => item.externalItemKey === record.external_item_key,
            );
            return {
              organizationId: user.organizationId,
              source: dto.source,
              externalKey: record.external_key,
              externalItemKey: record.external_item_key,
              soldAt: new Date(record.sold_at),
              quantity: record.quantity,
              mappingId: mapping?.id ?? null,
              validationError: mapping ? null : "MISSING_MENU_MAPPING",
            };
          }),
        },
      },
      include: { records: true },
    });
    return {
      data,
      message: "Tạo batch import bán hàng ở vùng staging thành công.",
    };
  }

  async validateImport(user: AuthUser, id: string) {
    const batch = await this.loadBatch(user, id, "sales_import.create");
    if (batch.status === SalesImportStatus.COMMITTED)
      this.state("Batch đã commit.");
    const errors: Array<{ record_id: string; code: string }> = [];
    const mappingIds = [
      ...new Set(
        batch.records.flatMap((record) =>
          record.mappingId ? [record.mappingId] : [],
        ),
      ),
    ];
    const recipes = mappingIds.length
      ? await this.db.recipeVersion.findMany({
          where: {
            mappingId: { in: mappingIds },
            stockLocation: { facilityId: batch.facilityId },
          },
          select: {
            mappingId: true,
            effectiveFrom: true,
            effectiveTo: true,
          },
        })
      : [];
    const recipesByMapping = new Map<string, Array<(typeof recipes)[number]>>();
    for (const recipe of recipes)
      recipesByMapping.set(recipe.mappingId, [
        ...(recipesByMapping.get(recipe.mappingId) ?? []),
        recipe,
      ]);
    const missingMappingIds: string[] = [];
    const missingRecipeIds: string[] = [];
    const validIds: string[] = [];
    for (const record of batch.records) {
      let code: string | null = null;
      if (!record.mappingId) code = "MISSING_MENU_MAPPING";
      else if (
        !(recipesByMapping.get(record.mappingId) ?? []).some(
          (recipe) =>
            recipe.effectiveFrom <= record.soldAt &&
            (!recipe.effectiveTo || recipe.effectiveTo > record.soldAt),
        )
      )
        code = "MISSING_RECIPE_VERSION";
      if (code) errors.push({ record_id: record.id, code });
      if (code === "MISSING_MENU_MAPPING") missingMappingIds.push(record.id);
      else if (code === "MISSING_RECIPE_VERSION")
        missingRecipeIds.push(record.id);
      else validIds.push(record.id);
    }
    await this.db.$transaction(async (tx) => {
      const updates = [
        [missingMappingIds, "MISSING_MENU_MAPPING"],
        [missingRecipeIds, "MISSING_RECIPE_VERSION"],
        [validIds, null],
      ] as const;
      for (const [recordIds, validationError] of updates)
        if (recordIds.length)
          await tx.salesRecord.updateMany({
            where: { batchId: id, id: { in: recordIds } },
            data: { validationError },
          });
      await tx.salesImportBatch.update({
        where: { id },
        data: {
          status: errors.length
            ? SalesImportStatus.DATA_INCOMPLETE
            : SalesImportStatus.VALIDATED,
          errorSummary: errors.length ? errors : Prisma.JsonNull,
        },
      });
    });
    return {
      data: { batch_id: id, valid: errors.length === 0, errors },
      message: errors.length
        ? "Dữ liệu chưa đủ mapping/định mức; batch chưa thể commit."
        : "Kiểm tra batch import thành công.",
    };
  }

  async previewImport(user: AuthUser, id: string) {
    const batch = await this.loadBatch(user, id, "sales_import.read");
    return {
      data: batch,
      message: "Xem trước batch import bán hàng thành công.",
    };
  }

  async commitImport(user: AuthUser, id: string, rawKey?: string) {
    const key = this.idempotency.requireKey(rawKey);
    const result = await this.idempotency.execute(
      user,
      `sales_import.commit:${id}`,
      key,
      { batch_id: id },
      async (tx) => {
        const batch = await tx.salesImportBatch.findFirst({
          where: { id, organizationId: user.organizationId },
        });
        if (!batch) this.notFound("batch import");
        this.scope.assertAccess(user, "sales_import.commit", {
          facilityId: batch.facilityId,
        });
        if (batch.status !== SalesImportStatus.VALIDATED)
          throw new ApiException(
            ErrorCode.DATA_INCOMPLETE,
            "Batch chưa được validate thành công hoặc còn thiếu dữ liệu.",
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        const updated = await tx.salesImportBatch.update({
          where: { id },
          data: {
            status: SalesImportStatus.COMMITTED,
            committedById: user.id,
            committedAt: new Date(),
          },
        });
        await tx.auditEvent.create({
          data: {
            organizationId: user.organizationId,
            actorId: user.id,
            action: "sales_import.commit",
            resourceType: "SalesImportBatch",
            resourceId: id,
            requestId: user.requestId,
            afterData: { status: "COMMITTED" },
          },
        });
        return {
          batch_id: updated.id,
          status: updated.status,
        } as Prisma.JsonObject;
      },
    );
    return {
      data: result.value,
      message: result.replayed
        ? "Batch đã được commit trước đó; trả lại kết quả cũ."
        : "Commit batch bán hàng thành công.",
    };
  }

  async variances(user: AuthUser, query: VarianceListQueryDto) {
    const access = this.scope.constraintsFor(user, "variance.read", [
      "facilityId",
      "stockLocationId",
    ]);
    const where: Prisma.VarianceResultWhereInput = {
      organizationId: user.organizationId,
      ...(query.stocktake_id ? { stocktakeId: query.stocktake_id } : {}),
      ...(query.data_status ? { dataStatus: query.data_status } : {}),
      ...(query.facility_id
        ? { AND: [{ stockLocation: { facilityId: query.facility_id } }] }
        : {}),
      ...(access
        ? {
            OR: access.map((item) => ({
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
      message: "Lấy kết quả hao hụt/chênh lệch thành công.",
      meta,
    };
  }

  async recalculate(user: AuthUser, dto: RecalculateVarianceDto) {
    const stocktake = await this.db.stocktake.findFirst({
      where: {
        id: dto.stocktake_id,
        status: StocktakeStatus.SUBMITTED,
        stockLocation: { facility: { organizationId: user.organizationId } },
      },
      include: { stockLocation: true, lines: true },
    });
    if (!stocktake) this.notFound("kiểm kê đã submit");
    this.scope.assertAccess(user, "variance.recalculate", {
      facilityId: stocktake.stockLocation.facilityId,
      stockLocationId: stocktake.stockLocationId,
    });
    const previous = await this.db.stocktake.findFirst({
      where: {
        stockLocationId: stocktake.stockLocationId,
        status: StocktakeStatus.SUBMITTED,
        cutoffAt: { lt: stocktake.cutoffAt },
      },
      include: { lines: true },
      orderBy: { cutoffAt: "desc" },
    });
    const startAt =
      previous?.cutoffAt ??
      new Date(
        `${stocktake.businessDate.toISOString().slice(0, 10)}T00:00:00.000Z`,
      );
    const sales = await this.db.salesRecord.findMany({
      where: {
        cancelledAt: null,
        organizationId: user.organizationId,
        soldAt: { gt: startAt, lte: stocktake.cutoffAt },
        batch: { status: SalesImportStatus.COMMITTED },
        mapping: { facilityId: stocktake.stockLocation.facilityId },
      },
      select: {
        externalKey: true,
        mappingId: true,
        soldAt: true,
        quantity: true,
      },
    });
    const mappingIds = [
      ...new Set(
        sales.flatMap((sale) => (sale.mappingId ? [sale.mappingId] : [])),
      ),
    ];
    const recipes = mappingIds.length
      ? await this.db.recipeVersion.findMany({
          where: {
            mappingId: { in: mappingIds },
            stockLocationId: stocktake.stockLocationId,
            effectiveFrom: { lte: stocktake.cutoffAt },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: startAt } }],
          },
          include: { ingredients: true },
          orderBy: { effectiveFrom: "desc" },
        })
      : [];
    const recipesByMapping = new Map<string, Array<(typeof recipes)[number]>>();
    for (const recipe of recipes)
      recipesByMapping.set(recipe.mappingId, [
        ...(recipesByMapping.get(recipe.mappingId) ?? []),
        recipe,
      ]);
    const missingRecipes: string[] = [];
    const usage = new Map<string, Prisma.Decimal>();
    for (const sale of sales) {
      if (!sale.mappingId) {
        missingRecipes.push(sale.externalKey);
        continue;
      }
      const recipe = (recipesByMapping.get(sale.mappingId) ?? []).find(
        (candidate) =>
          candidate.effectiveFrom <= sale.soldAt &&
          (!candidate.effectiveTo || candidate.effectiveTo > sale.soldAt),
      );
      if (!recipe) {
        missingRecipes.push(sale.externalKey);
        continue;
      }
      for (const item of recipe.ingredients) {
        usage.set(
          item.ingredientId,
          (usage.get(item.ingredientId) ?? new Prisma.Decimal(0)).add(
            item.baseQuantity.mul(sale.quantity),
          ),
        );
      }
    }
    const latestVersion = await this.db.varianceResult.aggregate({
      where: { stocktakeId: stocktake.id },
      _max: { version: true },
    });
    const movements = await this.db.stockLedgerEntry.groupBy({
      by: ["ingredientId"],
      where: {
        stockLocationId: stocktake.stockLocationId,
        ingredientId: {
          in: stocktake.lines.map((line) => line.ingredientId),
        },
        postedAt: { gt: startAt, lte: stocktake.cutoffAt },
      },
      _sum: { quantity: true },
    });
    const movementByIngredient = new Map(
      movements.map((movement) => [
        movement.ingredientId,
        movement._sum.quantity ?? new Prisma.Decimal(0),
      ]),
    );
    const version = (latestVersion._max.version ?? 0) + 1;
    const data = await this.db.$transaction(async (tx) => {
      const results = [];
      for (const line of stocktake.lines) {
        const previousLine = previous?.lines.find(
          (item) => item.ingredientId === line.ingredientId,
        );
        const missing: string[] = [];
        if (!previousLine) missing.push("OPENING_STOCK");
        if (missingRecipes.length) missing.push("RECIPE_VERSION");
        const expectedUsage =
          usage.get(line.ingredientId) ?? new Prisma.Decimal(0);
        const postedMovement =
          movementByIngredient.get(line.ingredientId) ?? new Prisma.Decimal(0);
        const complete = missing.length === 0;
        const expectedClosing = complete
          ? previousLine!.countedQuantity.add(postedMovement).sub(expectedUsage)
          : null;
        const variance = expectedClosing
          ? line.countedQuantity.sub(expectedClosing)
          : null;
        const rate =
          variance && !expectedUsage.eq(0)
            ? variance.abs().div(expectedUsage).mul(100)
            : null;
        results.push(
          await tx.varianceResult.create({
            data: {
              organizationId: user.organizationId,
              stocktakeId: stocktake.id,
              stockLocationId: stocktake.stockLocationId,
              ingredientId: line.ingredientId,
              version,
              dataStatus: complete
                ? VarianceDataStatus.COMPLETE
                : VarianceDataStatus.DATA_INCOMPLETE,
              openingStockSnapshot: previousLine?.countedQuantity ?? null,
              postedMovementSnapshot: postedMovement,
              expectedUsageSnapshot: complete ? expectedUsage : null,
              expectedClosingSnapshot: expectedClosing,
              actualClosingSnapshot: line.countedQuantity,
              varianceQuantity: variance,
              varianceRate: rate,
              missingData: missing.length
                ? {
                    codes: missing,
                    sales_record_count: missingRecipes.length,
                    sales_records: missingRecipes.slice(0, 100),
                  }
                : Prisma.JsonNull,
              calculatedById: user.id,
            },
          }),
        );
      }
      await tx.auditEvent.create({
        data: {
          organizationId: user.organizationId,
          actorId: user.id,
          action: "variance.recalculate",
          resourceType: "Stocktake",
          resourceId: stocktake.id,
          requestId: user.requestId,
          afterData: { version, result_count: results.length },
        },
      });
      return results;
    });
    return {
      data,
      message: data.some(
        (item) => item.dataStatus === VarianceDataStatus.DATA_INCOMPLETE,
      )
        ? "Đã tính phiên bản mới nhưng dữ liệu chưa đầy đủ; không phát cảnh báo sai."
        : "Tính lại hao hụt/chênh lệch thành công.",
      meta: { version },
    };
  }

  async createAlertRule(user: AuthUser, dto: CreateAlertRuleDto) {
    this.scope.assertAccess(user, "alert_rule.manage", {
      facilityId: dto.facility_id ?? null,
    });
    const [facilityCount, ingredientCount] = await Promise.all([
      dto.facility_id
        ? this.db.facility.count({
            where: {
              id: dto.facility_id,
              organizationId: user.organizationId,
              active: true,
            },
          })
        : Promise.resolve(1),
      dto.ingredient_id
        ? this.db.ingredient.count({
            where: {
              id: dto.ingredient_id,
              organizationId: user.organizationId,
              active: true,
            },
          })
        : Promise.resolve(1),
    ]);
    if (!facilityCount || !ingredientCount)
      this.invalid("Cơ sở hoặc nguyên liệu của ngưỡng không hợp lệ.");
    const data = await this.db.alertRule.create({
      data: {
        organizationId: user.organizationId,
        facilityId: dto.facility_id ?? null,
        ingredientId: dto.ingredient_id ?? null,
        thresholdType: dto.threshold_type,
        thresholdValue: dto.threshold_value,
        testOnly: true,
        active: false,
      },
    });
    return {
      data,
      message:
        "Tạo ngưỡng thử nghiệm thành công; cảnh báo vận hành chưa được bật khi OPEN-06 chưa chốt.",
    };
  }

  async alertRules(user: AuthUser, query: IposListQueryDto) {
    const facilityIds = this.scope.facilityIds(user, "alert_rule.manage");
    const where: Prisma.AlertRuleWhereInput = {
      organizationId: user.organizationId,
      ...(facilityIds ? { facilityId: { in: facilityIds } } : {}),
      ...(query.facility_id
        ? { AND: [{ facilityId: query.facility_id }] }
        : {}),
    };
    const { data, meta } = await paginateById(
      query,
      ({ skip, take, cursorId }) =>
        this.db.alertRule.findMany({
          where,
          include: {
            facility: true,
            ingredient: { include: { baseUnit: true } },
          },
          orderBy: { id: "desc" },
          ...(skip !== undefined ? { skip } : {}),
          take,
          ...(cursorId ? { cursor: { id: cursorId } } : {}),
        }),
      () => this.db.alertRule.count({ where }),
    );
    return {
      data,
      message: "Lấy danh sách ngưỡng cảnh báo thử nghiệm thành công.",
      meta,
    };
  }

  private async loadBatch(user: AuthUser, id: string, permission: string) {
    const batch = await this.db.salesImportBatch.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { records: { orderBy: { soldAt: "asc" } } },
    });
    if (!batch) this.notFound("batch import");
    this.scope.assertAccess(user, permission, { facilityId: batch.facilityId });
    return batch;
  }

  private state(message: string): never {
    throw new ApiException(
      ErrorCode.INVALID_STATE,
      message,
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
