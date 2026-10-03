import { Injectable } from "@nestjs/common";
import type { AuthUser } from "../auth/auth.types.js";
import { ScopeService } from "../auth/scope.service.js";
import { paginateById } from "../common/pagination/pagination.js";
import { PrismaService } from "../database/prisma.service.js";
import type { AuditQueryDto } from "./audit.dto.js";

@Injectable()
export class SystemService {
  constructor(
    private readonly db: PrismaService,
    private readonly scope: ScopeService,
  ) {}

  async audits(user: AuthUser, query: AuditQueryDto) {
    // Audit chưa mang cột scope chuẩn hóa cho mọi loại resource, vì vậy chỉ grant cấp tổ chức
    // mới được đọc. Không trả audit theo facility bằng cách lọc sau phân trang.
    this.scope.assertAccess(user, "audit.read", {});
    const where = {
      organizationId: user.organizationId,
      ...(query.action ? { action: query.action } : {}),
      ...(query.resource_type ? { resourceType: query.resource_type } : {}),
    };
    const { data, meta } = await paginateById(
      query,
      ({ skip, take, cursorId }) =>
        this.db.auditEvent.findMany({
          where,
          include: {
            actor: { select: { id: true, username: true, displayName: true } },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          ...(skip !== undefined ? { skip } : {}),
          take,
          ...(cursorId ? { cursor: { id: cursorId } } : {}),
        }),
      () => this.db.auditEvent.count({ where }),
    );
    return {
      data,
      message: "Lấy lịch sử thao tác thành công.",
      meta,
    };
  }
}
