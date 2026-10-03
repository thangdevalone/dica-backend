import { createHash } from "node:crypto";
import { HttpStatus, Injectable } from "@nestjs/common";
import type { AuthUser } from "../../auth/auth.types.js";
import { PrismaService } from "../../database/prisma.service.js";
import { Prisma } from "../../generated/prisma/client.js";
import { ApiException } from "../errors/api.exception.js";
import { ErrorCode } from "../errors/error-codes.js";
@Injectable()
export class IdempotencyService {
  constructor(private db: PrismaService) {}
  requireKey(k?: string) {
    if (!k || !/^[\w.:-]{8,150}$/.test(k))
      throw new ApiException(
        ErrorCode.IDEMPOTENCY_KEY_REQUIRED,
        "Header Idempotency-Key là bắt buộc và phải có từ 8 đến 150 ký tự.",
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    return k;
  }
  async execute<T extends Prisma.JsonObject>(
    u: AuthUser,
    op: string,
    key: string,
    payload: unknown,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    const hash = createHash("sha256")
      .update(JSON.stringify(this.canonicalize(payload)))
      .digest("hex");
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.db.$transaction(
          async (tx) => {
            let old = await tx.idempotencyRecord.findUnique({
              where: {
                organizationId_userId_operation_key: {
                  organizationId: u.organizationId,
                  userId: u.id,
                  operation: op,
                  key,
                },
              },
            });
            if (old && old.expiresAt <= new Date()) {
              await tx.idempotencyRecord.delete({ where: { id: old.id } });
              old = null;
            }
            if (old) {
              if (old.requestHash !== hash)
                throw new ApiException(
                  ErrorCode.IDEMPOTENCY_CONFLICT,
                  "Idempotency-Key đã được dùng với nội dung khác.",
                  HttpStatus.CONFLICT,
                );
              return { value: old.responseBody as T, replayed: true };
            }
            const value = await fn(tx);
            await tx.idempotencyRecord.create({
              data: {
                organizationId: u.organizationId,
                userId: u.id,
                operation: op,
                key,
                requestHash: hash,
                statusCode: 200,
                responseBody: value,
                expiresAt: new Date(Date.now() + 86_400_000),
              },
            });
            return { value, replayed: false };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (!this.retryable(error) || attempt === 2) throw error;
        await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
      }
    }
    throw new Error("Không thể hoàn tất transaction idempotency.");
  }

  private retryable(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2002" || error.code === "P2034")
    );
  }

  private canonicalize(value: unknown): unknown {
    if (Array.isArray(value))
      return value.map((item) => this.canonicalize(item));
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([name, item]) => [name, this.canonicalize(item)]),
      );
    return value;
  }
}
