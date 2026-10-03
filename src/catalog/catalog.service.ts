import { HttpStatus, Injectable } from "@nestjs/common";
import type { AuthUser } from "../auth/auth.types.js";
import { ScopeService } from "../auth/scope.service.js";
import type { PaginationDto } from "../common/dto/pagination.dto.js";
import { ApiException } from "../common/errors/api.exception.js";
import { ErrorCode } from "../common/errors/error-codes.js";
import {
  normalizedSearch,
  paginateById,
  type PaginationMeta,
} from "../common/pagination/pagination.js";
import { PrismaService } from "../database/prisma.service.js";
import { Prisma } from "../generated/prisma/client.js";
import type * as D from "./catalog.dto.js";
@Injectable()
export class CatalogService {
  constructor(
    private db: PrismaService,
    private scope: ScopeService,
  ) {}
  async list(
    u: AuthUser,
    type: "unit" | "group" | "ingredient" | "supplier",
    q: PaginationDto,
  ) {
    const permission =
      type === "unit"
        ? "unit.read"
        : type === "supplier"
          ? "supplier.read"
          : "ingredient.read";
    this.scope.assertAccess(u, permission, {});
    const search = normalizedSearch(q);
    const baseWhere = {
      organizationId: u.organizationId,
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: "insensitive" as const } },
              { name: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    let result: { data: unknown[]; meta: PaginationMeta };
    if (type === "unit")
      result = await paginateById(
        q,
        ({ skip, take, cursorId }) =>
          this.db.unit.findMany({
            where: baseWhere,
            orderBy: [{ code: "asc" }, { id: "asc" }],
            ...(skip !== undefined ? { skip } : {}),
            take,
            ...(cursorId ? { cursor: { id: cursorId } } : {}),
          }),
        () => this.db.unit.count({ where: baseWhere }),
        { searchHandled: true },
      );
    else if (type === "group")
      result = await paginateById(
        q,
        ({ skip, take, cursorId }) =>
          this.db.ingredientGroup.findMany({
            where: baseWhere,
            orderBy: [{ code: "asc" }, { id: "asc" }],
            ...(skip !== undefined ? { skip } : {}),
            take,
            ...(cursorId ? { cursor: { id: cursorId } } : {}),
          }),
        () => this.db.ingredientGroup.count({ where: baseWhere }),
        { searchHandled: true },
      );
    else if (type === "ingredient")
      result = await paginateById(
        q,
        ({ skip, take, cursorId }) =>
          this.db.ingredient.findMany({
            where: baseWhere,
            include: { baseUnit: true, group: true },
            orderBy: [{ code: "asc" }, { id: "asc" }],
            ...(skip !== undefined ? { skip } : {}),
            take,
            ...(cursorId ? { cursor: { id: cursorId } } : {}),
          }),
        () => this.db.ingredient.count({ where: baseWhere }),
        { searchHandled: true },
      );
    else
      result = await paginateById(
        q,
        ({ skip, take, cursorId }) =>
          this.db.supplier.findMany({
            where: baseWhere,
            orderBy: [{ code: "asc" }, { id: "asc" }],
            ...(skip !== undefined ? { skip } : {}),
            take,
            ...(cursorId ? { cursor: { id: cursorId } } : {}),
          }),
        () => this.db.supplier.count({ where: baseWhere }),
        { searchHandled: true },
      );
    return {
      data: result.data,
      message: "Lấy danh sách danh mục thành công.",
      meta: result.meta,
    };
  }
  async unit(u: AuthUser, d: D.CreateUnitDto) {
    this.scope.assertAccess(u, "unit.manage", {});
    return {
      data: await this.db.unit.create({
        data: {
          organizationId: u.organizationId,
          code: d.code.toUpperCase(),
          name: d.name,
          decimalScale: d.decimal_scale ?? 3,
        },
      }),
      message: "Tạo đơn vị thành công.",
    };
  }
  async group(u: AuthUser, d: D.CreateIngredientGroupDto) {
    this.scope.assertAccess(u, "ingredient_group.manage", {});
    return {
      data: await this.db.ingredientGroup.create({
        data: {
          organizationId: u.organizationId,
          code: d.code.toUpperCase(),
          name: d.name,
        },
      }),
      message: "Tạo nhóm nguyên liệu thành công.",
    };
  }
  async ingredient(u: AuthUser, d: D.CreateIngredientDto) {
    this.scope.assertAccess(u, "ingredient.manage", {});
    const [unitCount, groupCount] = await Promise.all([
      this.db.unit.count({
        where: { id: d.base_unit_id, organizationId: u.organizationId },
      }),
      d.group_id
        ? this.db.ingredientGroup.count({
            where: { id: d.group_id, organizationId: u.organizationId },
          })
        : 1,
    ]);
    if (!unitCount || !groupCount) this.invalid();
    return {
      data: await this.db.ingredient.create({
        data: {
          organizationId: u.organizationId,
          code: d.code.toUpperCase(),
          name: d.name,
          baseUnitId: d.base_unit_id,
          ...(d.group_id ? { groupId: d.group_id } : {}),
        },
      }),
      message: "Tạo nguyên liệu thành công.",
    };
  }
  async supplier(u: AuthUser, d: D.CreateSupplierDto) {
    this.scope.assertAccess(u, "supplier.manage", {});
    return {
      data: await this.db.supplier.create({
        data: {
          organizationId: u.organizationId,
          code: d.code.toUpperCase(),
          name: d.name,
          ...(d.phone ? { phone: d.phone } : {}),
          ...(d.email ? { email: d.email } : {}),
        },
      }),
      message: "Tạo nhà cung ứng thành công.",
    };
  }
  async link(u: AuthUser, d: D.LinkSupplierIngredientDto) {
    this.scope.assertAccess(u, "supplier_ingredient.manage", {});
    const [s, i] = await Promise.all([
      this.db.supplier.count({
        where: { id: d.supplier_id, organizationId: u.organizationId },
      }),
      this.db.ingredient.count({
        where: { id: d.ingredient_id, organizationId: u.organizationId },
      }),
    ]);
    if (!s || !i) this.invalid();
    const data = await this.db.supplierIngredient.upsert({
      where: {
        supplierId_ingredientId: {
          supplierId: d.supplier_id,
          ingredientId: d.ingredient_id,
        },
      },
      create: {
        supplierId: d.supplier_id,
        ingredientId: d.ingredient_id,
        ...(d.supplier_sku ? { supplierSku: d.supplier_sku } : {}),
        ...(d.reference_price ? { referencePrice: d.reference_price } : {}),
      },
      update: {
        active: true,
        ...(d.supplier_sku ? { supplierSku: d.supplier_sku } : {}),
        ...(d.reference_price ? { referencePrice: d.reference_price } : {}),
      },
    });
    return {
      data,
      message: "Liên kết nhà cung ứng với nguyên liệu thành công.",
    };
  }
  async conversions(u: AuthUser, q: PaginationDto) {
    this.scope.assertAccess(u, "conversion.read", {});
    const search = normalizedSearch(q);
    const where = {
      ingredient: {
        organizationId: u.organizationId,
        ...(search
          ? {
              OR: [
                { code: { contains: search, mode: "insensitive" as const } },
                { name: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
    };
    const { data, meta } = await paginateById(
      q,
      ({ skip, take, cursorId }) =>
        this.db.ingredientUnitConversion.findMany({
          where,
          include: { ingredient: true, unit: true },
          orderBy: [{ effectiveFrom: "desc" }, { id: "desc" }],
          ...(skip !== undefined ? { skip } : {}),
          take,
          ...(cursorId ? { cursor: { id: cursorId } } : {}),
        }),
      () => this.db.ingredientUnitConversion.count({ where }),
      { searchHandled: true },
    );
    return {
      data,
      message: "Lấy danh sách quy đổi đơn vị thành công.",
      meta,
    };
  }

  async conversion(u: AuthUser, d: D.CreateConversionDto) {
    this.scope.assertAccess(u, "conversion.manage", {});
    const factor = new Prisma.Decimal(d.factor_to_base);
    if (factor.lte(0)) this.invalidMessage("Hệ số quy đổi phải lớn hơn 0.");
    const effectiveFrom = new Date(d.effective_from);
    const effectiveTo = d.effective_to ? new Date(d.effective_to) : null;
    if (effectiveTo && effectiveTo <= effectiveFrom)
      this.invalidMessage("Thời điểm kết thúc phải sau thời điểm bắt đầu.");
    const [ingredient, unit] = await Promise.all([
      this.db.ingredient.findFirst({
        where: {
          id: d.ingredient_id,
          organizationId: u.organizationId,
          active: true,
        },
      }),
      this.db.unit.findFirst({
        where: {
          id: d.unit_id,
          organizationId: u.organizationId,
          active: true,
        },
      }),
    ]);
    if (!ingredient || !unit)
      this.invalidMessage("Nguyên liệu hoặc đơn vị quy đổi không hợp lệ.");
    const overlap = await this.db.ingredientUnitConversion.findFirst({
      where: {
        ingredientId: ingredient.id,
        unitId: unit.id,
        ...(effectiveTo ? { effectiveFrom: { lt: effectiveTo } } : {}),
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }],
      },
    });
    if (overlap)
      this.invalidMessage(
        "Khoảng hiệu lực bị chồng lấn với một phiên bản quy đổi hiện có.",
      );
    const latest = await this.db.ingredientUnitConversion.aggregate({
      where: { ingredientId: ingredient.id, unitId: unit.id },
      _max: { version: true },
    });
    const data = await this.db.ingredientUnitConversion.create({
      data: {
        ingredientId: ingredient.id,
        unitId: unit.id,
        factorToBase: factor,
        version: (latest._max.version ?? 0) + 1,
        effectiveFrom,
        ...(effectiveTo ? { effectiveTo } : {}),
      },
      include: { ingredient: true, unit: true },
    });
    return { data, message: "Tạo phiên bản quy đổi đơn vị thành công." };
  }

  private invalidMessage(message: string): never {
    throw new ApiException(
      ErrorCode.VALIDATION_ERROR,
      message,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }

  private invalid(): never {
    throw new ApiException(
      ErrorCode.VALIDATION_ERROR,
      "Dữ liệu tham chiếu không hợp lệ hoặc khác tổ chức.",
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
