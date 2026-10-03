import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
export const CurrentUser = createParamDecorator(
  (_d: unknown, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest<Request>().user,
);
