import assert from "node:assert/strict";
import test from "node:test";
import type { AuthUser } from "../src/auth/auth.types.js";
import { SourcingService } from "../src/sourcing/sourcing.service.js";

const user: AuthUser = {
  id: "00000000-0000-4000-8000-000000000001",
  organizationId: "00000000-0000-4000-8000-000000000002",
  supplierId: null,
  kind: "INTERNAL",
  username: "reviewer",
  displayName: "Reviewer",
  sessionId: "00000000-0000-4000-8000-000000000003",
  requestId: "00000000-0000-4000-8000-000000000004",
  grants: [],
};

test("cấu hình trực tiếp không giới hạn ghi đè giới hạn của nhóm", async () => {
  const db = {
    ingredient: {
      findMany: async () => [
        {
          id: "00000000-0000-4000-8000-000000000010",
          code: "DUONG",
          name: "Đường",
          groupId: "00000000-0000-4000-8000-000000000011",
          baseUnit: { id: "00000000-0000-4000-8000-000000000012", code: "KG" },
          eligibilities: [
            {
              id: "00000000-0000-4000-8000-000000000013",
              active: true,
              maxQuantityPerRequest: null,
            },
          ],
          group: {
            id: "00000000-0000-4000-8000-000000000011",
            code: "GIAVI",
            name: "Gia vị",
            active: true,
            eligibilities: [
              {
                id: "00000000-0000-4000-8000-000000000014",
                active: true,
                maxQuantityPerRequest: "10",
              },
            ],
          },
        },
      ],
      count: async () => 1,
    },
  };
  const scope = { assertAccess: () => undefined };
  const service = new SourcingService(db as never, scope as never);

  const result = await service.eligibility(user, {
    page: 1,
    page_size: 20,
    pagination_mode: "offset",
    sort_order: "desc",
    facility_id: "00000000-0000-4000-8000-000000000020",
    department_id: "00000000-0000-4000-8000-000000000021",
    effective: true,
  });

  assert.equal(result.data[0]?.grantType, "INGREDIENT");
  assert.equal(result.data[0]?.maxQuantityPerRequest, null);
});
