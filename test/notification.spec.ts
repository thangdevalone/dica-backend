import assert from "node:assert/strict";
import test from "node:test";
import type { AuthUser } from "../src/auth/auth.types.js";
import { ScopeService } from "../src/auth/scope.service.js";
import type { PrismaService } from "../src/database/prisma.service.js";
import { InventoryService } from "../src/inventory/inventory.service.js";
import { NotificationListQueryDto } from "../src/inventory/inventory.dto.js";
import { ConfigService } from "@nestjs/config";
import type { Notification } from "../src/generated/prisma/client.js";
import { PushService } from "../src/push/push.service.js";

test("danh sách thông báo loại tài nguyên đã bị thu hồi scope trước khi phân trang", async () => {
  const notifications = [
    {
      id: "notification-a",
      resourceType: "SupplyRequest",
      resourceId: "request-a",
      title: "Được phép",
    },
    {
      id: "notification-b",
      resourceType: "SupplyRequest",
      resourceId: "request-b",
      title: "Đã mất quyền",
    },
  ];
  const database = {
    notification: {
      findMany: async (args: {
        select?: unknown;
        where?: { id?: { in?: string[] } };
      }) => {
        if (args.select)
          return notifications.map(({ id, resourceType, resourceId }) => ({
            id,
            resourceType,
            resourceId,
          }));
        const allowed = new Set(args.where?.id?.in ?? []);
        return notifications.filter((notification) =>
          allowed.has(notification.id),
        );
      },
      count: async (args: { where?: { id?: { in?: string[] } } }) =>
        args.where?.id?.in?.length ?? 0,
    },
    supplyRequest: {
      findMany: async () => [
        {
          id: "request-a",
          facilityId: "facility-a",
          departmentId: "department-a",
          createdById: "other-user",
        },
        {
          id: "request-b",
          facilityId: "facility-b",
          departmentId: "department-b",
          createdById: "other-user",
        },
      ],
    },
  } as unknown as PrismaService;
  const user: AuthUser = {
    id: "user-a",
    organizationId: "organization-a",
    supplierId: null,
    kind: "INTERNAL",
    username: "staff",
    displayName: "Staff",
    sessionId: "session-a",
    requestId: "request-correlation-id",
    grants: [
      {
        id: "grant-a",
        roleCode: "BRANCH_STAFF",
        permissions: ["notification.read_own", "request.read"],
        scopeType: "FACILITY",
        facilityId: "facility-a",
        stockLocationId: null,
        departmentId: null,
      },
    ],
  };
  const service = new InventoryService(database, new ScopeService());
  const result = await service.notifications(
    user,
    new NotificationListQueryDto(),
  );

  assert.deepEqual(
    result.data.map((notification) => notification.id),
    ["notification-a"],
  );
  assert.equal(result.meta.mode, "offset");
  assert.equal(result.meta.total, 1);
});

test("push kiểm tra quyền hiện tại một lần mỗi người và chỉ gửi thông báo còn được đọc", async () => {
  const user = {
    id: "user-a",
    organizationId: "organization-a",
    supplierId: null,
    kind: "INTERNAL",
    username: "staff",
    displayName: "Staff",
    grants: [
      {
        id: "grant-a",
        scopeType: "FACILITY",
        facilityId: "facility-a",
        stockLocationId: null,
        departmentId: null,
        role: {
          code: "BRANCH_STAFF",
          permissions: [
            { permissionCode: "notification.read_own" },
            { permissionCode: "request.read" },
          ],
        },
      },
    ],
  };
  const database = {
    pushDevice: {
      findMany: async () => [
        {
          id: "device-a",
          userId: user.id,
          token: "token-a",
          platform: "ANDROID",
          user,
        },
        {
          id: "device-b",
          userId: user.id,
          token: "token-b",
          platform: "IOS",
          user,
        },
      ],
    },
  } as unknown as PrismaService;
  const checks: AuthUser[] = [];
  const inventory = {
    readableNotificationIds: async (currentUser: AuthUser, ids: string[]) => {
      checks.push(currentUser);
      assert.deepEqual(ids, ["allowed", "revoked"]);
      return ["allowed"];
    },
  } as unknown as InventoryService;
  const service = new PushService(
    database,
    new ConfigService({ FCM_ENABLED: true }),
    inventory,
  );
  const sent: string[] = [];
  Object.assign(service, {
    send: async (
      _token: string,
      _platform: string,
      notification: Notification,
    ) => {
      sent.push(notification.id);
      return false;
    },
  });
  await service.sendNotifications([
    { id: "allowed", userId: user.id },
    { id: "revoked", userId: user.id },
  ] as Notification[]);
  assert.equal(checks.length, 1);
  assert.equal(checks[0]?.grants[0]?.facilityId, "facility-a");
  assert.deepEqual(checks[0]?.grants[0]?.permissions, [
    "notification.read_own",
    "request.read",
  ]);
  assert.deepEqual(sent, ["allowed", "allowed"]);
});
