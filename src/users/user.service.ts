import { HttpStatus, Injectable } from "@nestjs/common";
import * as argon2 from "argon2";
import type { AuthUser } from "../auth/auth.types.js";
import { ScopeService } from "../auth/scope.service.js";
import type { PaginationDto } from "../common/dto/pagination.dto.js";
import { ApiException } from "../common/errors/api.exception.js";
import { ErrorCode } from "../common/errors/error-codes.js";
import {
  normalizedSearch,
  offsetMeta,
  offsetWindow,
  paginateById,
  resolveSort,
} from "../common/pagination/pagination.js";
import { PrismaService } from "../database/prisma.service.js";
import { ScopeType, UserKind } from "../generated/prisma/client.js";
import type {
  AssignGrantDto,
  CreateUserDto,
  GrantListQueryDto,
  ResetPasswordDto,
  UpdateUserDto,
} from "./user.dto.js";
@Injectable()
export class UserService {
  constructor(
    private db: PrismaService,
    private scope: ScopeService,
  ) {}
  async list(actor: AuthUser, q: PaginationDto) {
    this.scope.assertAccess(actor, "user.read", {});
    const search = normalizedSearch(q);
    const where = {
      organizationId: actor.organizationId,
      ...(search
        ? {
            OR: [
              { username: { contains: search, mode: "insensitive" as const } },
              {
                displayName: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    };
    const sort = resolveSort(
      q,
      { created_at: "createdAt", username: "username", name: "displayName" },
      "createdAt",
    );
    const { data, meta } = await paginateById(
      q,
      ({ skip, take, cursorId }) =>
        this.db.user.findMany({
          where,
          select: {
            id: true,
            username: true,
            displayName: true,
            kind: true,
            supplierId: true,
            active: true,
            lastLoginAt: true,
            createdAt: true,
            grants: { where: { revokedAt: null }, include: { role: true } },
          },
          orderBy: [{ [sort.field]: sort.direction }, { id: sort.direction }],
          ...(skip !== undefined ? { skip } : {}),
          take,
          ...(cursorId ? { cursor: { id: cursorId } } : {}),
        }),
      () => this.db.user.count({ where }),
      { searchHandled: true, sortHandled: true },
    );
    return {
      data,
      message: "Lấy danh sách tài khoản thành công.",
      meta,
    };
  }
  async create(actor: AuthUser, d: CreateUserDto) {
    this.scope.assertAccess(actor, "user.create", {});
    this.scope.assertAccess(actor, "grant.assign", {});
    if (d.kind === UserKind.SUPPLIER && !d.supplier_id)
      this.invalid("Tài khoản nhà cung ứng bắt buộc có supplier_id.");
    if (d.kind === UserKind.INTERNAL && d.supplier_id)
      this.invalid("Tài khoản nội bộ không được liên kết nhà cung ứng.");
    if (
      d.supplier_id &&
      !(await this.db.supplier.count({
        where: {
          id: d.supplier_id,
          organizationId: actor.organizationId,
          active: true,
        },
      }))
    )
      this.invalid("Nhà cung ứng không hợp lệ.");
    const role = await this.db.role.findFirst({
      where: {
        id: d.role_id,
        organizationId: actor.organizationId,
        active: true,
      },
    });
    if (!role) this.notFound();
    if (
      d.kind === UserKind.SUPPLIER &&
      (role.code !== "SUPPLIER" || d.scope_type !== ScopeType.SUPPLIER)
    )
      this.invalid(
        "Tài khoản nhà cung ứng chỉ được nhận vai trò SUPPLIER với scope SUPPLIER.",
      );
    if (
      d.kind === UserKind.INTERNAL &&
      (role.code === "SUPPLIER" || d.scope_type === ScopeType.SUPPLIER)
    )
      this.invalid(
        "Tài khoản nội bộ không được nhận vai trò/scope nhà cung ứng.",
      );
    await this.validateScope(actor, d);
    const username = d.username.trim().toLowerCase();
    if (
      await this.db.user.count({
        where: { organizationId: actor.organizationId, username },
      })
    )
      this.invalid("Tên đăng nhập đã được sử dụng.");
    const passwordHash = await argon2.hash(d.password);
    const data = await this.db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          organizationId: actor.organizationId,
          username,
          displayName: d.display_name?.trim() || username,
          passwordHash,
          kind: d.kind,
          ...(d.supplier_id ? { supplierId: d.supplier_id } : {}),
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          kind: true,
          supplierId: true,
          active: true,
          createdAt: true,
        },
      });
      const grant = await tx.roleGrant.create({
        data: {
          userId: user.id,
          roleId: d.role_id,
          scopeType: d.scope_type,
          ...(d.facility_id ? { facilityId: d.facility_id } : {}),
          ...(d.stock_location_id
            ? { stockLocationId: d.stock_location_id }
            : {}),
          ...(d.department_id ? { departmentId: d.department_id } : {}),
        },
      });
      return { ...user, grants: [{ ...grant, role }] };
    });
    return { data, message: "Tạo tài khoản thành công." };
  }
  async deactivate(actor: AuthUser, id: string) {
    this.scope.assertAccess(actor, "user.deactivate", {});
    if (actor.id === id)
      this.invalid("Không thể tự vô hiệu hóa tài khoản đang đăng nhập.");
    const target = await this.db.user.findFirst({
      where: { id, organizationId: actor.organizationId },
    });
    if (!target) this.notFound();
    const data = await this.db.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { active: false, tokenVersion: { increment: 1 } },
      });
      await tx.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: actor.organizationId,
          actorId: actor.id,
          action: "user.deactivate",
          resourceType: "User",
          resourceId: id,
          requestId: actor.requestId,
          beforeData: { active: true },
          afterData: { active: false },
        },
      });
      return { id: updated.id, active: updated.active };
    });
    return {
      data,
      message: "Vô hiệu hóa tài khoản và thu hồi phiên thành công.",
    };
  }
  async update(actor: AuthUser, id: string, d: UpdateUserDto) {
    this.scope.assertAccess(actor, "user.update", {});
    const target = await this.db.user.findFirst({
      where: { id, organizationId: actor.organizationId },
    });
    if (!target) this.notFound();
    const data = await this.db.user.update({
      where: { id },
      data: {
        ...(d.display_name !== undefined
          ? { displayName: d.display_name.trim() }
          : {}),
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        kind: true,
        supplierId: true,
        active: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    return { data, message: "Cập nhật tài khoản thành công." };
  }
  async activate(actor: AuthUser, id: string) {
    this.scope.assertAccess(actor, "user.update", {});
    const target = await this.db.user.findFirst({
      where: { id, organizationId: actor.organizationId },
    });
    if (!target) this.notFound();
    if (target.active) this.invalid("Tài khoản đang hoạt động.");
    const data = await this.db.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { active: true },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: actor.organizationId,
          actorId: actor.id,
          action: "user.activate",
          resourceType: "User",
          resourceId: id,
          requestId: actor.requestId,
          beforeData: { active: false },
          afterData: { active: true },
        },
      });
      return { id: updated.id, active: updated.active };
    });
    return { data, message: "Kích hoạt lại tài khoản thành công." };
  }
  async resetPassword(actor: AuthUser, id: string, d: ResetPasswordDto) {
    this.scope.assertAccess(actor, "user.reset_password", {});
    const target = await this.db.user.findFirst({
      where: { id, organizationId: actor.organizationId },
    });
    if (!target) this.notFound();
    const passwordHash = await argon2.hash(d.password);
    const data = await this.db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { passwordHash, tokenVersion: { increment: 1 } },
      });
      const revoked = await tx.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: actor.organizationId,
          actorId: actor.id,
          action: "user.reset_password",
          resourceType: "User",
          resourceId: id,
          requestId: actor.requestId,
          afterData: { sessions_revoked: revoked.count },
        },
      });
      return { id, sessions_revoked: revoked.count };
    });
    return {
      data,
      message: "Đặt lại mật khẩu và thu hồi các phiên đăng nhập thành công.",
    };
  }
  async roles(actor: AuthUser, q: PaginationDto) {
    this.scope.assertAccess(actor, "role.read", {});
    const where = { organizationId: actor.organizationId, active: true };
    const { data, meta } = await paginateById(
      q,
      ({ skip, take, cursorId }) =>
        this.db.role.findMany({
          where,
          include: { permissions: { include: { permission: true } } },
          orderBy: [{ code: "asc" }, { id: "asc" }],
          ...(skip !== undefined ? { skip } : {}),
          take,
          ...(cursorId ? { cursor: { id: cursorId } } : {}),
        }),
      () => this.db.role.count({ where }),
    );
    return { data, message: "Lấy danh sách vai trò thành công.", meta };
  }
  async permissions(actor: AuthUser, q: PaginationDto) {
    this.scope.assertAccess(actor, "role.read", {});
    const search = normalizedSearch(q);
    const where = search
      ? {
          OR: [
            { code: { contains: search, mode: "insensitive" as const } },
            {
              description: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {};
    const window = offsetWindow(q, { searchHandled: true });
    const [data, total] = await Promise.all([
      this.db.permission.findMany({
        where,
        orderBy: { code: "asc" },
        ...window,
      }),
      this.db.permission.count({ where }),
    ]);
    return {
      data,
      message: "Lấy danh sách quyền thành công.",
      meta: offsetMeta(q, total),
    };
  }
  async grants(actor: AuthUser, q: GrantListQueryDto) {
    this.scope.assertAccess(actor, "grant.read", {});
    const where = {
      user: { organizationId: actor.organizationId },
      revokedAt: null,
      ...(q.user_id ? { userId: q.user_id } : {}),
    };
    const { data, meta } = await paginateById(
      q,
      ({ skip, take, cursorId }) =>
        this.db.roleGrant.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                kind: true,
              },
            },
            role: true,
            facility: true,
            stockLocation: true,
            department: true,
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          ...(skip !== undefined ? { skip } : {}),
          take,
          ...(cursorId ? { cursor: { id: cursorId } } : {}),
        }),
      () => this.db.roleGrant.count({ where }),
    );
    return { data, message: "Lấy danh sách phân quyền thành công.", meta };
  }
  async assign(actor: AuthUser, d: AssignGrantDto) {
    this.scope.assertAccess(actor, "grant.assign", {});
    const [target, role] = await Promise.all([
      this.db.user.findFirst({
        where: {
          id: d.user_id,
          organizationId: actor.organizationId,
          active: true,
        },
      }),
      this.db.role.findFirst({
        where: {
          id: d.role_id,
          organizationId: actor.organizationId,
          active: true,
        },
      }),
    ]);
    if (!target || !role) this.notFound();
    if (
      target.kind === UserKind.SUPPLIER &&
      (role.code !== "SUPPLIER" || d.scope_type !== ScopeType.SUPPLIER)
    )
      this.invalid(
        "Tài khoản nhà cung ứng chỉ được nhận vai trò SUPPLIER với scope SUPPLIER.",
      );
    if (
      target.kind === UserKind.INTERNAL &&
      (role.code === "SUPPLIER" || d.scope_type === ScopeType.SUPPLIER)
    )
      this.invalid(
        "Tài khoản nội bộ không được nhận vai trò/scope nhà cung ứng.",
      );
    await this.validateScope(actor, d);
    const data = await this.db.$transaction(async (tx) => {
      const grant = await tx.roleGrant.create({
        data: {
          userId: d.user_id,
          roleId: d.role_id,
          scopeType: d.scope_type,
          ...(d.facility_id ? { facilityId: d.facility_id } : {}),
          ...(d.stock_location_id
            ? { stockLocationId: d.stock_location_id }
            : {}),
          ...(d.department_id ? { departmentId: d.department_id } : {}),
        },
      });
      await tx.user.update({
        where: { id: d.user_id },
        data: { tokenVersion: { increment: 1 } },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: actor.organizationId,
          actorId: actor.id,
          action: "grant.assign",
          resourceType: "RoleGrant",
          resourceId: grant.id,
          requestId: actor.requestId,
          afterData: {
            user_id: d.user_id,
            role_code: role.code,
            scope_type: d.scope_type,
          },
        },
      });
      return grant;
    });
    return {
      data,
      message: "Cấp quyền thành công; quyền mới áp dụng cho phiên hiện hành.",
    };
  }
  async revoke(actor: AuthUser, id: string) {
    this.scope.assertAccess(actor, "grant.revoke", {});
    const grant = await this.db.roleGrant.findFirst({
      where: {
        id,
        revokedAt: null,
        user: { organizationId: actor.organizationId },
      },
    });
    if (!grant) this.notFound();
    const data = await this.db.$transaction(async (tx) => {
      const g = await tx.roleGrant.update({
        where: { id },
        data: { revokedAt: new Date() },
      });
      await tx.user.update({
        where: { id: g.userId },
        data: { tokenVersion: { increment: 1 } },
      });
      await tx.session.updateMany({
        where: { userId: g.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: actor.organizationId,
          actorId: actor.id,
          action: "grant.revoke",
          resourceType: "RoleGrant",
          resourceId: id,
          requestId: actor.requestId,
          afterData: { revoked: true },
        },
      });
      return { id: g.id, revoked_at: g.revokedAt };
    });
    return {
      data,
      message: "Thu hồi quyền và các phiên của tài khoản thành công.",
    };
  }
  private async validateScope(
    a: AuthUser,
    d: Pick<
      AssignGrantDto,
      "scope_type" | "facility_id" | "stock_location_id" | "department_id"
    >,
  ) {
    if (
      (d.scope_type === ScopeType.ORGANIZATION ||
        d.scope_type === ScopeType.OWN) &&
      [d.facility_id, d.stock_location_id, d.department_id].some(Boolean)
    )
      this.invalid("Scope ORGANIZATION/OWN không nhận ID cơ sở/kho/bộ phận.");
    if (d.scope_type === ScopeType.OWN) return;
    if (d.scope_type === ScopeType.SUPPLIER) {
      if ([d.facility_id, d.stock_location_id, d.department_id].some(Boolean))
        this.invalid("Scope SUPPLIER không nhận ID cơ sở/kho/bộ phận.");
      return;
    }
    if (d.scope_type !== ScopeType.ORGANIZATION && !d.facility_id)
      this.invalid("Scope nội bộ chi tiết bắt buộc có facility_id.");
    if (
      d.scope_type === ScopeType.FACILITY &&
      [d.stock_location_id, d.department_id].some(Boolean)
    )
      this.invalid("Scope FACILITY chỉ nhận facility_id.");
    if (
      d.scope_type === ScopeType.STOCK_LOCATION &&
      (!d.stock_location_id || d.department_id)
    )
      this.invalid(
        "Scope STOCK_LOCATION bắt buộc có stock_location_id và không nhận department_id.",
      );
    if (
      d.scope_type === ScopeType.DEPARTMENT &&
      (!d.department_id || d.stock_location_id)
    )
      this.invalid(
        "Scope DEPARTMENT bắt buộc có department_id và không nhận stock_location_id.",
      );
    if (
      d.facility_id &&
      !(await this.db.facility.count({
        where: { id: d.facility_id, organizationId: a.organizationId },
      }))
    )
      this.invalid("Cơ sở không hợp lệ.");
    if (
      d.stock_location_id &&
      !(await this.db.stockLocation.count({
        where: { id: d.stock_location_id, facilityId: d.facility_id! },
      }))
    )
      this.invalid("Kho không thuộc cơ sở.");
    if (
      d.department_id &&
      !(await this.db.department.count({
        where: { id: d.department_id, facilityId: d.facility_id! },
      }))
    )
      this.invalid("Bộ phận không thuộc cơ sở.");
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
      "Không tìm thấy tài khoản, vai trò hoặc phân quyền.",
      HttpStatus.NOT_FOUND,
    );
  }
}
