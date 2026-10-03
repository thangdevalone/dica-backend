---
name: testing
description: >-
  Use this skill when writing or running unit tests in the DICA backend. Covers
  test setup, naming conventions, the node:test runner, and patterns for testing
  pure logic, DTOs, and services.
---

# Testing — DICA Backend

## Test Runner & Tools

| Tool             | Usage                                                   |
|:---------------- |:------------------------------------------------------- |
| `node:test`      | Built-in Node.js test runner (not Jest, not Vitest)     |
| `node:assert/strict` | Assertion library                                   |
| `tsx`            | TypeScript execution (`tsx --test test/**/*.spec.ts`)   |
| `class-validator` + `class-transformer` | For DTO validation testing    |

---

## 1. Directory Structure

```text
test/
├── audit.spec.ts
├── decimal.spec.ts
├── pagination.spec.ts
└── scope.spec.ts
```

- All test files go in `test/` (root level, not `src/`).
- Naming: `<feature>.spec.ts`.
- Tests focus on **pure logic** (no NestJS DI, no database).

---

## 2. Test File Pattern

```typescript
import assert from "node:assert/strict";
import test from "node:test";

// Import the unit under test
import { someFunction } from "../src/common/some-module.js";

test("mô tả bằng tiếng Việt", async () => {
  const result = someFunction(input);
  assert.deepEqual(result, expected);
});

test("edge case description", () => {
  assert.throws(
    () => someFunction(badInput),
    /Expected error message regex/,
  );
});
```

### Key Points

- Use `test()` from `node:test` — **NOT** `describe/it` from Jest.
- Test descriptions can be in Vietnamese or English.
- Use `assert` from `node:assert/strict` — **NOT** `expect()`.
- Import with `.js` extension (ESM).

---

## 3. Running Tests

```bash
# Run all tests
npm test

# Run with watch mode
npm run test:watch

# Run a specific test file
npx tsx --test test/pagination.spec.ts
```

---

## 4. Common Assertion Patterns

### Equality

```typescript
assert.equal(actual, expected);           // strict ===
assert.deepEqual(actual, expected);       // deep structural equality
assert.notEqual(actual, unexpected);
```

### Async / Promises

```typescript
// Async success
test("async operation", async () => {
  const result = await asyncFunction();
  assert.equal(result, expected);
});

// Async rejection
await assert.rejects(
  asyncFunction(badInput),
  /Error message pattern/,
);
```

### Throws

```typescript
assert.throws(
  () => syncFunction(badInput),
  /Expected error message/,
);
```

### Boolean / Truthiness

```typescript
assert.ok(value);          // truthy
assert.equal(value, true); // strict true
assert.equal(value, false);
```

---

## 5. Testing DTOs (class-validator)

```typescript
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { PaginationDto } from "../src/common/dto/pagination.dto.js";

test("page_size được giới hạn và cursor phải là UUID v4", async () => {
  const invalid = plainToInstance(PaginationDto, {
    page_size: 101,
    cursor: "khong-hop-le",
  });
  const errors = await validate(invalid);
  assert.equal(errors.length, 2);
});
```

### Pattern

1. Use `plainToInstance()` to create DTO from plain object
2. Call `validate()` to get validation errors
3. Assert on `errors.length` or specific error properties

---

## 6. Testing Pure Functions

```typescript
import { sanitizeAuditValue } from "../src/common/audit/audit-sanitizer.js";

test("redacts sensitive keys", () => {
  const result = sanitizeAuditValue({ password: "secret", name: "test" });
  assert.deepEqual(result, { password: "[REDACTED]", name: "test" });
});

test("truncates deep nesting", () => {
  let value: Record<string, unknown> = {};
  let current = value;
  for (let i = 0; i < 10; i++) {
    current["nested"] = {};
    current = current["nested"] as Record<string, unknown>;
  }
  const result = sanitizeAuditValue(value) as Record<string, unknown>;
  // Navigate 8 levels deep and verify truncation
});
```

---

## 7. Testing with Mocks (Manual)

Since we use `node:test` without a mocking framework, create manual mocks:

```typescript
test("paginateById offset mode", async () => {
  const query = Object.assign(new PaginationDto(), {
    page: 2,
    page_size: 2,
  });

  const rows = [
    { id: "uuid-1" },
    { id: "uuid-2" },
    { id: "uuid-3" },
    { id: "uuid-4" },
  ];

  const result = await paginateById(
    query,
    ({ skip = 0, take }) => Promise.resolve(rows.slice(skip, skip + take)),
    () => Promise.resolve(rows.length),
  );

  assert.deepEqual(result.data, rows.slice(2));
});
```

### Pattern for creating DTO instances

Use `Object.assign` to set fields on a DTO with defaults:

```typescript
const query = Object.assign(new PaginationDto(), {
  page: 1,
  page_size: 10,
  pagination_mode: "cursor" as const,
});
```

---

## 8. Checklist

1. [ ] File located in `test/` directory
2. [ ] File named `<feature>.spec.ts`
3. [ ] Uses `node:test` and `node:assert/strict`
4. [ ] Imports use `.js` extension
5. [ ] Tests pure logic (no DB, no DI)
6. [ ] Tests run with `npm test`
