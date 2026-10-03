import { HttpStatus, Injectable } from "@nestjs/common";
import { ApiException } from "../common/errors/api.exception.js";
import { ErrorCode } from "../common/errors/error-codes.js";
import type { AuthGrant, AuthUser } from "./auth.types.js";
export interface ResourceScope {
  facilityId?: string | null;
  stockLocationId?: string | null;
  departmentId?: string | null;
  createdById?: string | null;
  supplierId?: string | null;
}

type ScopeDimension = keyof ResourceScope;
@Injectable()
export class ScopeService {
  grantsFor(u: AuthUser, p: string): AuthGrant[] {
    return u.grants.filter((g) => g.permissions.includes(p));
  }
  canAccess(u: AuthUser, p: string, r: ResourceScope): boolean {
    return this.grantsFor(u, p).some((g) => {
      if (g.scopeType === "SUPPLIER")
        return Boolean(u.supplierId && r.supplierId === u.supplierId);
      if (g.scopeType === "OWN" && r.createdById !== u.id) return false;
      if (g.facilityId && r.facilityId !== g.facilityId) return false;
      if (g.stockLocationId && r.stockLocationId !== g.stockLocationId)
        return false;
      if (g.departmentId && r.departmentId !== g.departmentId) return false;
      return (
        g.scopeType === "ORGANIZATION" ||
        g.scopeType === "OWN" ||
        Boolean(g.facilityId || g.stockLocationId || g.departmentId)
      );
    });
  }
  assertAccess(u: AuthUser, p: string, r: ResourceScope): void {
    if (!this.canAccess(u, p, r))
      throw new ApiException(
        ErrorCode.RESOURCE_NOT_FOUND,
        "Không tìm thấy dữ liệu hoặc bạn không có quyền truy cập.",
        HttpStatus.NOT_FOUND,
      );
  }

  /**
   * Trả về các nhánh scope phải OR với nhau khi dựng câu query danh sách.
   * `null` nghĩa là grant cấp tổ chức nên không cần thêm bộ lọc scope.
   *
   * Caller phải khai báo các chiều mà resource thật sự có. Grant chứa một
   * chiều resource không hỗ trợ sẽ bị loại (fail closed), thay vì bị hạ cấp
   * thành facility và vô tình mở rộng quyền.
   */
  constraintsFor(
    u: AuthUser,
    p: string,
    supported: readonly ScopeDimension[],
  ): ResourceScope[] | null {
    const grants = this.grantsFor(u, p);
    if (grants.some((g) => g.scopeType === "ORGANIZATION")) return null;
    const supportedSet = new Set<ScopeDimension>(supported);
    const constraints = grants
      .map((grant): ResourceScope | null => {
        const constraint: ResourceScope = {};
        if (grant.scopeType === "SUPPLIER") {
          if (!u.supplierId) return null;
          constraint.supplierId = u.supplierId;
        } else {
          if (grant.facilityId) constraint.facilityId = grant.facilityId;
          if (grant.stockLocationId)
            constraint.stockLocationId = grant.stockLocationId;
          if (grant.departmentId) constraint.departmentId = grant.departmentId;
          if (grant.scopeType === "OWN") constraint.createdById = u.id;
        }
        const dimensions = Object.keys(constraint) as ScopeDimension[];
        if (
          dimensions.length === 0 ||
          dimensions.some((dimension) => !supportedSet.has(dimension))
        )
          return null;
        return constraint;
      })
      .filter((constraint): constraint is ResourceScope => Boolean(constraint));
    return [
      ...new Map(
        constraints.map((constraint) => [
          JSON.stringify(constraint),
          constraint,
        ]),
      ).values(),
    ];
  }

  facilityIds(u: AuthUser, p: string): string[] | null {
    const constraints = this.constraintsFor(u, p, ["facilityId"]);
    if (constraints === null) return null;
    return [
      ...new Set(
        constraints.flatMap((constraint) =>
          constraint.facilityId ? [constraint.facilityId] : [],
        ),
      ),
    ];
  }
}
