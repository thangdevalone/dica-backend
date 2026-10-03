import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { ApiException } from "../../common/errors/api.exception.js";
import { ErrorCode } from "../../common/errors/error-codes.js";
import { PrismaService } from "../../database/prisma.service.js";
import type { TokenPayload } from "../auth.types.js";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator.js";
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwt: JwtService,
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ])
    )
      return true;
    const req = ctx.switchToHttp().getRequest<Request>(),
      [scheme, token] = req.header("authorization")?.split(" ") ?? [];
    if (scheme !== "Bearer" || !token || token.length > 4_096)
      throw new ApiException(
        ErrorCode.AUTH_SESSION_INVALID,
        "Bạn cần đăng nhập để thực hiện thao tác này.",
        HttpStatus.UNAUTHORIZED,
      );
    let payload: TokenPayload;
    try {
      payload = await this.jwt.verifyAsync<TokenPayload>(token, {
        secret: this.config.getOrThrow("JWT_ACCESS_SECRET"),
        algorithms: ["HS256"],
      });
    } catch {
      throw new ApiException(
        ErrorCode.AUTH_SESSION_INVALID,
        "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (payload.typ !== "access")
      throw new ApiException(
        ErrorCode.AUTH_SESSION_INVALID,
        "Loại token không hợp lệ.",
        HttpStatus.UNAUTHORIZED,
      );
    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        organizationId: payload.org,
        active: true,
        tokenVersion: payload.ver,
        organization: { active: true },
        sessions: {
          some: {
            id: payload.sid,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
        },
      },
      select: {
        id: true,
        organizationId: true,
        supplierId: true,
        kind: true,
        username: true,
        displayName: true,
        grants: {
          where: { revokedAt: null, role: { active: true } },
          select: {
            id: true,
            scopeType: true,
            facilityId: true,
            stockLocationId: true,
            departmentId: true,
            role: {
              select: {
                code: true,
                permissions: {
                  select: { permission: { select: { code: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!user)
      throw new ApiException(
        ErrorCode.AUTH_SESSION_INVALID,
        "Phiên đăng nhập đã bị thu hồi hoặc tài khoản không còn hoạt động.",
        HttpStatus.UNAUTHORIZED,
      );
    req.user = {
      id: user.id,
      organizationId: user.organizationId,
      supplierId: user.supplierId,
      kind: user.kind,
      username: user.username,
      displayName: user.displayName,
      sessionId: payload.sid,
      grants: user.grants.map((g) => ({
        id: g.id,
        roleCode: g.role.code,
        permissions: g.role.permissions.map((p) => p.permission.code),
        scopeType: g.scopeType,
        facilityId: g.facilityId,
        stockLocationId: g.stockLocationId,
        departmentId: g.departmentId,
      })),
    };
    return true;
  }
}
