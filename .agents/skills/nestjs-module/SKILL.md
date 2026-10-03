---
name: nestjs-module
description: >-
  Use this skill when creating a new NestJS feature module, controller, service,
  or DTO in the DICA backend. Covers module structure, naming, registration,
  auth decorators, response format, pagination, and audit trail.
---

# NestJS Feature Module — DICA Backend

## Tech Stack

| Layer       | Technology                                                                  |
|:----------- |:--------------------------------------------------------------------------- |
| Runtime     | Node ≥ 22.12, ESM (`"type": "module"` in package.json)                     |
| Framework   | NestJS 12 (Express platform)                                               |
| ORM         | Prisma 7 + `@prisma/adapter-pg` (PostgreSQL)                               |
| Validation  | `class-validator` + `class-transformer` (global `ValidationPipe`)           |
| Auth        | JWT (`@nestjs/jwt`), custom guards (`AccessTokenGuard`, `PermissionGuard`)  |
| Docs        | `@nestjs/swagger` (auto-generated at `/docs`)                              |
| Logging     | `nestjs-pino` (structured JSON, pino-pretty in dev)                        |
| TypeScript  | TS 6, `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |

## Global Prefix

All routes are prefixed with `api/v1` (set in `main.ts`).
Controllers define **relative** paths (e.g., `@Controller()` + `@Get("orders")`).

---

## 1. Directory Layout

Every feature module lives in `src/<feature>/` with flat files:

```text
src/<feature>/
├── <feature>.module.ts       # NestJS module
├── <feature>.controller.ts   # HTTP layer
├── <feature>.service.ts      # Business logic
└── <feature>.dto.ts          # Request DTOs (class-validator)
```

- **No barrel files** — import directly from the file.
- All imports use `.js` extension (ESM resolution):
  `import { FooService } from "./foo.service.js";`

---

## 2. Module Registration

```typescript
// src/<feature>/<feature>.module.ts
import { Module } from "@nestjs/common";
import { FeatureController } from "./<feature>.controller.js";
import { FeatureService } from "./<feature>.service.js";

@Module({
  controllers: [FeatureController],
  providers: [FeatureService],
})
export class FeatureModule {}
```

Then add `FeatureModule` to `imports` in `src/app.module.ts`.

> **Global modules** (`@Global()`) are only `DatabaseModule` and `AuthModule`.
> Feature modules do NOT need to import `PrismaService` or `ScopeService`
> because they are globally available.

---

## 3. Controller Pattern

```typescript
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { RequirePermissions } from "../auth/decorators/permissions.decorator.js";
import { PaginationDto } from "../common/dto/pagination.dto.js";

@ApiTags("Tên tiếng Việt")
@ApiBearerAuth()
@Controller()
export class FeatureController {
  constructor(private s: FeatureService) {}

  @Get("features")
  @RequirePermissions("feature.read")
  list(@CurrentUser() u: AuthUser, @Query() q: PaginationDto) {
    return this.s.list(u, q);
  }

  @Get("features/:id")
  @RequirePermissions("feature.read")
  detail(@CurrentUser() u: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.s.detail(u, id);
  }

  @Post("features")
  @RequirePermissions("feature.create")
  create(@CurrentUser() u: AuthUser, @Body() d: CreateFeatureDto) {
    return this.s.create(u, d);
  }
}
```

### Key Conventions

- `@Controller()` — no route prefix in decorator; routes defined per handler.
- `@ApiTags("Tên tiếng Việt")` — Vietnamese tag for Swagger.
- `@ApiBearerAuth()` — class-level; all routes require auth by default.
- `@Public()` — opt-out per handler (e.g., login, health).
- `@RequirePermissions(...)` — per handler; checks against `AuthUser.grants`.
- `@CurrentUser() u: AuthUser` — injects the authenticated user.
- UUID params always use `ParseUUIDPipe`.

---

## 4. Service Pattern

```typescript
import { HttpStatus, Injectable } from "@nestjs/common";
import type { AuthUser } from "../auth/auth.types.js";
import { ScopeService } from "../auth/scope.service.js";
import type { PaginationDto } from "../common/dto/pagination.dto.js";
import { ApiException } from "../common/errors/api.exception.js";
import { ErrorCode } from "../common/errors/error-codes.js";
import { paginateById } from "../common/pagination/pagination.js";
import { PrismaService } from "../database/prisma.service.js";

@Injectable()
export class FeatureService {
  constructor(
    private db: PrismaService,
    private scope: ScopeService,
  ) {}
}
```

### Response Shape

Services return `{ data, message, meta? }` — the `ResponseInterceptor` wraps it
into the final envelope:

```json
{
  "success": true,
  "message": "Thao tác thành công.",
  "data": { ... },
  "meta": { ... },
  "request_id": "uuid",
  "timestamp": "ISO-8601"
}
```

- Messages are **always in Vietnamese**.
- Never throw plain `HttpException` — use `ApiException`:
  ```typescript
  throw new ApiException(
    ErrorCode.RESOURCE_NOT_FOUND,
    "Không tìm thấy dữ liệu hoặc bạn không có quyền truy cập.",
    HttpStatus.NOT_FOUND,
  );
  ```

### Common `notFound` Helper

```typescript
private notFound(): never {
  throw new ApiException(
    ErrorCode.RESOURCE_NOT_FOUND,
    "Không tìm thấy dữ liệu hoặc bạn không có quyền truy cập.",
    HttpStatus.NOT_FOUND,
  );
}
```

---

## 5. DTO Pattern

```typescript
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, IsUUID, Length, Min } from "class-validator";

