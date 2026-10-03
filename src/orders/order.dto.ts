import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from "class-validator";
import { PaginationDto } from "../common/dto/pagination.dto.js";

export const ORDER_STATUSES = [
  "DRAFT",
  "RELEASED",
  "PARTIAL",
  "COMPLETED",
  "CLOSED",
  "CANCELLED",
] as const;

export class OrderListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ORDER_STATUSES })
  @IsOptional()
  @IsIn(ORDER_STATUSES, { message: "Trạng thái đơn không hợp lệ." })
  status?: (typeof ORDER_STATUSES)[number];

  @ApiPropertyOptional({ enum: ["STOCK", "SUPPLIER"] })
  @IsOptional()
  @IsIn(["STOCK", "SUPPLIER"], { message: "Loại nguồn không hợp lệ." })
  source_type?: "STOCK" | "SUPPLIER";

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID("all", { message: "Mã cơ sở không hợp lệ." })
  facility_id?: string;
}

export class CloseOutstandingDto {
  @IsInt()
  @Min(1)
  expected_version!: number;

  @IsString()
  @Length(3, 1000)
  reason!: string;
}

export class CancelOrderDto extends CloseOutstandingDto {}
