---
name: prisma-schema
description: >-
  Use this skill when modifying the Prisma schema, creating migrations, seeding,
  or working with the database layer in the DICA backend. Covers Prisma 7
  conventions, model patterns, relationships, enums, and migration workflow.
---

# Prisma Schema & Database — DICA Backend

## Setup

| Component | Details |
|:--------- |:------- |
| Prisma    | v7.10 with `@prisma/adapter-pg` driver adapter |
| Database  | PostgreSQL |
| Schema    | `prisma/schema.prisma` |
| Generated | `src/generated/prisma/` (ESM output) |
| Config    | `prisma7.config.ts` (Prisma 7 config file) |
| Seed      | `prisma/seed.ts` (run via `tsx`) |

---

## 1. Schema Structure

### Generator & Datasource

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma"
  moduleFormat = "esm"
}

datasource db {
  provider = "postgresql"
}
```

> **Important**: Output goes to `src/generated/prisma/` — import from
> `../generated/prisma/client.js` in source files.

---

## 2. Model Conventions

### Standard Fields

Every model should include:

```prisma
model Example {
  id        String   @id @default(uuid())
  // ... domain fields ...
  version   Int      @default(1)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("examples")
}
```

- `id` — UUID primary key (`@default(uuid())`).
- `version` — optimistic locking counter.
- `createdAt` / `updatedAt` — timestamps with `@map` to snake_case DB columns.
- `@@map("table_name")` — table names are plural snake_case.

### Multi-Tenant Isolation

All business models include `organizationId` as a required foreign key:

```prisma
model Feature {
  id             String       @id @default(uuid())
  organizationId String       @map("organization_id")
  organization   Organization @relation(fields: [organizationId], references: [id])
  // ...

  @@map("features")
}
```

### Unique Constraints

Use compound unique indexes for business keys:

```prisma
@@unique([organizationId, code])
@@unique([organizationId, username])
```

---

## 3. Enums

Define enums at the top of the schema file, before models:

```prisma
enum OrderStatus {
  DRAFT
  RELEASED
  PARTIAL
  COMPLETED
  CLOSED
  CANCELLED
}
```

- Use `UPPER_SNAKE_CASE` values.
- Import in services: `import { OrderStatus } from "../generated/prisma/client.js";`

---

## 4. Relationships

### One-to-Many

```prisma
model Parent {
  id       String  @id @default(uuid())
  children Child[]
  @@map("parents")
}

model Child {
  id       String @id @default(uuid())
  parentId String @map("parent_id")
  parent   Parent @relation(fields: [parentId], references: [id])
  @@map("children")
}
```

### Optional Relations

```prisma
model Order {
  supplierId String?   @map("supplier_id")
  supplier   Supplier? @relation(fields: [supplierId], references: [id])
}
```

### Self-Referencing

```prisma
model Category {
  id       String     @id @default(uuid())
  parentId String?    @map("parent_id")
  parent   Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children Category[] @relation("CategoryTree")
}
```

---

## 5. Decimal Fields

Use `Decimal` type for quantities and prices:

```prisma
model FulfillmentLine {
  approvedQuantity  Decimal @default(0) @map("approved_quantity") @db.Decimal(18, 3)
  receivedQuantity  Decimal @default(0) @map("received_quantity") @db.Decimal(18, 3)
  unitPriceSnapshot Decimal @default(0) @map("unit_price_snapshot") @db.Decimal(18, 4)
}
```

- Quantities: `@db.Decimal(18, 3)` (3 decimal places)
- Prices: `@db.Decimal(18, 4)` (4 decimal places)
- In TypeScript, use `.gt()`, `.sub()`, `.toString()` etc. (Prisma Decimal API)
- For validation, use `assertPositiveDecimal()` from `src/common/utils/decimal.ts`

---

## 6. JSON Fields

Use `Json` type for flexible/audit data:

```prisma
model AuditEvent {
  beforeData Json? @map("before_data")
  afterData  Json? @map("after_data")
}
```

In TypeScript, cast as `Prisma.InputJsonValue` when writing:

```typescript
beforeData: sanitizeAuditValue({ ... }) as Prisma.InputJsonValue,
```

---

## 7. Important System Models

### IdempotencyRecord

```prisma
model IdempotencyRecord {
  id             String   @id @default(uuid())
  organizationId String   @map("organization_id")
  userId         String   @map("user_id")
  operation      String
  key            String
  requestHash    String   @map("request_hash")
  statusCode     Int      @map("status_code")
  responseBody   Json     @map("response_body")
  expiresAt      DateTime @map("expires_at")
  createdAt      DateTime @default(now()) @map("created_at")

  @@unique([organizationId, userId, operation, key])
  @@map("idempotency_records")
}
```

### AuditEvent

```prisma
model AuditEvent {
  id             String   @id @default(uuid())
  organizationId String   @map("organization_id")
  actorId        String   @map("actor_id")
  action         String
  resourceType   String   @map("resource_type")
  resourceId     String   @map("resource_id")
  requestId      String?  @map("request_id")
  beforeData     Json?    @map("before_data")
  afterData      Json?    @map("after_data")
  createdAt      DateTime @default(now()) @map("created_at")

  @@map("audit_events")
}
```

### Session

```prisma
model Session {
  id               String    @id @default(uuid())
  userId           String    @map("user_id")
  refreshTokenHash String    @map("refresh_token_hash")
  expiresAt        DateTime  @map("expires_at")
  revokedAt        DateTime? @map("revoked_at")
  ipAddress        String?   @map("ip_address")
  userAgent        String?   @map("user_agent")
  createdAt        DateTime  @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id])
  @@map("sessions")
}
```

---

## 8. PrismaService Usage

`PrismaService` extends `PrismaClient` and is globally available (no need to
import `DatabaseModule` in feature modules):

```typescript
import { PrismaService } from "../database/prisma.service.js";

@Injectable()
export class FeatureService {
  constructor(private db: PrismaService) {}

  // Direct queries
  await this.db.model.findMany({ where: { ... } });

  // Interactive transactions (Serializable for critical ops)
  await this.db.$transaction(async (tx) => {
    // use tx instead of this.db inside transaction
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  // Batch transactions
  await this.db.$transaction([
    this.db.model.update({ ... }),
    this.db.model.update({ ... }),
  ]);
}
```

---

## 9. Migration Workflow

```bash
# Create a new migration (dev only)
npm run db:migrate:dev

# Apply migrations (production)
npm run db:migrate

# Regenerate Prisma client after schema changes
npm run prisma:generate

# Open Prisma Studio
npm run db:studio

# Run seed
npm run db:seed
```

### Steps to modify schema:

1. Edit `prisma/schema.prisma`
2. Run `npm run db:migrate:dev` to create migration
3. Run `npm run prisma:generate` to regenerate client
4. Import new types from `../generated/prisma/client.js`

---

## 10. Checklist

1. [ ] All models have `id`, `version`, `createdAt`, `updatedAt`
2. [ ] All business models have `organizationId` FK
3. [ ] Table names are plural snake_case via `@@map`
4. [ ] Column names use `@map("snake_case")`
5. [ ] Decimals use `@db.Decimal(18, N)` with appropriate scale
6. [ ] Compound unique constraints include `organizationId`
7. [ ] Enums use `UPPER_SNAKE_CASE`
8. [ ] Run `prisma:generate` after schema changes
