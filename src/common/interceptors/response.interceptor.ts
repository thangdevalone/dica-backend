import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import type { Request } from "express";
import { map, type Observable } from "rxjs";
interface Result {
  data: unknown;
  message?: string;
  meta?: Record<string, unknown>;
}
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    return next.handle().pipe(
      map((body: unknown) => {
        const result: Result =
          body && typeof body === "object" && "data" in body
            ? (body as Result)
            : { data: body };
        return {
          success: true,
          message: result.message ?? "Thao tác thành công.",
          data: result.data,
          ...(result.meta ? { meta: result.meta } : {}),
          request_id: req.requestId,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
