const SENSITIVE_KEY =
  /(?:password|passcode|token|secret|authorization|cookie|api[_-]?key|credential)/i;

const MAX_DEPTH = 8;
const MAX_ARRAY_ITEMS = 200;
const MAX_OBJECT_KEYS = 200;
const MAX_STRING_LENGTH = 2_000;

export function sanitizeAuditValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (depth >= MAX_DEPTH) return "[TRUNCATED_DEPTH]";
  if (typeof value === "string")
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}[TRUNCATED]`
      : value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value))
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeAuditValue(item, depth + 1));
  if (typeof value === "object") {
    const toJson = (value as { toJSON?: () => unknown }).toJSON;
    if (typeof toJson === "function")
      return sanitizeAuditValue(toJson.call(value), depth + 1);
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value).slice(0, MAX_OBJECT_KEYS))
      output[key] = SENSITIVE_KEY.test(key)
        ? "[REDACTED]"
        : sanitizeAuditValue(item, depth + 1);
    return output;
  }
  return String(value);
}
