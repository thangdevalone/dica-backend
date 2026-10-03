---
name: senior-patterns
description: >-
  Use this skill when writing production-quality code, reviewing for senior-level
  patterns, or when the task involves concurrency safety, defensive coding,
  Decimal arithmetic, audit trails, or security hardening in the DICA backend.
  Covers battle-tested patterns extracted from the existing codebase.
---

# Senior Code Patterns — DICA Backend

This skill documents the production-grade patterns already used in the codebase.
Follow these patterns when writing new code to maintain consistency and
robustness.

---

## 1. Concurrency Safety

### Optimistic Locking with Guard Pattern

**Never** read-then-write without a guard. Use `updateMany` + count:

```typescript
// ✅ Senior pattern: atomic guard
const guard = await tx.fulfillmentOrder.updateMany({
  where: {
    id,
    version: dto.expected_version,  // optimistic lock
    status: OrderStatus.RELEASED,   // state guard
  },
  data: {
    status: OrderStatus.CANCELLED,
    version: { increment: 1 },
  },
});
if (guard.count !== 1)
  throw new ApiException(
    ErrorCode.VERSION_CONFLICT,
    "Đơn vừa được cập nhật bởi thao tác khác. Vui lòng tải lại.",
    HttpStatus.CONFLICT,
  );
```

**Why `updateMany` instead of `update`?**
- `update` throws `RecordNotFound` if the WHERE doesn't match
- `updateMany` returns `{ count: 0 }` — lets you give a meaningful error
- No race condition between check and update

### Token Rotation with Hash Guard

```typescript
// Atomic refresh token rotation — prevents replay attacks
const rotated = await this.prisma.session.updateMany({
  where: {
    id: session.id,
    refreshTokenHash: this.hash(oldToken),  // hash guard
    revokedAt: null,
    expiresAt: { gt: new Date() },
  },
  data: { refreshTokenHash: this.hash(newToken) },
});
if (rotated.count !== 1) throw new ApiException(...);
```

### Idempotency for Non-Idempotent Operations

```typescript
const { value, replayed } = await this.idempotency.execute(
  user,
  `payment.update:${orderId}`,  // operation scope
  key,                           // client-provided key
  dto,                           // request payload (hashed for dedup)
  async (tx) => {
    // Business logic inside Serializable transaction
    return result as Prisma.JsonObject;
  },
);
return {
  data: result.value,
  message: replayed
    ? "Kết quả đã được ghi nhận trước đó; trả lại kết quả cũ."
    : "Thao tác thành công.",
};
```

---

## 2. Defensive Coding

### Never Leak Resource Existence

```typescript
// ✅ Senior: 404 for both "not found" and "no access"
if (!entity) this.notFound();
if (!this.scope.canAccess(u, permission, resource)) this.notFound();

// ❌ Junior: leaks that resource exists but user lacks access
if (!entity) throw new NotFoundException();
if (!allowed) throw new ForbiddenException();
```

### Multi-Scope Access Check (OR logic)

For resources accessible via multiple scopes (source OR destination):

```typescript
const allowed =
  this.scope.canAccess(u, "order.read", {
    facilityId: order.destinationStockLocation.facilityId,
    stockLocationId: order.destinationStockLocationId,
  }) ||
  (order.sourceStockLocation
    ? this.scope.canAccess(u, "order.read", {
        facilityId: order.sourceStockLocation.facilityId,
        stockLocationId: order.sourceStockLocationId,
      })
    : false);
if (!allowed) this.notFound();
```

### Type-Safe `notFound()` Helper

```typescript
// Returns `never` — TypeScript knows code after this is unreachable
private notFound(): never {
  throw new ApiException(
    ErrorCode.RESOURCE_NOT_FOUND,
    "Không tìm thấy dữ liệu hoặc bạn không có quyền truy cập.",
    HttpStatus.NOT_FOUND,
  );
}
```

### Supplier User Checks

```typescript
// ✅ Always verify supplierId exists before supplier-scoped queries
if (!u.supplierId) this.notFound();

// Then filter by it
const where = { supplierId: u.supplierId, organizationId: u.organizationId };
```

### Internal-Only Endpoints

```typescript
private assertInternal(user: AuthUser) {
  if (user.kind !== UserKind.INTERNAL) this.notFound();
}
```

---

## 3. Decimal Arithmetic

Prisma returns `Prisma.Decimal` objects. **Never convert to `number`** for
arithmetic — use the Decimal API:

```typescript
// ✅ Senior: Decimal arithmetic
const closable = order.lines
  .map((line) => ({
    id: line.id,
    quantity: line.approvedQuantity
      .sub(line.receivedQuantity)
      .sub(line.closedRemainingQuantity),
  }))
  .filter((line) => line.quantity.gt(0));

// ✅ Comparison
if (paidValue.gt(reconciledValue)) throw ...;
if (line.dispatchedQuantity.gt(line.receivedQuantity)) throw ...;

// ✅ Aggregation
const total = lines.reduce(
  (sum, line) => sum.add(
    line.receivedQuantity
      .add(line.acceptedExcessQuantity)
      .mul(line.unitPriceSnapshot!),
  ),
  new Prisma.Decimal(0),
);

// ✅ Serialization: always use toString() or toFixed()
response.reconciled_value = reconciledValue.toFixed(4);

// ❌ Bad: loses precision
const total = Number(line.approvedQuantity) - Number(line.receivedQuantity);
```

### Decimal Validation for API Input

```typescript
import { assertPositiveDecimal } from "../common/utils/decimal.js";

// Validates format: positive, max 3 decimal places
const validQty = assertPositiveDecimal(dto.quantity, "quantity");
```

---

## 4. State Machine Safety

