import assert from "node:assert/strict";
import test from "node:test";
import { ConfigService } from "@nestjs/config";
import { AttachmentService } from "../src/attachments/attachment.service.js";
import { R2StorageService } from "../src/attachments/r2-storage.service.js";
import type { AuthUser } from "../src/auth/auth.types.js";
import type { ScopeService } from "../src/auth/scope.service.js";
import { ApiException } from "../src/common/errors/api.exception.js";
import type { PrismaService } from "../src/database/prisma.service.js";

const user: AuthUser = {
  id: "00000000-0000-4000-8000-000000000001",
  organizationId: "00000000-0000-4000-8000-000000000002",
  supplierId: null,
  kind: "INTERNAL",
  username: "staff",
  displayName: "Staff",
  sessionId: "session",
  requestId: "request",
  grants: [],
};
const dto = {
  resource_type: "RECEIPT" as const,
  resource_id: "00000000-0000-4000-8000-000000000003",
  file_name: "receipt.jpg",
  content_type: "image/jpeg" as const,
  size_bytes: 12,
};
const jpeg = Buffer.from("ffd8ffe000104a4649460001", "hex");

function createFixture(options?: { prefix?: Buffer; contentLength?: number }) {
  let record: Record<string, unknown> | undefined;
  const deleted: string[] = [];
  const database = {
    receipt: {
      findFirst: async () => ({
        order: {
          destinationStockLocationId: "stock-location",
          destinationStockLocation: { facilityId: "facility" },
        },
      }),
    },
    attachment: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        record = { ...data, createdAt: new Date() };
        return record;
      },
      findFirst: async () => record,
      findMany: async () => (record ? [record] : []),
      updateMany: async () => {
        if (record) record["uploadStatus"] = "READY";
        return { count: record ? 1 : 0 };
      },
      delete: async () => {
        record = undefined;
      },
    },
  } as unknown as PrismaService;
  const scope = { assertAccess: () => undefined } as unknown as ScopeService;
  const storage = {
    createUploadUrl: async () => ({
      url: "https://r2.example/presigned",
      expiresAt: new Date(Date.now() + 600_000),
    }),
    createViewUrl: async () => ({
      url: "https://r2.example/view",
      expiresAt: new Date(Date.now() + 300_000),
    }),
    head: async () => ({
      contentLength: options?.contentLength ?? dto.size_bytes,
      contentType: dto.content_type,
    }),
    readPrefix: async () => options?.prefix ?? jpeg,
    delete: async (key: string) => void deleted.push(key),
  } as unknown as R2StorageService;
  return {
    service: new AttachmentService(database, scope, storage),
    deleted,
    getRecord: () => record,
  };
}

test("backend cấp presigned URL và không nhận bytes ảnh", async () => {
  const fixture = createFixture();
  const result = await fixture.service.createUpload(user, dto);

  assert.equal(result.data.method, "PUT");
  assert.equal(result.data.uploadUrl, "https://r2.example/presigned");
  assert.deepEqual(result.data.headers, {
    "Content-Type": "image/jpeg",
    "Content-Length": "12",
    "If-None-Match": "*",
  });
  assert.equal(fixture.getRecord()?.["content"], undefined);
  assert.equal(fixture.getRecord()?.["uploadStatus"], "PENDING");
});

test("presigned URL bắt buộc đúng type, size và không cho ghi đè", async () => {
  const storage = new R2StorageService(
    new ConfigService({
      R2_ACCOUNT_ID: "account-id",
      R2_ACCESS_KEY_ID: "access-key-id",
      R2_SECRET_ACCESS_KEY: "secret-access-key",
      R2_BUCKET: "dica-attachments",
      R2_UPLOAD_URL_TTL_SECONDS: 600,
      R2_VIEW_URL_TTL_SECONDS: 300,
    }),
  );
  const signed = await storage.createUploadUrl(
    "attachments/org/file.jpg",
    "image/jpeg",
    12,
  );
  const signedHeaders = new URL(signed.url).searchParams.get(
    "X-Amz-SignedHeaders",
  );

  assert.equal(signedHeaders, "content-length;content-type;host;if-none-match");
});

test("finalize kiểm tra object R2 rồi chuyển attachment sang READY", async () => {
  const fixture = createFixture();
  const initialized = await fixture.service.createUpload(user, dto);
  await fixture.service.finalizeUpload(
    user,
    initialized.data.attachment.id as string,
  );

  assert.equal(fixture.getRecord()?.["uploadStatus"], "READY");
  assert.deepEqual(fixture.deleted, []);
});

test("chỉ cấp URL xem R2 sau khi kiểm tra attachment READY", async () => {
  const fixture = createFixture();
  const initialized = await fixture.service.createUpload(user, dto);
  const id = initialized.data.attachment.id as string;
  await fixture.service.finalizeUpload(user, id);
  const result = await fixture.service.viewUrl(user, id);

  assert.equal(result.data.url, "https://r2.example/view");
});

test("danh sách attachment trả URL xem trực tiếp và thời điểm hết hạn", async () => {
  const fixture = createFixture();
  const initialized = await fixture.service.createUpload(user, dto);
  await fixture.service.finalizeUpload(
    user,
    initialized.data.attachment.id as string,
  );
  const result = await fixture.service.list(user, dto);

  assert.equal(result.data[0]?.viewUrl, "https://r2.example/view");
  assert.ok(result.data[0]?.viewUrlExpiresAt instanceof Date);
  assert.equal("objectKey" in result.data[0]!, false);
});

test("finalize xóa file giả ảnh khỏi R2", async () => {
  const fixture = createFixture({ prefix: Buffer.from("not-an-image") });
  const initialized = await fixture.service.createUpload(user, dto);

  await assert.rejects(
    fixture.service.finalizeUpload(
      user,
      initialized.data.attachment.id as string,
    ),
    ApiException,
  );
  assert.equal(fixture.deleted.length, 1);
  assert.equal(fixture.getRecord(), undefined);
});
