import { HttpStatus, Injectable } from "@nestjs/common";
import type { AuthUser } from "../auth/auth.types.js";
import { ScopeService } from "../auth/scope.service.js";
import { ApiException } from "../common/errors/api.exception.js";
import { ErrorCode } from "../common/errors/error-codes.js";
import type { PaginationDto } from "../common/dto/pagination.dto.js";
import {
  normalizedSearch,
  paginateById,
} from "../common/pagination/pagination.js";
import { PrismaService } from "../database/prisma.service.js";
import { Prisma, SourceType } from "../generated/prisma/client.js";
import type {
  BulkSourceRuleDto,
  EligibilityListQueryDto,
  GroupEligibilityListQueryDto,
  SourceRuleListQueryDto,
  UpsertEligibilityDto,
  UpsertGroupEligibilityDto,
  UpsertSourceRuleDto,
} from "./sourcing.dto.js";
@Injectable()
export class SourcingService {
  constructor(
    private db: PrismaService,
    private scope: ScopeService,
  ) {}
  async eligibility(u: AuthUser, q: EligibilityListQueryDto) {
    if (q.effective) return this.effectiveEligibility(u, q);
    const access = this.scope.constraintsFor(u, "eligibility.read", [
      "facilityId",
      "departmentId",
    ]);
    const search = normalizedSearch(q);
    const where: Prisma.ItemEligibilityWhereInput = {
      facility: { organizationId: u.organizationId },
      ...(q.facility_id ? { facilityId: q.facility_id } : {}),
      ...(q.department_id ? { departmentId: q.department_id } : {}),
      ...(q.ingredient_id ? { ingredientId: q.ingredient_id } : {}),
      AND: [
        ...(access
          ? [
              {
                OR: access.map((item) => ({
                  ...(item.facilityId ? { facilityId: item.facilityId } : {}),
                  ...(item.departmentId
                    ? { departmentId: item.departmentId }
                    : {}),
                })),
              },
            ]
          : []),
        ...(search
          ? [
              {
                OR: [
                  {
                    ingredient: {
                      name: { contains: search, mode: "insensitive" as const },
                    },
                  },
                  {
                    ingredient: {
                      code: { contains: search, mode: "insensitive" as const },
                    },
                  },
                  {
                    department: {
                      name: { contains: search, mode: "insensitive" as const },
                    },
                  },
                ],
              },
            ]
          : []),
      ],
    };
    const { data, meta } = await paginateById(
      q,
      ({ skip, take, cursorId }) =>
        this.db.itemEligibility.findMany({
          where,
          include: {
            facility: true,
            department: true,
            ingredient: { include: { baseUnit: true } },
          },
          orderBy: [{ id: "asc" }],
          ...(skip !== undefined ? { skip } : {}),
          take,
          ...(cursorId ? { cursor: { id: cursorId } } : {}),
        }),
      () => this.db.itemEligibility.count({ where }),
      { searchHandled: true },
    );
    return {
      data,
      message: "Lấy danh sách hàng được phép xin thành công.",
      meta,
    };
  }

  private async effectiveEligibility(u: AuthUser, q: EligibilityListQueryDto) {
    if (!q.facility_id || !q.department_id)
      this.invalid("Danh sách quyền hiệu lực bắt buộc có cơ sở và bộ phận.");
    this.scope.assertAccess(u, "eligibility.read", {
      facilityId: q.facility_id,
      departmentId: q.department_id,
    });
    const scope = {
      facilityId: q.facility_id,
      departmentId: q.department_id,
    };
    const search = normalizedSearch(q);
    const where: Prisma.IngredientWhereInput = {
      organizationId: u.organizationId,
      active: true,
      ...(q.ingredient_id ? { id: q.ingredient_id } : {}),
      AND: [
        {
          OR: [
            { eligibilities: { some: { ...scope, active: true } } },
            {
              AND: [
                { eligibilities: { none: scope } },
                {
                  group: {
                    is: {
                      active: true,
                      eligibilities: { some: { ...scope, active: true } },
                    },
                  },
                },
              ],
            },
          ],
        },
        ...(search
          ? [
              {
                OR: [
                  { name: { contains: search, mode: "insensitive" as const } },
                  { code: { contains: search, mode: "insensitive" as const } },
                  {
                    group: {
                      is: {
                        name: {
                          contains: search,
                          mode: "insensitive" as const,
                        },
                      },
                    },
                  },
                ],
              },
            ]
          : []),
      ],
    };
    const { data: ingredients, meta } = await paginateById(
      q,
      ({ skip, take, cursorId }) =>
        this.db.ingredient.findMany({
          where,
          include: {
            baseUnit: true,
            eligibilities: { where: scope },
            group: {
              include: {
                eligibilities: { where: { ...scope, active: true } },
              },
            },
          },
          orderBy: [{ id: "asc" }],
          ...(skip !== undefined ? { skip } : {}),
          take,
          ...(cursorId ? { cursor: { id: cursorId } } : {}),
        }),
      () => this.db.ingredient.count({ where }),
      { searchHandled: true },
    );
    const data = ingredients
      .map((ingredient) => {
        const direct = ingredient.eligibilities[0];
        const groupGrant = ingredient.group?.eligibilities[0];
        const active = direct?.active ?? groupGrant?.active ?? false;
        return {
          id: direct?.id ?? ingredient.id,
          facilityId: q.facility_id!,
          departmentId: q.department_id!,
          ingredientId: ingredient.id,
          maxQuantityPerRequest:
            direct !== undefined
              ? direct.maxQuantityPerRequest
              : (groupGrant?.maxQuantityPerRequest ?? null),
          active,
          grantType: direct ? "INGREDIENT" : "GROUP",
          groupEligibilityId: direct ? null : (groupGrant?.id ?? null),
          ingredient: {
            ...ingredient,
            eligibilities: undefined,
            group: ingredient.group
              ? { ...ingredient.group, eligibilities: undefined }
              : null,
          },
        };
      })
      .filter((item) => item.active);
    return {
      data,
      message: "Lấy danh sách hàng được phép yêu cầu có hiệu lực thành công.",
      meta,
    };
  }

