import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const supplied = req.header("x-request-id");
  const loggerRequestId = (req as Request & { id?: unknown }).id;
  req.requestId =
    typeof loggerRequestId === "string"
      ? loggerRequestId
      : supplied && /^[\w.:-]{1,100}$/.test(supplied)
        ? supplied
        : randomUUID();
  res.setHeader("x-request-id", req.requestId);
  next();
}
declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}
