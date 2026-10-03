import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { Prisma } from "../../generated/prisma/client.js";
import { ErrorCode } from "../errors/error-codes.js";
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>(),
      req = host.switchToHttp().getRequest<Request>();
    const isHttp = exception instanceof HttpException,
      isDatabaseConflict =
        exception instanceof Prisma.PrismaClientKnownRequestError &&
        (exception.code === "P2002" || exception.code === "P2034"),
      status = isHttp
        ? exception.getStatus()
        : isDatabaseConflict
          ? HttpStatus.CONFLICT
          : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = isHttp
      ? exception.getResponse()
      : isDatabaseConflict
        ? {
            code: ErrorCode.VERSION_CONFLICT,
            message:
              "Dữ liệu vừa được cập nhật bởi thao tác khác. Vui lòng tải lại và thử lại.",
          }
        : {};
    const payload =
      typeof raw === "object" && raw
        ? (raw as {
            code?: string;
            message?: string | string[];
            details?: unknown;
          })
        : {};
    const validation = Array.isArray(payload.message)
      ? payload.message
      : payload.details;
    const message = Array.isArray(payload.message)
      ? "Dữ liệu gửi lên không hợp lệ."
      : (payload.message ??
        (status >= 500
          ? "Hệ thống đang gặp sự cố. Vui lòng thử lại sau."
          : "Không thể thực hiện yêu cầu."));
    if ((!isHttp && !isDatabaseConflict) || status >= 500)
      this.logger.error(
        `[${req.requestId}] ${req.method} ${req.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    res.status(status).json({
      success: false,
      code:
        payload.code ??
        (validation ? ErrorCode.VALIDATION_ERROR : ErrorCode.INTERNAL_ERROR),
      message,
      ...(validation ? { details: validation } : {}),
      request_id: req.requestId,
      timestamp: new Date().toISOString(),
    });
  }
}
