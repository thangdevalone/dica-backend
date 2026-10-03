---
name: project-conventions
description: >-
  Use this skill when you need a quick reference of the DICA backend project
  conventions, technology stack, commands, directory structure, and coding
  standards. This is the starting point for any task in this codebase.
---

# DICA Backend — Project Conventions

## What is DICA?

DICA is a **multi-tenant supply chain & inventory management backend** for the
food service industry. It manages sourcing, procurement requests, fulfillment
orders, dispatches, receipts, stock movements, and inventory across
organizations with facilities (warehouses, kitchens, branches).

---

## Tech Stack Summary

| Layer           | Technology                                              |
|:--------------- |:------------------------------------------------------- |
| Runtime         | Node.js ≥ 22.12 (ESM, `"type": "module"`)              |
| Framework       | NestJS 12 (Express)                                     |
| Language        | TypeScript 6 (`strict`, `noUncheckedIndexedAccess`)     |
| ORM             | Prisma 7 + `@prisma/adapter-pg` → PostgreSQL            |
| Auth            | JWT (access + refresh), RBAC with data scoping          |
| Validation      | `class-validator` + `class-transformer`                 |
| API Docs        | `@nestjs/swagger` (at `/docs`)                          |
| Logging         | `nestjs-pino` (structured JSON)                         |
| Rate Limiting   | `@nestjs/throttler` (120 req/min default)               |
| Testing         | `node:test` + `node:assert/strict` (via `tsx`)          |
| Password        | `argon2`                                                |

---

## Directory Structure

```text
dica-backend/
├── prisma/
│   ├── schema.prisma        # Database schema
│   ├── seed.ts              # Seed script
│   └── migrations/          # Migration files
├── src/
│   ├── main.ts              # Bootstrap
│   ├── app.module.ts        # Root module
│   ├── config/              # Env validation (Joi)
│   ├── database/            # PrismaService (@Global)
│   ├── auth/                # AuthModule (@Global), guards, JWT
│   ├── common/              # Shared utilities
│   │   ├── audit/           # ConfigAudit decorator + interceptor
│   │   ├── dto/             # PaginationDto
│   │   ├── errors/          # ApiException, ErrorCode
│   │   ├── filters/         # HttpExceptionFilter
│   │   ├── idempotency/     # IdempotencyService
│   │   ├── interceptors/    # ResponseInterceptor
│   │   ├── middleware/      # request-id middleware
│   │   ├── pagination/      # paginateById, offsetWindow, etc.
│   │   └── utils/           # assertPositiveDecimal
│   ├── generated/           # Prisma generated client
│   └── <feature>/           # Feature modules (flat structure)
│       ├── <feature>.module.ts
│       ├── <feature>.controller.ts
│       ├── <feature>.service.ts
│       └── <feature>.dto.ts
├── test/                    # Unit tests (node:test)
├── docs/                    # Documentation
├── package.json
├── tsconfig.json
├── prisma7.config.ts
├── Dockerfile
└── docker-compose.yml
```

---

## NPM Scripts

| Command                  | Description                              |
|:------------------------ |:---------------------------------------- |
| `npm run start:dev`      | Dev server with hot reload               |
| `npm run build`          | `prisma generate` + `tsc`                |
| `npm start`              | Run compiled app                         |
| `npm test`               | Run all tests                            |
| `npm run test:watch`     | Tests with watch mode                    |
| `npm run typecheck`      | Type check without emit                  |
| `npm run format`         | Format with Prettier                     |
| `npm run format:check`   | Check formatting                         |
| `npm run prisma:generate`| Regenerate Prisma client                 |
| `npm run db:migrate:dev` | Create new migration (dev)               |
| `npm run db:migrate`     | Apply migrations (prod)                  |
| `npm run db:seed`        | Run seed script                          |
| `npm run db:studio`      | Open Prisma Studio                       |

---

## Coding Standards

### TypeScript

