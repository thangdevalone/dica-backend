import assert from "node:assert/strict";
import test from "node:test";
import { ScopeService } from "../src/auth/scope.service.js";
import type { AuthGrant, AuthUser } from "../src/auth/auth.types.js";
const scope = new ScopeService();
const user: AuthUser = {
  id: "u1",
  organizationId: "o1",
  supplierId: null,
  kind: "INTERNAL",
  username: "staff",
  displayName: "Staff",
  sessionId: "s1",
  requestId: "request-1",
  grants: [
    {
      id: "g1",
      roleCode: "BRANCH_STAFF",
      permissions: ["request.read"],
      scopeType: "DEPARTMENT",
      facilityId: "facility-a",
      stockLocationId: null,
      departmentId: "kitchen-a",
    },
    {
      id: "g2",
      roleCode: "BRANCH_STAFF",
      permissions: ["request.read"],
      scopeType: "DEPARTMENT",
      facilityId: "facility-b",
      stockLocationId: null,
      departmentId: "table-b",
    },
  ],
};
const makeUser = (grants: AuthGrant[]): AuthUser => ({ ...user, grants });
const grant = (overrides: Partial<AuthGrant>): AuthGrant => ({
  id: "grant",
  roleCode: "SCOPED_ROLE",
  permissions: ["request.read"],
  scopeType: "FACILITY",
  facilityId: null,
  stockLocationId: null,
  departmentId: null,
  ...overrides,
});
test("không trộn facility của grant này với department của grant khác", () => {
  assert.equal(
    scope.canAccess(user, "request.read", {
      facilityId: "facility-a",
      departmentId: "table-b",
    }),
    false,
  );
});
test("cho phép đúng cặp facility và department trong cùng grant", () => {
  assert.equal(
    scope.canAccess(user, "request.read", {
      facilityId: "facility-a",
      departmentId: "kitchen-a",
    }),
    true,
  );
});

test("không hạ scope kho xuống toàn bộ facility khi dựng query", () => {
  const user = makeUser([
    grant({
      scopeType: "STOCK_LOCATION",
      facilityId: "facility-a",
      stockLocationId: "stock-a",
    }),
  ]);

  assert.deepEqual(
    scope.constraintsFor(user, "request.read", [
      "facilityId",
      "stockLocationId",
    ]),
    [{ facilityId: "facility-a", stockLocationId: "stock-a" }],
  );
  assert.deepEqual(scope.facilityIds(user, "request.read"), []);
});

test("giữ điều kiện OWN kết hợp facility thay vì mở rộng ra cả facility", () => {
  const user = makeUser([
    grant({ scopeType: "OWN", facilityId: "facility-a" }),
  ]);

  assert.deepEqual(
    scope.constraintsFor(user, "request.read", ["facilityId", "createdById"]),
    [{ facilityId: "facility-a", createdById: user.id }],
  );
  assert.deepEqual(
    scope.constraintsFor(user, "request.read", ["facilityId"]),
    [],
  );
});
