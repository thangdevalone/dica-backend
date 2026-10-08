import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateNested,
} from "class-validator";
import { PaginationDto } from "../common/dto/pagination.dto.js";
import { SourceType } from "../generated/prisma/enums.js";
export class SourcingListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID("all", { message: "Mã cơ sở không hợp lệ." })
  facility_id?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID("all", { message: "Mã nguyên liệu không hợp lệ." })
  ingredient_id?: string;
}
export class EligibilityListQueryDto extends SourcingListQueryDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID("all", { message: "Mã bộ phận không hợp lệ." })
  department_id?: string;

  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description:
      "Trả danh sách nguyên liệu hiệu lực sau khi gộp quyền theo nhóm và ngoại lệ theo từng nguyên liệu. Bắt buộc truyền facility_id và department_id.",
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  effective?: boolean;
}

export class GroupEligibilityListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID("all", { message: "Mã cơ sở không hợp lệ." })
  facility_id?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID("all", { message: "Mã bộ phận không hợp lệ." })
  department_id?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID("all", { message: "Mã nhóm nguyên liệu không hợp lệ." })
  ingredient_group_id?: string;
}
export class SourceRuleListQueryDto extends SourcingListQueryDto {
  @ApiPropertyOptional({ enum: SourceType })
  @IsOptional()
  @IsEnum(SourceType, { message: "Loại nguồn không hợp lệ." })
  source_type?: SourceType;
}
export class UpsertEligibilityDto {
  @ApiProperty({ format: "uuid", description: "Mã cơ sở" })
  @IsUUID()
  facility_id!: string;
  @ApiProperty({ format: "uuid", description: "Mã bộ phận" })
  @IsUUID()
  department_id!: string;
  @ApiProperty({ format: "uuid", description: "Mã nguyên liệu" })
  @IsUUID()
  ingredient_id!: string;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: "25.5",
    description:
      "Số lượng tối đa cho mỗi dòng yêu cầu, tính theo đơn vị cơ sở của nguyên liệu; null để bỏ giới hạn.",
  })
  @IsOptional()
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,15})(?:\.\d{1,3})?$/)
  max_quantity_per_request?: string | null;
  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpsertGroupEligibilityDto {
  @ApiProperty({ format: "uuid", description: "Mã cơ sở" })
  @IsUUID()
  facility_id!: string;

  @ApiProperty({ format: "uuid", description: "Mã bộ phận" })
  @IsUUID()
  department_id!: string;

  @ApiProperty({ format: "uuid", description: "Mã nhóm nguyên liệu" })
  @IsUUID()
  ingredient_group_id!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: "25.5",
    description:
      "Giới hạn mặc định cho từng nguyên liệu thuộc nhóm, tính theo đơn vị cơ sở; có thể ghi đè bằng cấu hình từng nguyên liệu.",
  })
  @IsOptional()
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,15})(?:\.\d{1,3})?$/)
  max_quantity_per_request?: string | null;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
export class UpsertSourceRuleDto {
  @ApiProperty({ format: "uuid", description: "Mã cơ sở" })
  @IsUUID()
  facility_id!: string;
  @ApiProperty({ format: "uuid", description: "Mã nguyên liệu" })
  @IsUUID()
  ingredient_id!: string;
  @ApiProperty({ enum: SourceType })
  @IsEnum(SourceType)
  source_type!: SourceType;
  @ApiPropertyOptional({
    format: "uuid",
    description: "Bắt buộc khi nguồn là kho",
  })
  @IsOptional()
  @IsUUID()
  source_stock_location_id?: string;
  @ApiPropertyOptional({
    format: "uuid",
    description: "Bắt buộc khi nguồn là nhà cung cấp",
  })
  @IsOptional()
  @IsUUID()
  supplier_id?: string;
}
export class BulkSourceRuleDto {
  @ApiProperty({
    type: () => [UpsertSourceRuleDto],
    minItems: 1,
    maxItems: 500,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => UpsertSourceRuleDto)
  items!: UpsertSourceRuleDto[];
}
