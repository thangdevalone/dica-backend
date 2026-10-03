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
import { SourceType } from "../generated/prisma/enums.js";
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
