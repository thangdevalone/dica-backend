import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsUUID } from "class-validator";
import { PaginationDto } from "../common/dto/pagination.dto.js";

export const LEDGER_ENTRY_TYPES = [
  "DISPATCH_OUT",
  "TRANSIT_IN",
  "TRANSIT_OUT",
  "RECEIPT_IN",
  "SUPPLIER_RECEIPT_IN",
  "ADJUSTMENT",
  "DAMAGE",
  "REVERSAL",
] as const;

export class InventoryListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID("all", { message: "Mã cơ sở không hợp lệ." })
  facility_id?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID("all", { message: "Mã kho không hợp lệ." })
  stock_location_id?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID("all", { message: "Mã nguyên liệu không hợp lệ." })
  ingredient_id?: string;
}

export class LedgerListQueryDto extends InventoryListQueryDto {
  @ApiPropertyOptional({ enum: LEDGER_ENTRY_TYPES })
  @IsOptional()
  @IsIn(LEDGER_ENTRY_TYPES, { message: "Loại bút toán không hợp lệ." })
  entry_type?: (typeof LEDGER_ENTRY_TYPES)[number];
}

export class NotificationListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ["UNREAD", "READ"] })
  @IsOptional()
  @IsIn(["UNREAD", "READ"], { message: "Trạng thái thông báo không hợp lệ." })
  status?: "UNREAD" | "READ";
}
