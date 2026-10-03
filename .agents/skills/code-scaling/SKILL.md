---
name: code-scaling
description: >-
  Use this skill when designing for scalability, adding new features that must
  scale, refactoring for extensibility, or planning architectural changes in the
  DICA backend. Covers module boundaries, shared abstractions, event outbox,
  multi-tenant scaling, and extensibility patterns.
---

# Code Scaling & Extensibility — DICA Backend

## 1. Current Architecture Patterns

### Module Boundaries

The codebase follows a **feature-slice** architecture. Each module is a
self-contained vertical slice:

```text
src/
├── auth/        → Authentication & RBAC (global)
├── catalog/     → Ingredients, units, conversions, suppliers
├── sourcing/    → Source rules, eligibility configuration
├── requests/    → Supply requests, approval workflow
├── orders/      → Fulfillment orders
├── delivery/    → Dispatches, receipts, discrepancies
├── inventory/   → Stock balances, ledger, notifications
├── transfers/   → Inter-location transfers
├── operations/  → Adjustments, stocktakes, damage reports
├── reporting/   → Payment tracking, stock/variance reports
├── ipos/        → Menu mappings, recipes, sales, variance calc
├── organization/→ Facilities, stock locations, departments, users
├── system/      → Admin (roles, permissions, alerts)
└── common/      → Shared abstractions (horizontal concerns)
```

### Key Extension Points

| Concern              | Pattern                            | Location |
|:-------------------- |:---------------------------------- |:---------- |
| New feature          | Add feature module                 | `src/<feature>/` |
| New permission       | Add to seed + `permissions` table  | `prisma/seed.ts` |
| New error type       | Add to `ErrorCode` const           | `src/common/errors/error-codes.ts` |
| New env variable     | Add to Joi schema                  | `src/config/env.validation.ts` |
| New audit events     | `@ConfigAudit` or manual in tx     | Per module |
| New notification     | Create `Notification` row          | Per module |
| Async processing     | Write to `OutboxEvent` table       | Per module |

---

## 2. Multi-Tenant Scaling

### Data Isolation Pattern

Every query MUST include `organizationId` filtering. The pattern is consistent:

```typescript
// List endpoint: filter + scope
const where = {
  organizationId: u.organizationId,
  ...(scopeFilter),
};

// Detail endpoint: find + verify scope
const entity = await this.db.model.findFirst({
  where: { id, organizationId: u.organizationId },
});
if (!entity) this.notFound();
this.scope.assertAccess(u, permission, { facilityId: entity.facilityId });
```

### Scaling Considerations

- **Shared database, schema-per-tenant isolation** via `organizationId` FK.
- **Indexes always lead with tenant key** where applicable.
- **No cross-org queries** — no JOINs between organizations.
- Future: partition by `organizationId` if table exceeds 100M rows.

---

## 3. Event-Driven Extension (Outbox Pattern)

The `OutboxEvent` model exists for eventual consistency / async processing:

```prisma
model OutboxEvent {
  id            String       @id @default(uuid())
  type          String       // e.g., "order.completed", "receipt.posted"
  aggregateType String       // e.g., "FulfillmentOrder"
  aggregateId   String       // Resource UUID
  payload       Json
  status        OutboxStatus // PENDING → PROCESSING → COMPLETED | FAILED
  attempts      Int          @default(0)
  availableAt   DateTime     @default(now())
  processedAt   DateTime?
  lastError     String?
  createdAt     DateTime     @default(now())

  @@index([status, availableAt, createdAt])
}
```

### Adding New Async Events

Write to outbox inside the same transaction as the business operation:

```typescript
await this.db.$transaction(async (tx) => {
  // 1. Perform business operation
  const order = await tx.fulfillmentOrder.update({ ... });

  // 2. Write to outbox (same transaction = atomic)
  await tx.outboxEvent.create({
    data: {
      type: "order.completed",
      aggregateType: "FulfillmentOrder",
      aggregateId: order.id,
      payload: { orderId: order.id, organizationId: u.organizationId },
    },
  });
}, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
```

### Outbox Processor (planned)

A separate worker polls `OutboxEvent` where `status = PENDING` and
`availableAt <= now()`, processes them, and marks as `COMPLETED` or `FAILED`
with retry logic.