### Pre-Condition Checks Before Mutations

Always validate the full precondition set before attempting a state transition:

```typescript
// 1. Version check
if (order.version !== dto.expected_version)
  throw new ApiException(ErrorCode.VERSION_CONFLICT, ...);

// 2. Valid status for transition
if (order.status !== OrderStatus.RELEASED && order.status !== OrderStatus.PARTIAL)
  throw new ApiException(ErrorCode.INVALID_STATE, "Trạng thái không hợp lệ.", ...);

// 3. Business invariants
if (order.lines.some((l) => l.dispatchedQuantity.gt(l.receivedQuantity)))
  throw new ApiException(ErrorCode.INVALID_STATE, "Còn hàng đang vận chuyển.", ...);

// 4. No unresolved dependencies
if (order.receipts.some((r) => r.discrepancies.some((d) => d.status === "OPEN")))
  throw new ApiException(ErrorCode.INVALID_STATE, "Còn chênh lệch chưa xử lý.", ...);

// 5. Something to act on
if (closable.length === 0)
  throw new ApiException(ErrorCode.INVALID_STATE, "Không còn số lượng cần đóng.", ...);
```

### Feature Flags for Unfinished Policies

```typescript
if (!this.config.get<boolean>("DEMO_POLICY_ENABLED", false))
  throw new ApiException(
    ErrorCode.POLICY_NOT_CONFIGURED,
    "Chính sách chưa được chốt cho production.",
    HttpStatus.UNPROCESSABLE_ENTITY,
  );
```

---

## 5. Audit & Traceability

### Manual Audit Inside Transactions

```typescript
await tx.auditEvent.create({
  data: {
    organizationId: u.organizationId,
    actorId: u.id,
    action: "order.cancel",                    // <resource>.<action>
    resourceType: "FulfillmentOrder",           // Prisma model name
    resourceId: id,
    requestId: `order-cancel:${id}:${version}`, // unique per operation
    beforeData: { status: order.status, version: order.version },
    afterData: { status: updated.status, version: updated.version, reason: dto.reason },
  },
});
```

### Config Audit (automatic via decorator)

```typescript
@ConfigAudit("SOURCING_CONFIG")
@Controller()
export class SourcingController { ... }
// All POST/PUT/PATCH/DELETE are automatically logged
```

### Revision History Pattern

For configuration data that needs full change history:

```typescript
// SourceRule has SourceRuleRevision — append-only history
const revision = (old?.revision ?? 0) + 1;
await tx.sourceRuleRevision.create({
  data: {
    sourceRuleId: data.id,
    revision,
    ...(old ? { beforeData: { source_type: old.sourceType, ... } } : {}),
    afterData: { source_type: d.source_type, ... },
    changedById: u.id,
  },
});
```

---

## 6. Security Patterns

### Password Hashing

```typescript
import * as argon2 from "argon2";

// Hash
const hash = await argon2.hash(password);

// Verify (with catch for malformed hashes)
const valid = await argon2.verify(user.passwordHash, password).catch(() => false);
```

### Token Security

- Access tokens: short-lived (15m), verified with dedicated secret
- Refresh tokens: stored as **SHA-256 hash** in DB, rotated on every use
- Token version: `user.tokenVersion` — increment to force logout all sessions
- Session: has `revokedAt` + `expiresAt` — checked on every request

### Input Sanitization

```typescript
// Limit string length in DB writes
client.userAgent ? { userAgent: client.userAgent.slice(0, 500) } : {}

// Audit sanitizer redacts sensitive keys automatically
sanitizeAuditValue({ password: "secret", name: "visible" })
// → { password: "[REDACTED]", name: "visible" }
```

### Structured Logging Redaction

Configured in `app.module.ts`:

```typescript
redact: {
  paths: [
    "req.headers.authorization", "req.headers.cookie",
    "password", "password_hash", "access_token",
    "refresh_token", "token", "secret",
  ],
  censor: "[REDACTED]",
},
```

---

## 7. Code Organization

### Private Helper Methods

Use `private` methods to keep service methods focused:

```typescript
// ✅ Reusable helpers
private notFound(): never { ... }
private invalid(message: string): never { ... }
private assertInternal(user: AuthUser): void { ... }
private assertOrderScope(user, permission, order): void { ... }
private reconciledValue(lines): Prisma.Decimal { ... }
private stockLocationScope(user, permission): Prisma.WhereInput { ... }
```

### DTO Inheritance for Common Fields

```typescript
export class CloseOutstandingDto {
  @IsInt() @Min(1) expected_version!: number;
  @IsString() @Length(3, 1000) reason!: string;
}

// Reuse for similar operations
export class CancelOrderDto extends CloseOutstandingDto {}
```

### Consistent Error Messages

- Always in Vietnamese
- Describe what went wrong from the user's perspective
- Never expose internal details (table names, SQL errors)
- Use same message for "not found" and "no access" (security)

---

## 8. Checklist for Senior-Quality Code

1. [ ] All state transitions guarded by `updateMany` + `version` check
2. [ ] No TOCTOU races — validate and update atomically
3. [ ] Decimal arithmetic uses Prisma.Decimal API (never `Number()`)
4. [ ] Access denied returns 404 (never 403 for resources)
5. [ ] `supplierId` checked before supplier-scoped queries
6. [ ] Audit events created inside the same transaction
7. [ ] Feature flags for unfinished business rules
8. [ ] Private `notFound(): never` helper on every service
9. [ ] Parallel `Promise.all()` for independent validations
10. [ ] Input strings sliced to match DB column limits
11. [ ] Sensitive data redacted in audit logs
12. [ ] Error messages in Vietnamese, user-facing perspective