export class CreateFeatureDto {
  @ApiProperty({ example: "ABC" })
  @IsString()
  @Length(2, 100)
  name!: string;
}
```

- Use `!` (definite assignment) for required fields.
- Use `class-validator` decorators + `@ApiProperty` / `@ApiPropertyOptional`.
- Validation messages in Vietnamese where appropriate.
- DTOs are pure classes — no interfaces for request bodies.

---

## 6. Pagination

Import from `src/common/pagination/pagination.ts`.

### Offset + Cursor Dual-Mode (standard)

```typescript
async list(u: AuthUser, q: PaginationDto) {
  const where = { organizationId: u.organizationId };
  const { data, meta } = await paginateById(
    q,
    ({ skip, take, cursorId }) =>
      this.db.model.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...(skip !== undefined ? { skip } : {}),
        take,
        ...(cursorId ? { cursor: { id: cursorId } } : {}),
      }),
    () => this.db.model.count({ where }),
  );
  return { data, message: "Lấy danh sách thành công.", meta };
}
```

### Helpers

| Function          | Use case                                       |
|:----------------- |:----------------------------------------------- |
| `paginateById`    | Full offset/cursor handler (most endpoints)     |
| `offsetWindow`    | Get `{ skip, take }` for offset-only endpoints  |
| `offsetMeta`      | Build offset meta manually                      |
| `resolveSort`     | Validate & map `sort_by` against an allowlist   |
| `normalizedSearch`| Trim & return search string or undefined        |
| `pageSize`        | Resolve `page_size` / legacy `pageSize`         |

---

## 7. Data Scoping (Multi-Tenant)

Every query **must** filter by `organizationId: u.organizationId`.

For facility-level access control, use `ScopeService`:

```typescript
// Get allowed facility IDs (null = org-wide access)
const ids = this.scope.facilityIds(u, "feature.read");

// Check if user can access a specific resource
this.scope.canAccess(u, "feature.read", {
  facilityId: resource.facilityId,
  stockLocationId: resource.stockLocationId,
});

// Throw 404 if not allowed (to avoid leaking existence)
this.scope.assertAccess(u, "feature.read", { facilityId: "..." });
```

> Unauthorized access returns 404, NOT 403, to avoid leaking resource existence.

---

## 8. Mutations & Optimistic Locking

For state-changing operations:

1. **Optimistic locking** — models have a `version` column. Check
   `expected_version` in the DTO:
   ```typescript
   if (entity.version !== dto.expected_version)
     throw new ApiException(ErrorCode.VERSION_CONFLICT, "...", HttpStatus.CONFLICT);
   ```
2. **Use `$transaction` with Serializable** for critical operations:
   ```typescript
   await this.db.$transaction(async (tx) => { ... }, {
     isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
   });
   ```
3. **Guard with `updateMany` + count check** for race-condition safety:
   ```typescript
   const guard = await tx.model.updateMany({
     where: { id, version: dto.expected_version, status: currentStatus },
     data: { status: newStatus, version: { increment: 1 } },
   });
   if (guard.count !== 1) throw new ApiException(ErrorCode.VERSION_CONFLICT, ...);
   ```
4. **Create `AuditEvent`** within the transaction for audit trail.

---

## 9. Audit Trail

For config/admin endpoints, use the `@ConfigAudit("RESOURCE_TYPE")` decorator
on the controller class. The `ConfigAuditInterceptor` auto-logs all mutating
requests.

For transactional/business-critical mutations, create `AuditEvent` manually
inside the `$transaction`:

```typescript
await tx.auditEvent.create({
  data: {
    organizationId: u.organizationId,
    actorId: u.id,
    action: "feature.create",
    resourceType: "Feature",
    resourceId: id,
    requestId: `feature-create:${id}`,
    beforeData: { ... },
    afterData: { ... },
  },
});
```

---

## 10. Idempotency

For POST endpoints that must be idempotent (creating resources that cannot be
duplicated), use `IdempotencyService`:

```typescript
constructor(private idem: IdempotencyService) {}

async create(u: AuthUser, key: string | undefined, dto: CreateDto) {
  const k = this.idem.requireKey(key);  // validates Idempotency-Key header
  const { value, replayed } = await this.idem.execute(
    u, "feature.create", k, dto,
    async (tx) => {
      // ... create logic using tx ...
      return result as Prisma.JsonObject;
    },
  );
  return { data: value, message: "..." };
}
```

---

## 11. Error Handling

Use `ApiException` with `ErrorCode` constants from
`src/common/errors/error-codes.ts`:

```typescript
throw new ApiException(
  ErrorCode.INVALID_STATE,
  "Vietnamese error message explaining the issue.",
  HttpStatus.CONFLICT,
  { field: "optional_details" },  // optional 4th argument
);
```

The `HttpExceptionFilter` handles all exceptions and wraps them into:

```json
{
  "success": false,
  "code": "ERROR_CODE",
  "message": "...",
  "details": [ ... ],
  "request_id": "...",
  "timestamp": "..."
}
```

When adding new error scenarios, **add a new constant to `ErrorCode`** if none
of the existing codes fit.

---

## 12. Checklist for New Module

1. [ ] Create `src/<feature>/` directory with 4 files
2. [ ] Add module to `imports` in `src/app.module.ts`
3. [ ] Add import statement in `app.module.ts` (with `.js` extension)
4. [ ] Filter all queries by `organizationId`
5. [ ] Apply `@RequirePermissions(...)` on every handler
6. [ ] Return `{ data, message }` from service methods
7. [ ] Use Vietnamese messages
8. [ ] Use `ApiException` instead of `HttpException`
9. [ ] Add `@ApiTags(...)` and `@ApiBearerAuth()`
10. [ ] Use `paginateById` for list endpoints
