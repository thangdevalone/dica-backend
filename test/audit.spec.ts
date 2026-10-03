import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { lastValueFrom, of } from "rxjs";
import { sanitizeAuditValue } from "../src/common/audit/audit-sanitizer.js";
import {
  CONFIG_AUDIT_METADATA,
  type ConfigAuditMetadata,
} from "../src/common/audit/config-audit.decorator.js";
import { ConfigAuditInterceptor } from "../src/common/audit/config-audit.interceptor.js";
import type { PrismaService } from "../src/database/prisma.service.js";

test("che dữ liệu nhạy cảm trong lịch sử cấu hình", () => {
  const result = sanitizeAuditValue({
    username: "admin",
    password: "secret-value",
    nested: { refresh_token: "refresh-value", enabled: true },
  });
  assert.deepEqual(result, {
    username: "admin",
    password: "[REDACTED]",
    nested: { refresh_token: "[REDACTED]", enabled: true },
  });
});

test("interceptor ghi audit cho thay đổi cấu hình thành công", async () => {
  let created: { data: Record<string, unknown> } | undefined;
  const database = {
    auditEvent: {
      create: async (args: { data: Record<string, unknown> }) => {
        created = args;
        return args.data;
      },
    },
  } as unknown as PrismaService;
  const reflector = new Reflector();
  const handler = () => undefined;
  class TestController {}
  Reflect.defineMetadata(
    CONFIG_AUDIT_METADATA,
    { resourceType: "CATALOG_CONFIG" } satisfies ConfigAuditMetadata,
    handler,
  );
  const request = {
    method: "POST",
    originalUrl: "/api/v1/units",
    path: "/units",
    params: {},
    query: {},
    body: { code: "KG", password: "must-not-be-recorded" },
    ip: "127.0.0.1",
    requestId: "test-request-id",
    header: () => "audit-test",
    user: {
      id: "00000000-0000-4000-8000-000000000001",
      organizationId: "00000000-0000-4000-8000-000000000002",
    },
  };
  const response = { statusCode: 201 };
  const context = {
    getType: () => "http",
    getHandler: () => handler,
    getClass: () => TestController,
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
  const interceptor = new ConfigAuditInterceptor(reflector, database);
  const result = await lastValueFrom(
    interceptor.intercept(context, {
      handle: () => of({ data: { id: "unit-id", code: "KG" } }),
    }),
  );

  assert.deepEqual(result, { data: { id: "unit-id", code: "KG" } });
  assert.equal(created?.data["resourceId"], "unit-id");
  assert.equal(created?.data["requestId"], "test-request-id");
  const before = created?.data["beforeData"] as {
    request: { body: { password: string } };
  };
  assert.equal(before.request.body.password, "[REDACTED]");
});
