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

test("admin tạo vai trò tùy chỉnh với mã chuẩn hóa và bộ quyền đã kiểm tra", async () => {
  const checkedPermissions: string[] = [];
  const createdPermissions: Array<Record<string, unknown>> = [];
  const roleActor: AuthUser = {
    ...actor,
    grants: [
      {
        id: "00000000-0000-4000-8000-000000000020",
        roleCode: "ADMIN_OWNER",
        permissions: ["role.manage", "request.read", "request.approve"],
        scopeType: ScopeType.ORGANIZATION,
        facilityId: null,
        stockLocationId: null,
        departmentId: null,
      },
    ],
  };
  const createdRole = {
    id: "00000000-0000-4000-8000-000000000021",
    organizationId: actor.organizationId,
    code: "KITCHEN_MANAGER",
    name: "Quản lý bếp",
    system: false,
    active: true,
  };
  const transactionClient = {
    role: {
      create: async ({ data }: { data: Record<string, unknown> }) => ({
        ...createdRole,
        ...data,
      }),
      findUniqueOrThrow: async () => ({
        ...createdRole,
        permissions: createdPermissions,
      }),
    },
    rolePermission: {
      createMany: async ({
        data,
      }: {
        data: Array<Record<string, unknown>>;
      }) => {
        createdPermissions.push(...data);
        return { count: data.length };
      },
    },
  };
  const database = {
    role: { count: async () => 0 },
    permission: {
      findMany: async () => [
        { code: "request.read" },
        { code: "request.approve" },
      ],
    },
    $transaction: async (work: (tx: typeof transactionClient) => unknown) =>
      work(transactionClient),
  };
  const scope = {
    assertAccess: (_actor: AuthUser, permission: string) =>
      checkedPermissions.push(permission),
  };
  const service = new UserService(database as never, scope as never);

  const result = await service.createRole(roleActor, {
    code: "kitchen_manager",
    name: "Quản lý bếp",
    permission_codes: ["request.read", "request.approve"],
  });

  assert.deepEqual(checkedPermissions, ["role.manage"]);
  assert.equal(result.data.code, "KITCHEN_MANAGER");
  assert.deepEqual(
    createdPermissions.map((item) => item.permissionCode),
    ["request.read", "request.approve"],
  );
});

test("admin không thể tạo vai trò chứa quyền cao hơn quyền đang có", async () => {
  const roleActor: AuthUser = {
    ...actor,
    grants: [
      {
        id: "00000000-0000-4000-8000-000000000030",
        roleCode: "LIMITED_ADMIN",
        permissions: ["role.manage"],
        scopeType: ScopeType.ORGANIZATION,
        facilityId: null,
        stockLocationId: null,
        departmentId: null,
      },
    ],
  };
  const database = {
    permission: { findMany: async () => [{ code: "backup.manage" }] },
  };
  const scope = { assertAccess: () => undefined };
  const service = new UserService(database as never, scope as never);

  await assert.rejects(() =>
    service.createRole(roleActor, {
      code: "BACKUP_ADMIN",
      name: "Quản trị sao lưu",
      permission_codes: ["backup.manage"],
    }),
  );
});

test("ADMIN_OWNER được chỉnh bộ quyền vai trò gốc nhưng không được đổi tên", async () => {
  const owner: AuthUser = {
    ...actor,
    grants: [
      {
        id: "00000000-0000-4000-8000-000000000040",
        roleCode: "ADMIN_OWNER",
        permissions: ["role.manage"],
        scopeType: ScopeType.ORGANIZATION,
        facilityId: null,
        stockLocationId: null,
        departmentId: null,
      },
    ],
  };
  const role = {
    id: "00000000-0000-4000-8000-000000000041",
    organizationId: actor.organizationId,
    code: "BRANCH_MANAGER",
    name: "Quản lý chi nhánh",
    system: true,
    active: true,
    permissions: [],
  };
  const savedPermissions: Array<Record<string, unknown>> = [];
  const transactionClient = {
    role: {
      update: async () => role,
      findUniqueOrThrow: async () => ({
        ...role,
        permissions: savedPermissions,
      }),
    },
    rolePermission: {
      deleteMany: async () => ({ count: 1 }),
      createMany: async ({
        data,
      }: {
        data: Array<Record<string, unknown>>;
      }) => {
        savedPermissions.push(...data);
        return { count: data.length };
      },
    },
  };
  const database = {
    role: { findFirst: async () => role },
    permission: { findMany: async () => [{ code: "request.approve" }] },
    $transaction: async (work: (tx: typeof transactionClient) => unknown) =>
      work(transactionClient),
  };
  const service = new UserService(
    database as never,
    {
      assertAccess: () => undefined,
    } as never,
  );

  const result = await service.updateRole(owner, role.id, {
    permission_codes: ["request.approve"],
  });
  assert.equal(result.data.permissions.length, 1);
  await assert.rejects(() =>
    service.updateRole(owner, role.id, {
      name: "Tên mới",
    }),
  );
});

test("không cho bỏ quyền quản trị cốt lõi khỏi ADMIN_OWNER", async () => {
  const owner: AuthUser = {
    ...actor,
    grants: [
      {
        id: "00000000-0000-4000-8000-000000000050",
        roleCode: "ADMIN_OWNER",
        permissions: ["role.manage"],
        scopeType: ScopeType.ORGANIZATION,
        facilityId: null,
        stockLocationId: null,
        departmentId: null,
      },
    ],
  };
  const database = {
    role: {
      findFirst: async () => ({
        id: "00000000-0000-4000-8000-000000000051",
        organizationId: actor.organizationId,
        code: "ADMIN_OWNER",
        name: "Quản trị hệ thống",
        system: true,
        active: true,
        permissions: [],
      }),
    },
    permission: { findMany: async () => [{ code: "dashboard.read" }] },
  };
  const service = new UserService(
    database as never,
    {
      assertAccess: () => undefined,
    } as never,
  );

  await assert.rejects(() =>
    service.updateRole(owner, "00000000-0000-4000-8000-000000000051", {
      permission_codes: ["dashboard.read"],
    }),
  );
});
