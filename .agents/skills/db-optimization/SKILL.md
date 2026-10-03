---
name: db-optimization
description: >-
  Use this skill when optimizing database queries, adding indexes, reducing N+1
  problems, tuning Prisma queries, or improving the performance of PostgreSQL
  operations in the DICA backend. Covers indexing strategy, query patterns,
  connection pooling, and transaction tuning.
---

# Database & Query Optimization — DICA Backend

## 1. Current Index Strategy

The project uses carefully designed composite indexes. Review these patterns
before adding new ones.

### Index Design Principles

1. **Leading column = most common filter**. For multi-tenant, `organizationId`
   typically leads.
2. **Compound indexes follow query patterns**: `[filter, sort, cursor]`.
3. **Pagination-friendly**: most list indexes end with `(createdAt, id)` or
   `(updatedAt, id)` to support both offset and cursor pagination.

### Existing Index Patterns

| Model                | Index                                                       | Purpose |
|:-------------------- |:----------------------------------------------------------- |:------- |
| `SupplyRequest`      | `[organizationId, facilityId, status]`                      | List filter by facility+status |
| `SupplyRequest`      | `[organizationId, createdAt, id]`                           | Paginate org-wide |
| `SupplyRequest`      | `[organizationId, departmentId, createdAt, id]`             | Paginate by department |
| `SupplyRequest`      | `[organizationId, createdById, createdAt, id]`              | Paginate "my requests" |
| `FulfillmentOrder`   | `[organizationId, status]`                                  | Filter by status |
| `FulfillmentOrder`   | `[supplierId, status]`                                      | Supplier portal |
| `FulfillmentOrder`   | `[organizationId, destinationStockLocationId, createdAt, id]` | Paginate by destination |
| `FulfillmentOrder`   | `[supplierId, releasedAt, id]`                              | Supplier order listing |
| `StockLedgerEntry`   | `[stockLocationId, ingredientId, postedAt]`                 | Ledger per item per location |
| `StockLedgerEntry`   | `[stockLocationId, postedAt, id]`                           | Paginate location ledger |
| `StockBalance`       | `[stockLocationId, ingredientId]` (unique)                  | Balance lookup |
| `StockBalance`       | `[stockLocationId, updatedAt, id]`                          | Paginate location balances |
| `Session`            | `[userId, revokedAt]`                                       | Active session lookup |
| `AuditEvent`         | `[organizationId, resourceType, resourceId]`                | Resource audit log |
| `AuditEvent`         | `[requestId]`                                               | Idempotency check |
| `Notification`       | `[userId, status, createdAt]`                               | Unread notifications |
| `OutboxEvent`        | `[status, availableAt, createdAt]`                          | Outbox polling |

### Adding New Indexes

**Before adding an index, verify:**

1. The query it supports exists or is being added
2. Run `EXPLAIN ANALYZE` on the query to confirm it's needed
3. Consider the write overhead — each index slows inserts/updates
4. Composite indexes: leftmost prefix must match query filters

**When to add indexes:**

```prisma
// ✅ Good: supports a real query pattern
@@index([organizationId, facilityId, status])

// ✅ Good: supports pagination with sorting
@@index([organizationId, createdAt, id])

// ❌ Bad: single-column index that duplicates part of a composite
@@index([organizationId])  // already covered by composite indexes

// ❌ Bad: index on low-cardinality boolean
@@index([active])
```

---

## 2. Query Optimization Patterns

### N+1 Prevention — Use `include` Strategically

```typescript
// ✅ Good: includes related data in one query
await this.db.fulfillmentOrder.findMany({
  where,
  include: {
    supplier: true,
    sourceStockLocation: true,
    destinationStockLocation: { include: { facility: true } },
    lines: { include: { ingredient: true } },
  },
});

// ❌ Bad: fetching relations in a loop
const orders = await this.db.fulfillmentOrder.findMany({ where });
for (const order of orders) {
  order.supplier = await this.db.supplier.findUnique({ where: { id: order.supplierId } });
}
```

### Use `select` for Large Payloads

When you don't need all columns (especially for supplier-facing endpoints):

```typescript
// ✅ Good: only select what the supplier needs to see
await this.db.fulfillmentOrder.findMany({
  where,
  select: {
    id: true,
    code: true,
    status: true,
    releasedAt: true,
    destinationStockLocation: {
      select: { name: true, facility: { select: { name: true } } },
    },
    lines: {
      select: {
        id: true,
        approvedQuantity: true,
        receivedQuantity: true,
        unitCodeSnapshot: true,
        ingredient: { select: { code: true, name: true } },
      },
    },
  },
});
```

### Use `count()` Instead of Full Fetch for Validation

```typescript
// ✅ Good: check existence without loading full row
const exists = await this.db.facility.count({
  where: { id: d.facility_id, organizationId: u.organizationId, active: true },
});
if (!exists) throw ...;

// ❌ Bad: loading full row just to check existence
const facility = await this.db.facility.findFirst({
  where: { id: d.facility_id },
  include: { stockLocations: true, departments: true },
});
if (!facility) throw ...;
```

