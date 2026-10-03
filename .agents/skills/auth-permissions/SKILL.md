---
name: auth-permissions
description: >-
  Use this skill when working with authentication, authorization, JWT tokens,
  guards, permission checks, data scoping, or the RBAC system in the DICA
  backend. Covers guards, decorators, AuthUser, ScopeService, and permission
  patterns.
---

# Authentication & Authorization — DICA Backend

## Architecture Overview

```text
Request → AccessTokenGuard → PermissionGuard → Controller → Service
              ↓                    ↓
        Verify JWT token    Check permissions
        Load user + grants  from @RequirePermissions
        Attach to req.user
```

---

## 1. Guard Pipeline

Two global guards are registered via `APP_GUARD` in `AuthModule`:

### AccessTokenGuard

- Extracts `Bearer <token>` from `Authorization` header
- Verifies JWT with `JWT_ACCESS_SECRET`
- Loads user from DB with active session, grants, roles, and permissions
- Attaches `AuthUser` to `req.user`
- Skips if handler is decorated with `@Public()`

### PermissionGuard

- Reads `@RequirePermissions(...)` metadata
- Checks all required permissions exist in `req.user.grants`
- Throws 403 `FORBIDDEN` if missing

---

## 2. Decorators

### `@Public()`

Opt-out from authentication. Use for login, health, public endpoints:

```typescript
import { Public } from "../auth/decorators/public.decorator.js";

@Public()
@Post("auth/login")
login(@Body() d: LoginDto) { ... }
```

### `@RequirePermissions(...permissions)`

Require one or more permissions on the handler:

```typescript
import { RequirePermissions } from "../auth/decorators/permissions.decorator.js";

@RequirePermissions("order.read")
@Get("orders")
list(...) { ... }

// Multiple permissions (ALL required)
@RequirePermissions("order.read", "order.create")
```

### `@CurrentUser()`

Extract the authenticated user:

```typescript
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import type { AuthUser } from "../auth/auth.types.js";

@Get("me")
me(@CurrentUser() u: AuthUser) { ... }
```

---

## 3. AuthUser Type

```typescript
interface AuthUser {
  id: string;                   // User UUID
  organizationId: string;       // Tenant isolation key
  supplierId: string | null;    // Linked supplier (for SUPPLIER users)
  kind: "INTERNAL" | "SUPPLIER";
  username: string;
  displayName: string;
  sessionId: string;
  grants: AuthGrant[];          // Active role grants
}

interface AuthGrant {
  id: string;
  roleCode: string;
  permissions: string[];
  scopeType: "ORGANIZATION" | "FACILITY" | "STOCK_LOCATION"
           | "DEPARTMENT" | "OWN" | "SUPPLIER";
  facilityId: string | null;
  stockLocationId: string | null;
  departmentId: string | null;
}
```

---

## 4. ScopeService — Data-Level Access Control

`ScopeService` is globally exported from `AuthModule`. Use it in services to
enforce row-level access control.

### `facilityIds(user, permission): string[] | null`

Returns the list of facility IDs the user can access for a given permission.
Returns `null` if the user has `ORGANIZATION` scope (access all).

```typescript
const ids = this.scope.facilityIds(u, "order.read");
// ids = null → no filter needed (org-wide)
// ids = ["uuid-1", "uuid-2"] → filter by these facilities

const where = {
  organizationId: u.organizationId,
  ...(ids ? { facilityId: { in: ids } } : {}),
};
```

### `constraintsFor(user, permission, supportedDimensions): ResourceScope[] | null`

**Most commonly used method** — builds WHERE conditions for list endpoints.
Returns `null` if user has org-wide access, or an array of scope constraints to
OR together.

The `supportedDimensions` parameter declares which scope dimensions the resource
model actually has. Grants with unsupported dimensions are **excluded** (fail
closed) to avoid accidentally widening access.

```typescript
const access = this.scope.constraintsFor(u, "stock.read", [
  "facilityId",
  "stockLocationId",
]);

const where = {
  stockLocation: {
    facility: { organizationId: u.organizationId },
    ...(access
      ? {
          OR: access.map((item) => ({
            ...(item.facilityId ? { facilityId: item.facilityId } : {}),
            ...(item.stockLocationId ? { id: item.stockLocationId } : {}),
          })),
        }
      : {}),
  },
};
```

### `canAccess(user, permission, resource): boolean`

Check if user can access a specific resource:

```typescript
const allowed = this.scope.canAccess(u, "order.read", {
  facilityId: order.facilityId,
  stockLocationId: order.stockLocationId,
});
if (!allowed) this.notFound(); // 404, not 403!
```

### `assertAccess(user, permission, resource): void`

Throws 404 if user cannot access:

```typescript
this.scope.assertAccess(u, "feature.read", {
  facilityId: resource.facilityId,
});
```

### Scope Resolution Logic

| scopeType        | Access Rule |
|:---------------- |:----------- |
| `ORGANIZATION`   | Full org access — no facility filter |
| `FACILITY`       | Only resources in `grant.facilityId` |
| `STOCK_LOCATION` | Only resources in `grant.stockLocationId` |
| `DEPARTMENT`     | Only resources in `grant.departmentId` |
| `OWN`            | Only resources where `createdById === user.id` |
| `SUPPLIER`       | Only resources where `supplierId === user.supplierId` |

---

## 5. JWT Token System

### Token Types

| Token   | Secret              | Default TTL | Purpose |
|:------- |:------------------- |:----------- |:------- |
| Access  | `JWT_ACCESS_SECRET`  | 15m         | API authentication |
| Refresh | `JWT_REFRESH_SECRET` | 7d          | Token rotation |

### Token Payload

```typescript
interface TokenPayload {
  sub: string;              // User ID
  sid: string;              // Session ID
  org: string;              // Organization ID
  ver: number;              // Token version (for forced logout)
  typ: "access" | "refresh";
}
```

### Token Rotation

- Refresh tokens are stored as SHA-256 hashes in `Session.refreshTokenHash`
- On refresh, the old hash is compared and atomically replaced (rotation)
- If hash doesn't match, the session may have been compromised → reject

### Force Logout

Increment `user.tokenVersion` to invalidate all existing tokens for a user.

---

## 6. Common Patterns

### Public Endpoint

```typescript
@Public()
@Throttle({ default: { limit: 5, ttl: 60000 } })
@Post("auth/login")
login(@Body() d: LoginDto, @Ip() ip: string) { ... }
```

### Supplier-Only Endpoint

```typescript
@Get("supplier/orders")
@RequirePermissions("supplier_order.read_own")
supplierList(@CurrentUser() u: AuthUser, @Query() q: PaginationDto) {
  if (!u.supplierId) this.notFound();
  // Filter by u.supplierId
}
```

### Access-Denied Handling

**Always return 404 instead of 403** to prevent leaking resource existence:

```typescript
if (!allowed) this.notFound(); // throws RESOURCE_NOT_FOUND + 404
```

---

## 7. Permission Naming Convention

Format: `<resource>.<action>`

Examples:
- `order.read`, `order.create`, `order.cancel`, `order.close_outstanding`
- `supplier_order.read_own`
- `eligibility.read`, `eligibility.manage`
- `source_rule.read`, `source_rule.manage`, `source_rule.bulk_update`
- `inventory.read`, `inventory.adjust`
