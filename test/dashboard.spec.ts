import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dayKey,
  decimalOf,
  percentage,
  periodDayKeys,
  resolveThresholdRule,
  startOfDayKey,
} from "../src/dashboard/dashboard.util.js";

test("dayKey chia ngày theo múi giờ Việt Nam", () => {
  // 17:30 UTC ngày 2 = 00:30 ngày 3 giờ Việt Nam.
  assert.equal(dayKey(new Date("2026-10-02T17:30:00.000Z")), "2026-10-03");
  assert.equal(dayKey(new Date("2026-10-02T16:59:59.000Z")), "2026-10-02");
});

test("periodDayKeys trả đủ số ngày liên tiếp kết thúc ở hôm nay", () => {
  const keys = periodDayKeys(new Date("2026-10-03T08:00:00.000Z"), 3);
  assert.deepEqual(keys, ["2026-10-01", "2026-10-02", "2026-10-03"]);
  assert.equal(
    startOfDayKey("2026-10-01").toISOString(),
    "2026-09-30T17:00:00.000Z",
  );
});

test("resolveThresholdRule ưu tiên ngưỡng cụ thể nhất", () => {
  const rules = [
    { id: "org", facilityId: null, ingredientId: null },
    { id: "facility", facilityId: "F1", ingredientId: null },
    { id: "ingredient", facilityId: null, ingredientId: "I1" },
    { id: "both", facilityId: "F1", ingredientId: "I1" },
    { id: "other", facilityId: "F2", ingredientId: "I1" },
  ];
  assert.equal(resolveThresholdRule(rules, "F1", "I1")?.id, "both");
  assert.equal(resolveThresholdRule(rules, "F2", "I2")?.id, "org");
  assert.equal(resolveThresholdRule(rules, "F1", "I2")?.id, "facility");
  assert.equal(resolveThresholdRule(rules, "F3", "I1")?.id, "ingredient");
  assert.equal(resolveThresholdRule([], "F1", "I1"), null);
});

test("percentage xử lý mẫu số bằng 0 và làm tròn 1 chữ số", () => {
  assert.equal(percentage(decimalOf("1"), decimalOf("3")), 33.3);
  assert.equal(percentage(decimalOf("5"), decimalOf("0")), null);
  assert.equal(decimalOf(null).toString(), "0");
});