  async groupEligibility(u: AuthUser, q: GroupEligibilityListQueryDto) {
    const access = this.scope.constraintsFor(u, "eligibility.read", [
      "facilityId",
      "departmentId",
    ]);
    const search = normalizedSearch(q);
    const where: Prisma.GroupEligibilityWhereInput = {
      facility: { organizationId: u.organizationId },
      ...(q.facility_id ? { facilityId: q.facility_id } : {}),
      ...(q.department_id ? { departmentId: q.department_id } : {}),
      ...(q.ingredient_group_id
        ? { ingredientGroupId: q.ingredient_group_id }
        : {}),
      AND: [
        ...(access
          ? [
              {
                OR: access.map((item) => ({
                  ...(item.facilityId ? { facilityId: item.facilityId } : {}),
                  ...(item.departmentId
                    ? { departmentId: item.departmentId }
                    : {}),
                })),
              },
            ]
          : []),
        ...(search
          ? [
              {
                OR: [
                  {
                    ingredientGroup: {
                      name: { contains: search, mode: "insensitive" as const },
                    },
                  },
                  {
                    ingredientGroup: {
                      code: { contains: search, mode: "insensitive" as const },
                    },
                  },
                  {
                    department: {
                      name: { contains: search, mode: "insensitive" as const },
                    },
                  },
                ],
              },
            ]
          : []),
      ],
    };
    const { data, meta } = await paginateById(
      q,
      ({ skip, take, cursorId }) =>
        this.db.groupEligibility.findMany({
          where,
          include: {
            facility: true,
            department: true,
            ingredientGroup: true,
          },
          orderBy: [{ id: "asc" }],
          ...(skip !== undefined ? { skip } : {}),
          take,
          ...(cursorId ? { cursor: { id: cursorId } } : {}),
        }),
      () => this.db.groupEligibility.count({ where }),
      { searchHandled: true },
    );
    return {
      data,
      message: "Lấy danh sách nhóm hàng được phép yêu cầu thành công.",
      meta,
    };
  }

