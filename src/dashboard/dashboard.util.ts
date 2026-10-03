import { Prisma } from "../generated/prisma/client.js";

/** Múi giờ nghiệp vụ dùng để chia bucket theo ngày trên dashboard. */
export const DASHBOARD_TIME_ZONE = "Asia/Ho_Chi_Minh";
/** Offset cố định của DASHBOARD_TIME_ZONE (Việt Nam không có DST). */
export const DASHBOARD_UTC_OFFSET = "+07:00";
const DAY_MS = 86_400_000;

export function dayKey(date: Date, timeZone = DASHBOARD_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Danh sách ngày (YYYY-MM-DD) liên tiếp, kết thúc ở ngày hiện tại. */
export function periodDayKeys(
  now: Date,
  days: number,
  timeZone = DASHBOARD_TIME_ZONE,
): string[] {
  const keys: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1)
    keys.push(dayKey(new Date(now.getTime() - offset * DAY_MS), timeZone));
  return keys;
}

export function startOfDayKey(
  key: string,
  utcOffset = DASHBOARD_UTC_OFFSET,
): Date {
  return new Date(`${key}T00:00:00.000${utcOffset}`);
}

export interface ThresholdRule {
  facilityId: string | null;
  ingredientId: string | null;
}

/**
 * Chọn ngưỡng cụ thể nhất cho một cặp cơ sở/nguyên liệu:
 * cơ sở + nguyên liệu > chỉ nguyên liệu > chỉ cơ sở > toàn tổ chức.
 */
export function resolveThresholdRule<T extends ThresholdRule>(
  rules: readonly T[],
  facilityId: string,
  ingredientId: string,
): T | null {
  let best: T | null = null;
  let bestScore = -1;
  for (const rule of rules) {
    if (rule.facilityId && rule.facilityId !== facilityId) continue;
    if (rule.ingredientId && rule.ingredientId !== ingredientId) continue;
    const score = (rule.ingredientId ? 2 : 0) + (rule.facilityId ? 1 : 0);
    if (score > bestScore) {
      best = rule;
      bestScore = score;
    }
  }
  return best;
}

/** Tỷ lệ phần trăm (0–100, 1 chữ số thập phân); trả null khi mẫu số bằng 0. */
export function percentage(
  numerator: Prisma.Decimal,
  denominator: Prisma.Decimal,
): number | null {
  if (denominator.lte(0)) return null;
  return Number(numerator.div(denominator).mul(100).toDecimalPlaces(1));
}

export function decimalOf(value: unknown): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) return value;
  if (value === null || value === undefined || value === "")
    return new Prisma.Decimal(0);
  return new Prisma.Decimal(String(value));
}
