import assert from "node:assert/strict";
import test from "node:test";
import { assertPositiveDecimal } from "../src/common/utils/decimal.js";
test("chấp nhận quantity dạng chuỗi với tối đa ba số lẻ", () => {
  assert.equal(assertPositiveDecimal("12.500"), "12.500");
});
test("từ chối số âm, số 0 và number", () => {
  for (const value of ["0", "-1", "1.0001"])
    assert.throws(() => assertPositiveDecimal(value));
});
