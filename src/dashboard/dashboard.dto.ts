import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class DashboardQueryDto {
  @ApiPropertyOptional({
    format: "uuid",
    description: "Giới hạn số liệu trong một cơ sở.",
  })
  @IsOptional()
  @IsUUID("all", { message: "Mã cơ sở không hợp lệ." })
  facility_id?: string;

  @ApiPropertyOptional({
    type: Number,
    default: 14,
    minimum: 1,
    maximum: 90,
    description: "Số ngày gần nhất dùng cho các chuỗi số liệu theo ngày.",
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt({ message: "Số ngày phải là số nguyên." })
  @Min(1, { message: "Số ngày tối thiểu là 1." })
  @Max(90, { message: "Số ngày tối đa là 90." })
  days?: number;
}
