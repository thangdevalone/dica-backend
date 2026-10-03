import { Transform } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class PaginationDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt({ message: "Trang phải là số nguyên." })
  @Min(1)
  @Max(10_000, {
    message: "Trang offset quá sâu; hãy dùng pagination_mode=cursor.",
  })
  page = 1;

  @ApiPropertyOptional({
    name: "page_size",
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt({ message: "Kích thước trang phải là số nguyên." })
  @Min(1)
  @Max(100, { message: "Kích thước trang không được vượt quá 100." })
  page_size?: number;

  /** @deprecated Dùng page_size. Giữ lại để tương thích client cũ. */
  @ApiPropertyOptional({
    deprecated: true,
    description: "Tên cũ của page_size.",
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt({ message: "Kích thước trang phải là số nguyên." })
  @Min(1)
  @Max(100, { message: "Kích thước trang không được vượt quá 100." })
  pageSize?: number;

  @ApiPropertyOptional({ enum: ["offset", "cursor"], default: "offset" })
  @IsOptional()
  @IsIn(["offset", "cursor"], {
    message: "Kiểu phân trang chỉ nhận offset hoặc cursor.",
  })
  pagination_mode: "offset" | "cursor" = "offset";

  @ApiPropertyOptional({
    description: "ID cuối trang trước, dùng với pagination_mode=cursor.",
    format: "uuid",
  })
  @IsOptional()
  @IsUUID("4", { message: "Cursor không hợp lệ." })
  cursor?: string;

  @ApiPropertyOptional({
    description: "Tìm theo các trường được endpoint hỗ trợ.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description: "Trường sắp xếp thuộc allowlist của endpoint.",
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{0,49}$/, {
    message: "Trường sắp xếp không hợp lệ.",
  })
  sort_by?: string;

  @ApiPropertyOptional({ enum: ["asc", "desc"], default: "desc" })
  @IsOptional()
  @IsIn(["asc", "desc"], {
    message: "Chiều sắp xếp chỉ nhận asc hoặc desc.",
  })
  sort_order: "asc" | "desc" = "desc";
}