---

## 4. Shared Abstraction Patterns

### Pagination Abstraction

`paginateById` is the single pagination abstraction used across ALL list
endpoints. It handles:
- Offset mode (count + skip/take)
- Cursor mode (take+1 trick, no count)
- Unified meta format

**Extending pagination** — if you need custom sort or search:

```typescript
const { data, meta } = await paginateById(
  q,
  (window) => this.db.model.findMany({ ... }),
  () => this.db.model.count({ ... }),
  { sortHandled: true, searchHandled: true },  // declare what you handle
);
```

### Scope Abstraction

`ScopeService` is the single access-control abstraction:

| Method            | Use Case                                 |
|:----------------- |:---------------------------------------- |
| `constraintsFor`  | Build WHERE clause for list endpoints    |
| `canAccess`       | Check single resource access             |
| `assertAccess`    | Check + throw 404                        |
| `facilityIds`     | Get allowed facility IDs for simple cases |

**The `constraintsFor` pattern** (most common for list endpoints):

```typescript
// constraintsFor returns null (org-wide) or ResourceScope[] (OR conditions)
const access = this.scope.constraintsFor(u, "feature.read", [
  "facilityId",         // declare which dimensions this resource supports
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

### Idempotency Abstraction

`IdempotencyService.execute()` provides at-most-once semantics:
- Validates the Idempotency-Key header
- Deduplicates requests by hashing the payload
- Returns cached response on replay
- Uses Serializable isolation with retry logic

### Error Abstraction

All errors go through `ApiException` + `ErrorCode` + `HttpExceptionFilter`.
New error types are added to `ErrorCode` — never create parallel error systems.

---

## 5. Adding a New Feature Module

### Step-by-Step

1. **Create module files** in `src/<feature>/`
2. **Add Prisma model** to `prisma/schema.prisma`
3. **Add permissions** to `prisma/seed.ts`
4. **Register module** in `src/app.module.ts`
5. **Add env vars** (if any) to `src/config/env.validation.ts` + `.env.example`
6. **Add error codes** (if any) to `src/common/errors/error-codes.ts`
7. **Run migration** + `prisma:generate`

### Dependency Rules

```text
Feature Module → can depend on → common/, database/, auth/ (all global)
Feature Module → should NOT depend on → other feature modules directly
Feature Module → should communicate via → OutboxEvent for async, or direct
                                          DB query for read-only cross-module
```

---

## 6. Scalability Patterns Already In Place

| Pattern                  | Implementation                                    |
|:------------------------ |:------------------------------------------------- |
| Optimistic locking       | `version` column + `updateMany` guard             |
| Idempotency              | `IdempotencyService` + `IdempotencyRecord` table  |
| Event outbox             | `OutboxEvent` table (transactional outbox)         |
| Immutable audit log      | `AuditEvent` table (append-only)                  |
| Configurable rate limit  | `@nestjs/throttler` (120 req/min default)          |
| Connection pooling       | `@prisma/adapter-pg` with configurable pool        |
| Structured logging       | `nestjs-pino` with request correlation             |
| Request correlation      | `x-request-id` header → `req.requestId`            |
| Graceful shutdown        | `app.enableShutdownHooks()`                        |
| Revision history         | `SourceRuleRevision` pattern (versioned snapshots) |

---

## 7. Future Scaling Considerations

### When to Split Services

Split a module when:
- Service file exceeds ~500 lines of complex business logic
- Two distinct sub-domains emerge (e.g., `delivery/` could split into
  `dispatch/` + `receipt/`)
- Different scaling requirements (read-heavy vs write-heavy)

### When to Add Caching

Add caching for:
- Organization/facility config that rarely changes
- Permission lookups (currently loaded per-request in AccessTokenGuard)
- Frequently accessed reference data (ingredients, units)

**Do NOT cache**:
- Transactional data (stock balances, order statuses)
- User-specific data with fine-grained permissions

### Database Partitioning

Consider partitioning when:
- `audit_events` exceeds 50M rows → partition by `created_at` (monthly)
- `stock_ledger_entries` exceeds 100M → partition by `posted_at` (monthly)
- `outbox_events` → purge completed events periodically
