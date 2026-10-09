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
import { AUTHENTICATED_KEY } from "../decorators/authenticated.decorator.js";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator.js";
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets))
      return true;
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    const user = ctx.switchToHttp().getRequest<Request>().user;
    if (!required?.length) {
      if (
        user &&
        this.reflector.getAllAndOverride<boolean>(AUTHENTICATED_KEY, targets)
      )
        return true;
      throw new ApiException(
        ErrorCode.FORBIDDEN,
        "Endpoint chưa khai báo chính sách truy cập.",
        HttpStatus.FORBIDDEN,
      );
    }
    if (
      user?.kind === "SUPPLIER" &&
      required.some(
        (permission) =>
          ![
            "supplier_order.read_own",
            "notification.read_own",
            "notification.mark_own",
          ].includes(permission),
      )
    )
      throw new ApiException(
        ErrorCode.FORBIDDEN,
        "Nhà cung cấp chỉ được xem đơn của mình và thông báo.",
        HttpStatus.FORBIDDEN,
      );
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
