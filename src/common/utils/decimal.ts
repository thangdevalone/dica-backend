import { HttpStatus } from "@nestjs/common";
import { ApiException } from "../errors/api.exception.js";
import { ErrorCode } from "../errors/error-codes.js";
export function assertPositiveDecimal(
  value: string,
  field = "quantity",
): string {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/.test(value) || Number(value) <= 0)
    throw new ApiException(
      ErrorCode.VALIDATION_ERROR,
      "Số lượng phải là chuỗi thập phân dương, tối đa 3 chữ số phần lẻ.",
      HttpStatus.UNPROCESSABLE_ENTITY,
      { field, value },
    );
  return value;
}
