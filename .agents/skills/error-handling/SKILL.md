---
name: error-handling
description: >-
  Use this skill when handling errors, creating custom exceptions, adding error
  codes, or working with the exception filter in the DICA backend. Covers
  ApiException, ErrorCode, HttpExceptionFilter, and validation error patterns.
---

# Error Handling — DICA Backend

## Architecture

```text
Controller/Service → throws ApiException → HttpExceptionFilter → JSON response
                   → throws HttpException → HttpExceptionFilter → JSON response
                   → unhandled Error      → HttpExceptionFilter → 500 response
```

---

## 1. ApiException

The project's custom exception class — use this for all business errors:

```typescript
import { HttpStatus } from "@nestjs/common";
import { ApiException } from "../common/errors/api.exception.js";
import { ErrorCode } from "../common/errors/error-codes.js";

// Basic usage
throw new ApiException(
  ErrorCode.RESOURCE_NOT_FOUND,
  "Không tìm thấy dữ liệu hoặc bạn không có quyền truy cập.",
  HttpStatus.NOT_FOUND,
);

// With details (4th argument, optional)
throw new ApiException(
  ErrorCode.VALIDATION_ERROR,
  "Số lượng vượt quá mức cho phép.",
  HttpStatus.UNPROCESSABLE_ENTITY,
  { field: "quantity", max: 1000, received: 1500 },
);
```

### Constructor Signature

```typescript
class ApiException extends HttpException {
  constructor(
    code: string,       // ErrorCode constant
    message: string,    // Vietnamese user-facing message
    status: HttpStatus, // HTTP status code
    details?: unknown,  // Optional context for debugging
  )
}
```

---

## 2. ErrorCode Constants

All error codes are defined in `src/common/errors/error-codes.ts`:

```typescript
export const ErrorCode = {
  AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  AUTH_SESSION_INVALID: "AUTH_SESSION_INVALID",
  FORBIDDEN: "FORBIDDEN",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_STATE: "INVALID_STATE",
  VERSION_CONFLICT: "VERSION_CONFLICT",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
  IDEMPOTENCY_KEY_REQUIRED: "IDEMPOTENCY_KEY_REQUIRED",
  SOURCE_NOT_CONFIGURED: "SOURCE_NOT_CONFIGURED",
  SOURCE_UNAVAILABLE: "SOURCE_UNAVAILABLE",
  QUANTITY_EXCEEDS_REMAINING: "QUANTITY_EXCEEDS_REMAINING",
  INSUFFICIENT_STOCK: "INSUFFICIENT_STOCK",
  DATA_INCOMPLETE: "DATA_INCOMPLETE",
  POLICY_NOT_CONFIGURED: "POLICY_NOT_CONFIGURED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;
```

### When to Add New Codes

Add a new code when:
- A new business rule violation needs a distinct machine-readable identifier
- Clients need to handle a specific error type differently
- The existing codes don't semantically match the error

### Naming Convention

`UPPER_SNAKE_CASE` — format: `<DOMAIN>_<DESCRIPTION>`

---

## 3. Common Error Patterns

### Resource Not Found (also used for access denied)

```typescript
throw new ApiException(
  ErrorCode.RESOURCE_NOT_FOUND,
  "Không tìm thấy đơn hoặc bạn không có quyền truy cập.",
  HttpStatus.NOT_FOUND,
);
```

### State Transition Error

```typescript
throw new ApiException(
  ErrorCode.INVALID_STATE,
  "Trạng thái đơn không cho phép thao tác này.",
  HttpStatus.CONFLICT,
);
```

### Optimistic Locking Conflict

```typescript
throw new ApiException(
  ErrorCode.VERSION_CONFLICT,
  "Dữ liệu đã được cập nhật. Vui lòng tải lại trước khi thao tác.",
  HttpStatus.CONFLICT,
);
```

### Idempotency Conflict

```typescript
throw new ApiException(
  ErrorCode.IDEMPOTENCY_CONFLICT,
  "Idempotency-Key đã được dùng với nội dung khác.",
  HttpStatus.CONFLICT,
);
```

### Business Rule Violation

```typescript
throw new ApiException(
  ErrorCode.QUANTITY_EXCEEDS_REMAINING,
  "Số lượng vượt quá phần còn lại cho phép.",
  HttpStatus.UNPROCESSABLE_ENTITY,
  { lineId, requested: qty, remaining: max },
);
```

---

## 4. HttpExceptionFilter

Catches ALL exceptions (not just `HttpException`). Location:
`src/common/filters/http-exception.filter.ts`.

### Error Response Shape

```json
{
  "success": false,
  "code": "ERROR_CODE",
  "message": "Vietnamese user-facing error message.",
  "details": ["array", "of", "validation", "messages"],
  "request_id": "uuid",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

### Behavior

| Exception Type | Status | Code | Logging |
|:-------------- |:------ |:---- |:------- |
| `ApiException` | From exception | From exception | Logged if 5xx |
| `HttpException` (validation) | From exception | `VALIDATION_ERROR` | Not logged |
| `HttpException` (other) | From exception | `INTERNAL_ERROR` | Logged if 5xx |
| Unhandled `Error` | 500 | `INTERNAL_ERROR` | Always logged |

### Validation Errors

The global `ValidationPipe` throws `BadRequestException` with `message` as an
array. The filter detects this and:
- Sets `code: "VALIDATION_ERROR"`
- Sets `message: "Dữ liệu gửi lên không hợp lệ."`
- Puts the array in `details`

---

## 5. Rules

1. **Always use `ApiException`** — never throw raw `HttpException` or `Error`
   for business logic.
2. **Messages in Vietnamese** — all user-facing messages.
3. **404 over 403** — for unauthorized access to resources, use 404 to avoid
   leaking existence.
4. **Use existing error codes** — check `ErrorCode` before creating new ones.
5. **Log stack traces** — the filter auto-logs 5xx errors with stack traces.
