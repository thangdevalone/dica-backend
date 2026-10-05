import assert from "node:assert/strict";
import test from "node:test";
import type { AuthUser } from "../src/auth/auth.types.js";
import { ScopeService } from "../src/auth/scope.service.js";
import type { PrismaService } from "../src/database/prisma.service.js";
import { InventoryService } from "../src/inventory/inventory.service.js";
import { NotificationListQueryDto } from "../src/inventory/inventory.dto.js";

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
