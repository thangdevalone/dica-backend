import { HttpStatus, Injectable } from "@nestjs/common";
import type { AuthUser } from "../auth/auth.types.js";
import { ScopeService } from "../auth/scope.service.js";
import { ApiException } from "../common/errors/api.exception.js";
import { ErrorCode } from "../common/errors/error-codes.js";
import {
  normalizedSearch,
  paginateById,
} from "../common/pagination/pagination.js";
import { PrismaService } from "../database/prisma.service.js";
import { Prisma } from "../generated/prisma/client.js";
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
    const search = normalizedSearch(query);
    const createdFrom = query.created_from
      ? new Date(query.created_from)
      : undefined;
    const createdTo = query.created_to ? new Date(query.created_to) : undefined;
    if (createdFrom && createdTo && createdFrom > createdTo)
      throw new ApiException(
        ErrorCode.VALIDATION_ERROR,
        "Thời gian bắt đầu không được sau thời gian kết thúc.",
        HttpStatus.BAD_REQUEST,
      );
    const where: Prisma.AuditEventWhereInput = {
      organizationId: user.organizationId,
      ...(query.action
        ? {
            action: {
              contains: query.action.trim(),
              mode: "insensitive" as const,
            },
          }
        : {}),
      ...(query.resource_type ? { resourceType: query.resource_type } : {}),
      ...(query.actor
        ? {
            actor: {
              is: {
                OR: [
                  {
                    username: {
                      contains: query.actor.trim(),
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    displayName: {
                      contains: query.actor.trim(),
                      mode: "insensitive" as const,
                    },
                  },
                ],
              },
            },
          }
        : {}),
      ...(createdFrom || createdTo
        ? {
            createdAt: {
              ...(createdFrom ? { gte: createdFrom } : {}),
              ...(createdTo ? { lte: createdTo } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              {
                resourceId: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                requestId: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                action: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                actor: {
                  is: {
                    OR: [
                      {
                        username: {
                          contains: search,
                          mode: "insensitive" as const,
                        },
                      },
                      {
                        displayName: {
                          contains: search,
                          mode: "insensitive" as const,
                        },
                      },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
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
      { searchHandled: true },
    );
    return {
      data,
      message: "Lấy lịch sử thao tác thành công.",
      meta,
    };
  }
}
