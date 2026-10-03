import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request, Response } from "express";
import { from, mergeMap, type Observable } from "rxjs";
import type { AuthUser } from "../../auth/auth.types.js";
import { PrismaService } from "../../database/prisma.service.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { sanitizeAuditValue } from "./audit-sanitizer.js";
import {
  CONFIG_AUDIT_METADATA,
  type ConfigAuditMetadata,
} from "./config-audit.decorator.js";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

@Injectable()
export class ConfigAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ConfigAuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly db: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadata = this.reflector.getAllAndOverride<ConfigAuditMetadata>(
      CONFIG_AUDIT_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (!metadata || context.getType() !== "http") return next.handle();

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const response = context.switchToHttp().getResponse<Response>();
    if (!MUTATING_METHODS.has(request.method.toUpperCase()))
      return next.handle();

    return next
      .handle()
      .pipe(
        mergeMap((value: unknown) =>
          from(this.record(metadata, request, response, value)).pipe(
            mergeMap(() => [value]),
          ),
        ),
      );
  }

  private async record(
    metadata: ConfigAuditMetadata,
    request: Request & { user?: AuthUser },
    response: Response,
    value: unknown,
  ): Promise<void> {
    const user = request.user;
    if (!user) return;
    const path = request.originalUrl.split("?", 1)[0] ?? request.path;
    const output = this.unwrapData(value);
    const resourceId = this.resourceId(request, output, path);
    const action =
      `config.${request.method.toLowerCase()}.${metadata.resourceType.toLowerCase()}`.slice(
        0,
        100,
      );
    try {
      await this.db.auditEvent.create({
        data: {
          organizationId: user.organizationId,
          actorId: user.id,
          action,
          resourceType: metadata.resourceType.slice(0, 100),
          resourceId,
          requestId: request.requestId,
          beforeData: sanitizeAuditValue({
            request: {
              method: request.method,
              path,
              params: request.params,
              query: request.query,
              body: request.body,
            },
            client: {
              ip: request.ip,
              user_agent: request.header("user-agent") ?? null,
            },
          }) as Prisma.InputJsonValue,
          afterData: sanitizeAuditValue({
            status_code: response.statusCode,
            result: output,
          }) as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.error(
        {
          request_id: request.requestId,
          action,
          resource_type: metadata.resourceType,
          error: error instanceof Error ? error.message : String(error),
        },
        "Không thể ghi lịch sử thay đổi cấu hình.",
      );
    }
  }

  private unwrapData(value: unknown): unknown {
    if (value && typeof value === "object" && "data" in value)
      return (value as { data: unknown }).data;
    return value;
  }

  private resourceId(
    request: Request,
    output: unknown,
    fallback: string,
  ): string {
    const paramId = request.params["id"];
    if (typeof paramId === "string" && paramId) return paramId.slice(0, 100);
    if (output && typeof output === "object" && "id" in output) {
      const id = (output as { id?: unknown }).id;
      if (typeof id === "string" && id) return id.slice(0, 100);
    }
    return fallback.slice(0, 100);
  }
}
