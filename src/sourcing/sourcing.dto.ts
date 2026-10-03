import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsUUID,
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
}
export class SourceRuleListQueryDto extends SourcingListQueryDto {
  @ApiPropertyOptional({ enum: SourceType })
  @IsOptional()
  @IsEnum(SourceType, { message: "Loại nguồn không hợp lệ." })
  source_type?: SourceType;
}
export class UpsertEligibilityDto {
  @IsUUID() facility_id!: string;
  @IsUUID() department_id!: string;
  @IsUUID() ingredient_id!: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
export class UpsertSourceRuleDto {
  @IsUUID() facility_id!: string;
  @IsUUID() ingredient_id!: string;
  @IsEnum(SourceType) source_type!: SourceType;
  @IsOptional() @IsUUID() source_stock_location_id?: string;
  @IsOptional() @IsUUID() supplier_id?: string;
}
export class BulkSourceRuleDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => UpsertSourceRuleDto)
  items!: UpsertSourceRuleDto[];
}
