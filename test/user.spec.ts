import assert from "node:assert/strict";
import test from "node:test";
import type { AuthUser } from "../src/auth/auth.types.js";
import { ScopeType, UserKind } from "../src/generated/prisma/client.js";
import { UserService } from "../src/users/user.service.js";

const actor: AuthUser = {
  id: "00000000-0000-4000-8000-000000000001",
  organizationId: "00000000-0000-4000-8000-000000000002",
  supplierId: null,
  kind: UserKind.INTERNAL,
  username: "admin",
  displayName: "Admin",
  sessionId: "00000000-0000-4000-8000-000000000003",
  requestId: "request-create-user",
  grants: [],
};

test("admin tạo tài khoản và role grant trong cùng transaction", async () => {
  const checkedPermissions: string[] = [];
  let userData: Record<string, unknown> | undefined;
  let grantData: Record<string, unknown> | undefined;
  let transactionCalls = 0;
  const role = {
    id: "00000000-0000-4000-8000-000000000010",
    organizationId: actor.organizationId,
    code: "STAFF",
    name: "Nhân viên",
    system: true,
    active: true,
  };
  const transactionClient = {
    user: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        userData = data;
        return {
          id: "00000000-0000-4000-8000-000000000011",
          username: data.username,
          displayName: data.displayName,
          kind: data.kind,
          supplierId: null,
          active: true,
          createdAt: new Date(),
        };
      },
    },
    roleGrant: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        grantData = data;
        return { id: "00000000-0000-4000-8000-000000000012", ...data };
      },
    },
  };
  const database = {
    role: { findFirst: async () => role },
    user: { count: async () => 0 },
    $transaction: async (work: (tx: typeof transactionClient) => unknown) => {
      transactionCalls += 1;
      return work(transactionClient);
    },
  };
  const scope = {
    assertAccess: (_actor: AuthUser, permission: string) =>
      checkedPermissions.push(permission),
  };
  const service = new UserService(database as never, scope as never);

  const result = await service.create(actor, {
    username: "NhanVien01",
    display_name: "",
    password: "mat-khau-an-toan",
    kind: UserKind.INTERNAL,
    role_id: role.id,
    scope_type: ScopeType.ORGANIZATION,
  });

  assert.deepEqual(checkedPermissions, ["user.create", "grant.assign"]);
  assert.equal(transactionCalls, 1);
  assert.equal(userData?.username, "nhanvien01");
  assert.equal(userData?.displayName, "nhanvien01");
  assert.equal(grantData?.roleId, role.id);
  assert.equal(grantData?.scopeType, ScopeType.ORGANIZATION);
  assert.equal(result.data.grants.length, 1);
});