  async upsertGroupEligibility(u: AuthUser, d: UpsertGroupEligibilityDto) {
    this.scope.assertAccess(u, "eligibility.manage", {
      facilityId: d.facility_id,
      departmentId: d.department_id,
    });
    const [department, group] = await Promise.all([
      this.db.department.count({
        where: {
          id: d.department_id,
          facilityId: d.facility_id,
          facility: { organizationId: u.organizationId },
        },
      }),
      this.db.ingredientGroup.count({
        where: {
          id: d.ingredient_group_id,
          organizationId: u.organizationId,
          active: true,
        },
      }),
    ]);
    if (!department || !group)
      this.invalid("Cơ sở, bộ phận hoặc nhóm nguyên liệu không hợp lệ.");
    const maxQuantity =
      d.max_quantity_per_request === null ||
      d.max_quantity_per_request === undefined
        ? d.max_quantity_per_request
        : new Prisma.Decimal(d.max_quantity_per_request);
    if (maxQuantity instanceof Prisma.Decimal && !maxQuantity.gt(0))
      this.invalid("Giới hạn số lượng gọi phải lớn hơn 0.");
    const data = await this.db.groupEligibility.upsert({
      where: {
        facilityId_departmentId_ingredientGroupId: {
          facilityId: d.facility_id,
          departmentId: d.department_id,
          ingredientGroupId: d.ingredient_group_id,
        },
      },
      create: {
        facilityId: d.facility_id,
        departmentId: d.department_id,
        ingredientGroupId: d.ingredient_group_id,
        ...(maxQuantity !== undefined
          ? { maxQuantityPerRequest: maxQuantity }
          : {}),
        active: d.active ?? true,
      },
      update: {
        ...(maxQuantity !== undefined
          ? { maxQuantityPerRequest: maxQuantity }
          : {}),
        active: d.active ?? true,
      },
      include: {
        facility: true,
        department: true,
        ingredientGroup: true,
      },
    });
    return {
      data,
      message: "Cập nhật quyền yêu cầu theo nhóm hàng thành công.",
    };
  }
  async upsertEligibility(u: AuthUser, d: UpsertEligibilityDto) {
    this.scope.assertAccess(u, "eligibility.manage", {
      facilityId: d.facility_id,
      departmentId: d.department_id,
    });
    const [dep, item] = await Promise.all([
      this.db.department.count({
        where: {
          id: d.department_id,
          facilityId: d.facility_id,
          facility: { organizationId: u.organizationId },
        },
      }),
      this.db.ingredient.count({
        where: { id: d.ingredient_id, organizationId: u.organizationId },
      }),
    ]);
    if (!dep || !item)
      this.invalid("Cơ sở, bộ phận hoặc nguyên liệu không hợp lệ.");
    const maxQuantity =
      d.max_quantity_per_request === null ||
      d.max_quantity_per_request === undefined
        ? d.max_quantity_per_request
        : new Prisma.Decimal(d.max_quantity_per_request);
    if (maxQuantity instanceof Prisma.Decimal && !maxQuantity.gt(0))
      this.invalid("Giới hạn số lượng gọi phải lớn hơn 0.");
    const data = await this.db.itemEligibility.upsert({
      where: {
        facilityId_departmentId_ingredientId: {
          facilityId: d.facility_id,
          departmentId: d.department_id,
          ingredientId: d.ingredient_id,
        },
      },
      create: {
        facilityId: d.facility_id,
        departmentId: d.department_id,
        ingredientId: d.ingredient_id,
        ...(maxQuantity !== undefined
          ? { maxQuantityPerRequest: maxQuantity }
          : {}),
        active: d.active ?? true,
      },
      update: {
        ...(maxQuantity !== undefined
          ? { maxQuantityPerRequest: maxQuantity }
          : {}),
        active: d.active ?? true,
      },
    });
    return { data, message: "Cập nhật quyền xin hàng thành công." };
  }
  async rules(u: AuthUser, q: SourceRuleListQueryDto) {
    const ids = this.scope.facilityIds(u, "source_rule.read");
    const search = normalizedSearch(q);
    const where: Prisma.SourceRuleWhereInput = {
      facility: { organizationId: u.organizationId },
      AND: [
        ...(ids ? [{ facilityId: { in: ids } }] : []),
        ...(q.facility_id ? [{ facilityId: q.facility_id }] : []),
        ...(q.ingredient_id ? [{ ingredientId: q.ingredient_id }] : []),
        ...(q.source_type ? [{ sourceType: q.source_type }] : []),
        ...(search
          ? [
              {
                OR: [
                  {
                    ingredient: {
                      name: { contains: search, mode: "insensitive" as const },
                    },
                  },
                  {
                    ingredient: {
                      code: { contains: search, mode: "insensitive" as const },
                    },
                  },
                ],
              },
            ]
          : []),
      ],
    };
    const { data, meta } = await paginateById(
      q,
      ({ skip, take, cursorId }) =>
        this.db.sourceRule.findMany({
          where,
          include: {
            facility: true,
            ingredient: { include: { baseUnit: true } },
            sourceStockLocation: { include: { facility: true } },
            supplier: true,
          },
          orderBy: [{ effectiveFrom: "desc" }, { id: "desc" }],
          ...(skip !== undefined ? { skip } : {}),
          take,
          ...(cursorId ? { cursor: { id: cursorId } } : {}),
        }),
      () => this.db.sourceRule.count({ where }),
      { searchHandled: true },
    );
    return {
      data,
      message: "Lấy cấu hình nguồn cấp thành công.",
      meta,
    };
  }
  async history(u: AuthUser, id: string, q: PaginationDto) {
    const r = await this.db.sourceRule.findFirst({
      where: { id, facility: { organizationId: u.organizationId } },
    });
    if (!r) this.notFound();
    this.scope.assertAccess(u, "source_rule.read", {
      facilityId: r.facilityId,
    });
    const where = { sourceRuleId: id };
    const { data, meta } = await paginateById(
      q,
      ({ skip, take, cursorId }) =>
        this.db.sourceRuleRevision.findMany({
          where,
          orderBy: [{ revision: "desc" }, { id: "desc" }],
          ...(skip !== undefined ? { skip } : {}),
          take,
          ...(cursorId ? { cursor: { id: cursorId } } : {}),
        }),
      () => this.db.sourceRuleRevision.count({ where }),
    );
    return {
      data,
      message: "Lấy lịch sử cấu hình nguồn thành công.",
      meta,
    };
  }
  async rule(u: AuthUser, d: UpsertSourceRuleDto) {
    this.scope.assertAccess(u, "source_rule.manage", {
      facilityId: d.facility_id,
    });
    const data = await this.db.$transaction((tx) => this.save(tx, u, d));
    return { data, message: "Cập nhật cấu hình nguồn cấp thành công." };
  }
  async bulk(u: AuthUser, d: BulkSourceRuleDto) {
    if (
      new Set(d.items.map((x) => x.facility_id + ":" + x.ingredient_id))
        .size !== d.items.length
    )
      this.invalid("Danh sách có cấu hình bị trùng.");
    d.items.forEach((x) =>
      this.scope.assertAccess(u, "source_rule.bulk_update", {
        facilityId: x.facility_id,
      }),
    );
    const data = await this.db.$transaction(async (tx) => {
      const out = [];
      for (const x of d.items) out.push(await this.save(tx, u, x));
      return out;
    });
    return {
      data,
      message: "Cập nhật nguồn cấp hàng loạt thành công.",
      meta: { total: data.length },
    };
  }
  private async save(
    tx: Prisma.TransactionClient,
    u: AuthUser,
    d: UpsertSourceRuleDto,
  ) {
    const shape =
      d.source_type === SourceType.STOCK
        ? Boolean(d.source_stock_location_id && !d.supplier_id)
        : Boolean(d.supplier_id && !d.source_stock_location_id);
    if (!shape)
      this.invalid(
        "Nguồn kho và nguồn nhà cung ứng phải được khai báo đúng loại.",
      );
    const [f, i, l, s] = await Promise.all([
      tx.facility.count({
        where: {
          id: d.facility_id,
          organizationId: u.organizationId,
          active: true,
        },
      }),
      tx.ingredient.count({
        where: {
          id: d.ingredient_id,
          organizationId: u.organizationId,
          active: true,
        },
      }),
      d.source_stock_location_id
        ? tx.stockLocation.count({
            where: {
              id: d.source_stock_location_id,
              active: true,
              facility: { organizationId: u.organizationId },
            },
          })
        : 0,
      d.supplier_id
        ? tx.supplier.count({
            where: {
              id: d.supplier_id,
              organizationId: u.organizationId,
              active: true,
            },
          })
        : 0,
    ]);
    if (
      !f ||
      !i ||
      (d.source_type === SourceType.STOCK && !l) ||
      (d.source_type === SourceType.SUPPLIER && !s)
    )
      this.invalid("Nguồn cấp không hợp lệ hoặc đã ngừng hoạt động.");
    if (
      d.supplier_id &&
      !(await tx.supplierIngredient.count({
        where: {
          supplierId: d.supplier_id,
          ingredientId: d.ingredient_id,
          active: true,
        },
      }))
    )
      this.invalid("Nhà cung ứng chưa được liên kết với nguyên liệu.");
    const old = await tx.sourceRule.findUnique({
        where: {
          facilityId_ingredientId: {
            facilityId: d.facility_id,
            ingredientId: d.ingredient_id,
          },
        },
      }),
      revision = (old?.revision ?? 0) + 1;
    const data = await tx.sourceRule.upsert({
      where: {
        facilityId_ingredientId: {
          facilityId: d.facility_id,
          ingredientId: d.ingredient_id,
        },
      },
      create: {
        facilityId: d.facility_id,
        ingredientId: d.ingredient_id,
        sourceType: d.source_type,
        sourceStockLocationId: d.source_stock_location_id ?? null,
        supplierId: d.supplier_id ?? null,
        revision,
      },
      update: {
        sourceType: d.source_type,
        sourceStockLocationId: d.source_stock_location_id ?? null,
        supplierId: d.supplier_id ?? null,
        revision,
        active: true,
      },
    });
    await tx.sourceRuleRevision.create({
      data: {
        sourceRuleId: data.id,
        revision,
        ...(old
          ? {
              beforeData: {
                source_type: old.sourceType,
                source_id: old.sourceStockLocationId ?? old.supplierId,
              },
            }
          : {}),
        afterData: {
          source_type: d.source_type,
          source_id: d.source_stock_location_id ?? d.supplier_id ?? null,
        },
        changedById: u.id,
      },
    });
    return data;
  }
  private invalid(m: string): never {
    throw new ApiException(
      ErrorCode.VALIDATION_ERROR,
      m,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
  private notFound(): never {
    throw new ApiException(
      ErrorCode.RESOURCE_NOT_FOUND,
      "Không tìm thấy cấu hình nguồn.",
      HttpStatus.NOT_FOUND,
    );
  }
}
