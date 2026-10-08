import assert from "node:assert/strict";
import test from "node:test";
import type { AuthUser } from "../src/auth/auth.types.js";
import { Prisma } from "../src/generated/prisma/client.js";
import { RequestService } from "../src/requests/request.service.js";

const user: AuthUser = {
  id: "00000000-0000-4000-8000-000000000001",
  organizationId: "00000000-0000-4000-8000-000000000002",
  supplierId: null,
  kind: "INTERNAL",
  username: "reviewer",
  displayName: "Reviewer",
  sessionId: "00000000-0000-4000-8000-000000000003",
  requestId: "http-correlation-id",
  grants: [],
};

test("từ chối phiếu ghi đúng ID phiếu vào approval event", async () => {
  const requestId = "00000000-0000-4000-8000-000000000010";
  let approvalRequestId: string | undefined;
  const request = {
    id: requestId,
    organizationId: user.organizationId,
    facilityId: "00000000-0000-4000-8000-000000000011",
    departmentId: "00000000-0000-4000-8000-000000000012",
    createdById: user.id,
    status: "SUBMITTED",
    version: 3,
  };
  const tx = {
    supplyRequest: {
      findFirst: async () => request,
      updateMany: async () => ({ count: 1 }),
      findUniqueOrThrow: async () => ({
        ...request,
        status: "REJECTED",
        version: 4,
      }),
    },
    approvalEvent: {
      create: async ({ data }: { data: { requestId: string } }) => {
        approvalRequestId = data.requestId;
        return data;
      },
    },
    outboxEvent: { create: async () => ({}) },
  };
  const db = {
    $transaction: async (fn: (client: typeof tx) => unknown) => fn(tx),
  };
  const scope = { assertAccess: () => undefined };
  const service = new RequestService(db as never, scope as never, {} as never);

  await service.reject(user, requestId, {
    expected_version: 3,
    note: "Không duyệt",
  });

  assert.equal(approvalRequestId, requestId);
  assert.notEqual(approvalRequestId, user.requestId);
});

test("không duyệt phiếu khi nhà cung cấp đã ngừng hoạt động", async () => {
  const requestId = "00000000-0000-4000-8000-000000000020";
  const ingredientId = "00000000-0000-4000-8000-000000000021";
  const supplierId = "00000000-0000-4000-8000-000000000022";
  let createdOrder = false;
  const tx = {
    supplyRequest: {
      findFirst: async () => ({
        id: requestId,
        organizationId: user.organizationId,
        facilityId: "00000000-0000-4000-8000-000000000023",
        departmentId: "00000000-0000-4000-8000-000000000024",
        status: "SUBMITTED",
        version: 1,
        facility: { active: true },
        department: {
          active: true,
          stockLocationId: "00000000-0000-4000-8000-000000000025",
          stockLocation: { active: true },
        },
        lines: [
          {
            id: "00000000-0000-4000-8000-000000000026",
            ingredientId,
            ingredient: { active: true, groupId: null },
            sourceRuleRevision: 1,
            sourceTypeSnapshot: "SUPPLIER",
            sourceStockLocationId: null,
            supplierId,
            baseQuantity: new Prisma.Decimal(5),
            unitCodeSnapshot: "KG",
          },
        ],
      }),
    },
    sourceRule: {
      findMany: async () => [
        {
          ingredientId,
          revision: 1,
          active: true,
          sourceType: "SUPPLIER",
          sourceStockLocation: null,
          supplierId,
          supplier: { active: false },
        },
      ],
    },
    itemEligibility: {
      findMany: async () => [
        { ingredientId, active: true, maxQuantityPerRequest: null },
      ],
    },
    groupEligibility: { findMany: async () => [] },
    supplierIngredient: { findMany: async () => [] },
    fulfillmentOrder: {
      create: async () => {
        createdOrder = true;
        return {};
      },
    },
  };
  const db = {};
  const scope = { assertAccess: () => undefined };
  const idem = {
    requireKey: (key?: string) => key!,
    execute: async (
      _actor: AuthUser,
      _operation: string,
      _key: string,
      _payload: unknown,
      fn: (client: typeof tx) => Promise<unknown>,
    ) => ({ value: await fn(tx), replayed: false }),
  };
  const service = new RequestService(
    db as never,
    scope as never,
    idem as never,
  );

  await assert.rejects(
    () =>
      service.approve(user, requestId, { expected_version: 1 }, "approve-key"),
    /Nguồn cấp hoặc quyền xin hàng đã thay đổi/,
  );
  assert.equal(createdOrder, false);
});
