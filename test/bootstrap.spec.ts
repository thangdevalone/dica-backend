import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCESS_CONTROL_VERSION,
  SYSTEM_PERMISSIONS,
  SYSTEM_ROLE_PERMISSIONS,
} from "../src/auth/access-control.catalog.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { bootstrapProduction } from "../src/scripts/bootstrap.js";

const environment = {
  databaseUrl: "postgresql://unused",
  organizationCode: "DICA",
  organizationName: "DICA",
  adminUsername: "admin",
  adminDisplayName: "Quản trị DICA",
};

test("mọi quyền của role hệ thống đều tồn tại trong catalog", () => {
  const permissions = new Set<string>(SYSTEM_PERMISSIONS);
  const missing = Object.values(SYSTEM_ROLE_PERMISSIONS)
    .flat()
    .filter((permission) => !permissions.has(permission));
  assert.deepEqual(missing, []);
  assert.ok(ACCESS_CONTROL_VERSION > 0);
});

test("bootstrap bỏ qua khi access-control version đã được áp dụng", async () => {
  const database = {
    bootstrapState: {
      findUnique: async () => ({ version: ACCESS_CONTROL_VERSION }),
    },
    $transaction: async () => {
      throw new Error("Không được mở transaction khi version đã hiện hành.");
    },
  };

  const result = await bootstrapProduction(
    database as unknown as PrismaClient,
    environment,
  );
  assert.deepEqual(result, {
    applied: false,
    version: ACCESS_CONTROL_VERSION,
  });
});

test("nâng version role không tạo lại hoặc đổi mật khẩu admin hiện hữu", async () => {
  let userCreateCalls = 0;
  let stateVersion = 0;
  const transactionClient = {
    organization: {
      upsert: async () => ({ id: "organization-id" }),
    },
    permission: { upsert: async () => ({}) },
    role: {
      upsert: async ({ create }: { create: { code: string } }) => ({
        id: `role-${create.code}`,
      }),
    },
    rolePermission: {
      deleteMany: async () => ({}),
      createMany: async () => ({}),
    },
    user: {
      create: async () => {
        userCreateCalls += 1;
        return { id: "new-admin" };
      },
    },
    roleGrant: {
      findFirst: async () => ({ id: "existing-grant" }),
      create: async () => {
        throw new Error("Không được tạo grant trùng.");
      },
    },
    bootstrapState: {
      upsert: async ({ update }: { update: { version: number } }) => {
        stateVersion = update.version;
        return {};
      },
    },
  };
  const database = {
    bootstrapState: {
      findUnique: async () => ({
        version: 0,
        adminUserId: "existing-admin",
      }),
    },
    organization: {
      findUnique: async () => ({ id: "organization-id" }),
    },
    user: {
      findFirst: async ({ where }: { where: { id: string } }) => {
        assert.equal(where.id, "existing-admin");
        return { id: "existing-admin" };
      },
      findUnique: async () => {
        throw new Error(
          "Không được phụ thuộc username sau bootstrap đầu tiên.",
        );
      },
    },
    $transaction: async (
      work: (tx: typeof transactionClient) => Promise<void>,
    ) => work(transactionClient),
  };

  const result = await bootstrapProduction(
    database as unknown as PrismaClient,
    environment,
  );
  assert.equal(result.applied, true);
  assert.equal(userCreateCalls, 0);
  assert.equal(stateVersion, ACCESS_CONTROL_VERSION);
});