- **ESM imports** with `.js` extension: `import { X } from "./module.js";`
- **`type` imports** for interfaces/types: `import type { AuthUser } from "...";`
- **`!` (definite assignment)** for required DTO fields: `name!: string;`
- **No barrel files** — import directly from source files.
- **Strict mode** — `strict: true`, `noUncheckedIndexedAccess: true`,
  `exactOptionalPropertyTypes: true`.

### Naming

| Element       | Convention                  | Example                     |
|:------------- |:--------------------------- |:--------------------------- |
| Files         | `kebab-case.ts`             | `order.service.ts`          |
| Classes       | `PascalCase`                | `OrderService`              |
| Interfaces    | `PascalCase`                | `AuthUser`                  |
| Functions     | `camelCase`                 | `paginateById`              |
| Constants     | `UPPER_SNAKE_CASE`          | `ErrorCode.RESOURCE_NOT_FOUND` |
| DB columns    | `snake_case` (via `@map`)   | `organization_id`           |
| API fields    | `snake_case`                | `page_size`, `sort_order`   |
| Enums         | `UPPER_SNAKE_CASE`          | `OrderStatus.RELEASED`      |
| Permissions   | `resource.action`           | `order.read`                |

### Response Format

All successful responses are wrapped by `ResponseInterceptor`:

```json
{
  "success": true,
  "message": "Vietnamese message.",
  "data": { ... },
  "meta": { "mode": "offset", "page": 1, ... },
  "request_id": "uuid",
  "timestamp": "ISO-8601"
}
```

All error responses are handled by `HttpExceptionFilter`:

```json
{
  "success": false,
  "code": "ERROR_CODE",
  "message": "Vietnamese error message.",
  "details": [ ... ],
  "request_id": "uuid",
  "timestamp": "ISO-8601"
}
```

### Language

- **All user-facing messages** (API responses, error messages, Swagger docs)
  must be in **Vietnamese**.
- Code (variable names, comments) can be in English.

---

## Environment Variables

Key env vars (validated by Joi in `src/config/env.validation.ts`):

| Variable                   | Required | Default        |
|:-------------------------- |:-------- |:-------------- |
| `NODE_ENV`                 | No       | `development`  |
| `PORT`                     | No       | `3000`         |
| `DATABASE_URL`             | Yes      | —              |
| `JWT_ACCESS_SECRET`        | Yes      | —              |
| `JWT_REFRESH_SECRET`       | Yes      | —              |
| `JWT_ACCESS_TTL`           | No       | `15m`          |
| `JWT_REFRESH_TTL`          | No       | `7d`           |
| `CORS_ORIGINS`             | No       | `localhost:3001`|
| `HTTP_BODY_LIMIT`          | No       | `10mb`         |
| `DB_POOL_MAX`              | No       | `20`           |
| `DB_CONNECTION_TIMEOUT_MS` | No       | `5000`         |
| `DB_IDLE_TIMEOUT_MS`       | No       | `30000`        |
| `DB_TRANSACTION_TIMEOUT_MS`| No       | `15000`        |
| `DEMO_POLICY_ENABLED`      | No       | `false`        |

---

## Multi-Tenancy

- Every business query **MUST** filter by `organizationId`.
- Data scoping is enforced via `ScopeService` (facility/location/department level).
- Users belong to exactly one organization.
- Unauthorized access returns **404** (not 403) to prevent leaking resource existence.

---

## Global Infrastructure

These modules are `@Global()` and available everywhere:

| Module          | Provides                    |
|:--------------- |:--------------------------- |
| `DatabaseModule`| `PrismaService`             |
| `AuthModule`    | `AccessTokenGuard`, `PermissionGuard`, `ScopeService` |
| `ConfigModule`  | `ConfigService` (from `@nestjs/config`) |

Other shared utilities are imported directly (not via modules):
- `ApiException` → `../common/errors/api.exception.js`
- `ErrorCode` → `../common/errors/error-codes.js`
- `paginateById` → `../common/pagination/pagination.js`
- `PaginationDto` → `../common/dto/pagination.dto.js`
