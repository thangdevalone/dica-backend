import { HttpStatus, Injectable } from "@nestjs/common";
import { ScopeService } from "../auth/scope.service.js";
import type { AuthUser } from "../auth/auth.types.js";
import type { PaginationDto } from "../common/dto/pagination.dto.js";
import { ApiException } from "../common/errors/api.exception.js";
import { ErrorCode } from "../common/errors/error-codes.js";
import {
  normalizedSearch,
  paginateById,
} from "../common/pagination/pagination.js";
import { PrismaService } from "../database/prisma.service.js";
import type {
  CreateDepartmentDto,
  CreateFacilityDto,
  CreateStockLocationDto,
} from "./organization.dto.js";
@Injectable()
export class OrganizationService {
  constructor(
    private db: PrismaService,
    private scope: ScopeService,
  ) {}
  async facilities(u: AuthUser, q: PaginationDto) {
    const ids = this.scope.facilityIds(u, "facility.read");
    const search = normalizedSearch(q);
    const where = {
      organizationId: u.organizationId,
      ...(ids ? { id: { in: ids } } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: "insensitive" as const } },
              { name: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const { data, meta } = await paginateById(
      q,
      ({ skip, take, cursorId }) =>
        this.db.facility.findMany({
          where,
          orderBy: [{ code: "asc" }, { id: "asc" }],
          ...(skip !== undefined ? { skip } : {}),
          take,
          ...(cursorId ? { cursor: { id: cursorId } } : {}),
        }),
      () => this.db.facility.count({ where }),
      { searchHandled: true },
    );
    return {
      data,
      message: "Lấy danh sách cơ sở thành công.",
      meta,
    };
  }
  async createFacility(u: AuthUser, d: CreateFacilityDto) {
    this.scope.assertAccess(u, "facility.manage", {});
    const data = await this.db.facility.create({
      data: {
        organizationId: u.organizationId,
        code: d.code.toUpperCase(),
        name: d.name,
        type: d.type,
      },
    });
    return { data, message: "Tạo cơ sở thành công." };
  }
  async locations(u: AuthUser, q: PaginationDto) {
    const access = this.scope.constraintsFor(u, "stock_location.read", [
      "facilityId",
      "stockLocationId",
    ]);
    const search = normalizedSearch(q);
    const where = {
      facility: {
        organizationId: u.organizationId,
      },
      ...(access
        ? {
            OR: access.map((item) => ({
              ...(item.facilityId ? { facilityId: item.facilityId } : {}),
              ...(item.stockLocationId ? { id: item.stockLocationId } : {}),
            })),
          }
        : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: "insensitive" as const } },
              { name: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const { data, meta } = await paginateById(
      q,
      ({ skip, take, cursorId }) =>
        this.db.stockLocation.findMany({
          where,
          include: { facility: true },
          orderBy: [{ code: "asc" }, { id: "asc" }],
          ...(skip !== undefined ? { skip } : {}),
          take,
          ...(cursorId ? { cursor: { id: cursorId } } : {}),
        }),
      () => this.db.stockLocation.count({ where }),
      { searchHandled: true },
    );
    return {
      data,
      message: "Lấy danh sách kho thành công.",
      meta,
    };
  }
  async createLocation(u: AuthUser, d: CreateStockLocationDto) {
    this.scope.assertAccess(u, "stock_location.manage", {
      facilityId: d.facility_id,
    });
    await this.assertFacility(u, d.facility_id);
    const data = await this.db.stockLocation.create({
      data: {
        facilityId: d.facility_id,
        code: d.code.toUpperCase(),
        name: d.name,
        ...(d.type ? { type: d.type } : {}),
      },
    });
    return { data, message: "Tạo kho thành công." };
  }
  async departments(u: AuthUser, q: PaginationDto) {
    const access = this.scope.constraintsFor(u, "department.read", [
      "facilityId",
      "stockLocationId",
      "departmentId",
    ]);
    const search = normalizedSearch(q);
    const where = {
      facility: {
        organizationId: u.organizationId,
      },
      ...(access
        ? {
            OR: access.map((item) => ({
              ...(item.facilityId ? { facilityId: item.facilityId } : {}),
              ...(item.stockLocationId
                ? { stockLocationId: item.stockLocationId }
                : {}),
              ...(item.departmentId ? { id: item.departmentId } : {}),
            })),
          }
        : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: "insensitive" as const } },
              { name: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const { data, meta } = await paginateById(
      q,
      ({ skip, take, cursorId }) =>
        this.db.department.findMany({
          where,
          include: { facility: true, stockLocation: true },
          orderBy: [{ code: "asc" }, { id: "asc" }],
          ...(skip !== undefined ? { skip } : {}),
          take,
          ...(cursorId ? { cursor: { id: cursorId } } : {}),
        }),
      () => this.db.department.count({ where }),
      { searchHandled: true },
    );
    return {
      data,
      message: "Lấy danh sách bộ phận thành công.",
      meta,
    };
  }
  async createDepartment(u: AuthUser, d: CreateDepartmentDto) {
    this.scope.assertAccess(u, "department.manage", {
      facilityId: d.facility_id,
    });
    await this.assertFacility(u, d.facility_id);
    if (
      d.stock_location_id &&
      !(await this.db.stockLocation.count({
        where: { id: d.stock_location_id, facilityId: d.facility_id },
      }))
    )
      this.invalid("Kho không thuộc cơ sở đã chọn.");
    const data = await this.db.department.create({
      data: {
        facilityId: d.facility_id,
        code: d.code.toUpperCase(),
        name: d.name,
        type: d.type,
        ...(d.stock_location_id
          ? { stockLocationId: d.stock_location_id }
          : {}),
      },
    });
    return { data, message: "Tạo bộ phận thành công." };
  }
  private async assertFacility(u: AuthUser, id: string) {
    if (
      !(await this.db.facility.count({
        where: { id, organizationId: u.organizationId, active: true },
      }))
    )
      throw new ApiException(
        ErrorCode.RESOURCE_NOT_FOUND,
        "Không tìm thấy cơ sở.",
        HttpStatus.NOT_FOUND,
      );
  }
  private invalid(m: string): never {
    throw new ApiException(
      ErrorCode.VALIDATION_ERROR,
      m,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
