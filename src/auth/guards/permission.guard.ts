import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { ApiException } from "../../common/errors/api.exception.js";
import { ErrorCode } from "../../common/errors/error-codes.js";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator.js";
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!required?.length) return true;
    const set = new Set(
      ctx
        .switchToHttp()
        .getRequest<Request>()
        .user?.grants.flatMap((g) => g.permissions) ?? [],
    );
    if (!required.every((p) => set.has(p)))
      throw new ApiException(
        ErrorCode.FORBIDDEN,
        "Bạn không có quyền thực hiện thao tác này.",
        HttpStatus.FORBIDDEN,
      );
    return true;
  }
}