### Parallel Existence Checks

```typescript
// ✅ Good: run independent validations in parallel
const [depExists, itemExists] = await Promise.all([
  this.db.department.count({ where: { id: d.department_id, ... } }),
  this.db.ingredient.count({ where: { id: d.ingredient_id, ... } }),
]);
if (!depExists || !itemExists) throw ...;

// ❌ Bad: sequential
const dep = await this.db.department.count({ ... });
const item = await this.db.ingredient.count({ ... });
```

---

## 3. Pagination Optimization

### Cursor Pagination Over Offset for Large Tables

The `paginateById` utility automatically supports both modes. Cursor mode:
- Skips expensive `OFFSET` on large datasets
- Uses `cursor: { id: lastId }` + `skip: 1` + `take: size + 1`
- Never calls `count()` — cheaper for large tables

### Sort Order Must Match Index

```typescript
// ✅ Good: matches index [organizationId, createdAt, id]
orderBy: [{ createdAt: "desc" }, { id: "desc" }],

// ❌ Bad: sort doesn't match any index
orderBy: [{ name: "asc" }],  // requires seq scan or filesort
```

### Avoid Deep Offset

```typescript
// ❌ Slow for page 1000: OFFSET 19980
query.page = 1000, query.page_size = 20

// ✅ Better: switch to cursor mode for deep pages
query.pagination_mode = "cursor"
```

---

## 4. Transaction Best Practices

### Isolation Levels

```typescript
// Serializable: for critical state transitions (inventory, money)
await this.db.$transaction(async (tx) => { ... }, {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
});

// Default (Read Committed): for non-critical reads
await this.db.$transaction(async (tx) => { ... });
```

### Short Transactions

```typescript
// ✅ Good: only essential ops inside transaction
const validations = await this.validateAllInputs(dto); // OUTSIDE tx
await this.db.$transaction(async (tx) => {
  // Only write operations inside
});

// ❌ Bad: validation + external calls inside transaction
await this.db.$transaction(async (tx) => {
  await this.validateAllInputs(dto);  // holds lock too long
  await externalApi.call();           // network I/O in transaction!
});
```

### Guard Pattern for Race Conditions

```typescript
// ✅ Good: updateMany + count check = atomic guard
const guard = await tx.model.updateMany({
  where: { id, version: expectedVersion, status: currentStatus },
  data: { status: newStatus, version: { increment: 1 } },
});
if (guard.count !== 1) throw new ApiException(ErrorCode.VERSION_CONFLICT, ...);

// ❌ Bad: findFirst then update = TOCTOU race
const row = await tx.model.findFirst({ where: { id } });
if (row.version !== expectedVersion) throw ...;
await tx.model.update({ where: { id }, data: { status: newStatus } }); // race!
```

---

## 5. Connection Pool Tuning

Configuration in `.env`:

```env
DB_POOL_MAX=20                    # Max connections per process
DB_CONNECTION_TIMEOUT_MS=5000     # Wait for connection from pool
DB_IDLE_TIMEOUT_MS=30000          # Close idle connections after 30s
DB_TRANSACTION_TIMEOUT_MS=15000   # Max transaction duration
```

### Guidelines

| Metric         | Guideline |
|:-------------- |:--------- |
| `DB_POOL_MAX`  | ≤ (PostgreSQL `max_connections` - 5) / number_of_processes |
| Connection timeout | 5s for web requests, increase for batch jobs |
| Transaction timeout | 15s default, reduce for simple ops |
| Idle timeout   | 30s in production, lower in serverless |

---

## 6. Specific Anti-Patterns to Avoid

### Don't Fetch What You Don't Use

```typescript
// ❌ Fetching all relations for a simple status check
const order = await this.db.fulfillmentOrder.findFirst({
  where: { id },
  include: { lines: true, dispatches: true, receipts: true, supplier: true },
});
// Only needed: order.status

// ✅ Fetch only what's needed
const order = await this.db.fulfillmentOrder.findFirst({
  where: { id },
  select: { id: true, status: true, version: true },
});
```

### Don't Use Raw SQL Unless Necessary

Prisma's query builder covers 95% of cases. Use raw SQL only for:
- Complex aggregations not expressible in Prisma
- Database-specific features (window functions, CTEs)
- Bulk operations where ORM is a bottleneck

### Don't Create Indexes Speculatively

Only add indexes for queries that:
1. Exist in the codebase today
2. Show slow performance in `EXPLAIN ANALYZE`
3. Are called frequently enough to justify the write overhead

---

## 7. Monitoring Checklist

When investigating slow queries:

1. [ ] Check if the query has a matching composite index
2. [ ] Run `EXPLAIN ANALYZE` to see the actual execution plan
3. [ ] Check if `include` is pulling too much data
4. [ ] Check if N+1 queries are happening in a loop
5. [ ] Check if offset pagination is deep (page > 100)
6. [ ] Check if transactions hold locks too long
7. [ ] Check pool utilization (connections exhausted?)
