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
          phone: d.phone,
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
        where: {
          id: d.supplier_id,
          organizationId: u.organizationId,
          active: true,
        },
      }),
      this.db.ingredient.count({
        where: {
          id: d.ingredient_id,
          organizationId: u.organizationId,
          active: true,
        },
      }),
    ]);
    if (!s || !i) this.invalid();
    const data = await this.db.$transaction(async (tx) => {
      if (d.is_preferred)
        await tx.supplierIngredient.updateMany({
          where: { ingredientId: d.ingredient_id, isPreferred: true },
          data: { isPreferred: false },
        });
      return tx.supplierIngredient.upsert({
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
          isPreferred: d.is_preferred ?? false,
        },
        update: {
          active: true,
          ...(d.supplier_sku ? { supplierSku: d.supplier_sku } : {}),
          ...(d.reference_price ? { referencePrice: d.reference_price } : {}),
          ...(d.is_preferred !== undefined
            ? { isPreferred: d.is_preferred }
            : {}),
        },
        include: {
          supplier: true,
          ingredient: { include: { baseUnit: true } },
        },
      });
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

  async supplierIngredients(u: AuthUser, q: D.SupplierIngredientQueryDto) {
    this.scope.assertAccess(u, "supplier_ingredient.read", {});
    const search = normalizedSearch(q);
    const where: Prisma.SupplierIngredientWhereInput = {
      supplier: { organizationId: u.organizationId },
      ...(q.supplier_id ? { supplierId: q.supplier_id } : {}),
      ...(q.ingredient_id ? { ingredientId: q.ingredient_id } : {}),
      ...(search
        ? {
            OR: [
              { supplierSku: { contains: search, mode: "insensitive" } },
              {
                ingredient: {
                  OR: [
                    { code: { contains: search, mode: "insensitive" } },
                    { name: { contains: search, mode: "insensitive" } },
                  ],
                },
              },
              {
                supplier: {
                  OR: [
                    { code: { contains: search, mode: "insensitive" } },
                    { name: { contains: search, mode: "insensitive" } },
                  ],
                },
              },
            ],
          }
        : {}),
    };
    const { data, meta } = await paginateById(
      q,
      ({ skip, take, cursorId }) =>
        this.db.supplierIngredient.findMany({
          where,
          include: {
            supplier: true,
            ingredient: { include: { baseUnit: true } },
          },
          orderBy: [
            { isPreferred: "desc" },
            { supplierId: "asc" },
            { id: "asc" },
          ],
          ...(skip !== undefined ? { skip } : {}),
          take,
          ...(cursorId ? { cursor: { id: cursorId } } : {}),
        }),
      () => this.db.supplierIngredient.count({ where }),
      { searchHandled: true },
    );
    return {
      data,
      message: "Lấy danh sách nguyên liệu theo nhà cung ứng thành công.",
      meta,
    };
  }

  async updateUnit(u: AuthUser, id: string, d: D.UpdateUnitDto) {
    this.scope.assertAccess(u, "unit.manage", {});
    await this.assertOwned("unit", u, id);
    const data = await this.db.unit.update({
      where: { id },
      data: {
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.decimal_scale !== undefined
          ? { decimalScale: d.decimal_scale }
          : {}),
        ...(d.active !== undefined ? { active: d.active } : {}),
      },
    });
    return { data, message: "Cập nhật đơn vị thành công." };
  }

  async updateGroup(u: AuthUser, id: string, d: D.UpdateIngredientGroupDto) {
    this.scope.assertAccess(u, "ingredient_group.manage", {});
    await this.assertOwned("group", u, id);
    const data = await this.db.ingredientGroup.update({
      where: { id },
      data: {
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.active !== undefined ? { active: d.active } : {}),
      },
    });
    return { data, message: "Cập nhật nhóm nguyên liệu thành công." };
  }

  async updateIngredient(u: AuthUser, id: string, d: D.UpdateIngredientDto) {
    this.scope.assertAccess(u, "ingredient.manage", {});
    await this.assertOwned("ingredient", u, id);
    if (d.group_id) {
      const group = await this.db.ingredientGroup.count({
        where: { id: d.group_id, organizationId: u.organizationId },
      });
      if (!group) this.invalid();
    }
    const data = await this.db.$transaction(async (tx) => {
      if (d.active === false)
        await tx.supplierIngredient.updateMany({
          where: { ingredientId: id, isPreferred: true },
          data: { isPreferred: false },
        });
      return tx.ingredient.update({
        where: { id },
        data: {
          ...(d.name !== undefined ? { name: d.name } : {}),
          ...(d.group_id !== undefined ? { groupId: d.group_id } : {}),
          ...(d.active !== undefined ? { active: d.active } : {}),
        },
        include: { baseUnit: true, group: true },
      });
    });
    return { data, message: "Cập nhật nguyên liệu thành công." };
  }

  async updateSupplier(u: AuthUser, id: string, d: D.UpdateSupplierDto) {
    this.scope.assertAccess(u, "supplier.manage", {});
    await this.assertOwned("supplier", u, id);
    const data = await this.db.$transaction(async (tx) => {
      if (d.active === false)
        await tx.supplierIngredient.updateMany({
          where: { supplierId: id, isPreferred: true },
          data: { isPreferred: false },
        });
      return tx.supplier.update({
        where: { id },
        data: {
          ...(d.name !== undefined ? { name: d.name } : {}),
          ...(d.phone !== undefined ? { phone: d.phone } : {}),
          ...(d.email !== undefined ? { email: d.email || null } : {}),
          ...(d.active !== undefined ? { active: d.active } : {}),
        },
      });
    });
    return { data, message: "Cập nhật nhà cung ứng thành công." };
  }

  async updateSupplierIngredient(
    u: AuthUser,
    id: string,
    d: D.UpdateSupplierIngredientDto,
  ) {
    this.scope.assertAccess(u, "supplier_ingredient.manage", {});
    const existing = await this.db.supplierIngredient.findFirst({
      where: { id, supplier: { organizationId: u.organizationId } },
      include: {
        supplier: { select: { active: true } },
        ingredient: { select: { active: true } },
      },
    });
    if (!existing) this.notFound();
    if (
      d.is_preferred &&
      (d.active === false ||
        (!existing.active && d.active !== true) ||
        !existing.supplier.active ||
        !existing.ingredient.active)
    )
      this.invalidMessage("Nhà cung cấp ưu tiên phải đang hoạt động.");
    const data = await this.db.$transaction(async (tx) => {
      if (d.is_preferred)
        await tx.supplierIngredient.updateMany({
          where: {
            ingredientId: existing.ingredientId,
            isPreferred: true,
            id: { not: id },
          },
          data: { isPreferred: false },
        });
      return tx.supplierIngredient.update({
        where: { id },
        data: {
          ...(d.supplier_sku !== undefined
            ? { supplierSku: d.supplier_sku || null }
            : {}),
          ...(d.reference_price !== undefined
            ? { referencePrice: d.reference_price }
            : {}),
          ...(d.active !== undefined ? { active: d.active } : {}),
          ...(d.active === false
            ? { isPreferred: false }
            : d.is_preferred !== undefined
              ? { isPreferred: d.is_preferred }
              : {}),
        },
        include: {
          supplier: true,
          ingredient: { include: { baseUnit: true } },
        },
      });
    });
    return {
      data,
      message: "Cập nhật liên kết nhà cung ứng - nguyên liệu thành công.",
    };
  }

  private async assertOwned(
    type: "unit" | "group" | "ingredient" | "supplier",
    u: AuthUser,
    id: string,
  ) {
    const where = { id, organizationId: u.organizationId };
    const count =
      type === "unit"
        ? await this.db.unit.count({ where })
        : type === "group"
          ? await this.db.ingredientGroup.count({ where })
          : type === "ingredient"
            ? await this.db.ingredient.count({ where })
            : await this.db.supplier.count({ where });
    if (!count) this.notFound();
  }

  private notFound(): never {
    throw new ApiException(
      ErrorCode.RESOURCE_NOT_FOUND,
      "Không tìm thấy dữ liệu danh mục hoặc bạn không có quyền truy cập.",
      HttpStatus.NOT_FOUND,
    );
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
