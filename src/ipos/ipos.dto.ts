import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  ValidateNested,
} from "class-validator";
import { PaginationDto } from "../common/dto/pagination.dto.js";
import { VarianceDataStatus } from "../generated/prisma/enums.js";

export class IposListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID("all", { message: "Mã cơ sở không hợp lệ." })
  facility_id?: string;
}

export class RecipeListQueryDto extends IposListQueryDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID("all", { message: "Mã mapping không hợp lệ." })
  mapping_id?: string;
}

export class VarianceListQueryDto extends IposListQueryDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID("all", { message: "Mã kiểm kê không hợp lệ." })
  stocktake_id?: string;

  @ApiPropertyOptional({ enum: VarianceDataStatus })
  @IsOptional()
  @IsEnum(VarianceDataStatus, { message: "Trạng thái dữ liệu không hợp lệ." })
  data_status?: VarianceDataStatus;
}

export class CreateMappingDto {
  @IsUUID()
  facility_id!: string;

  @IsString()
  @Length(1, 50)
  source!: string;

  @IsString()
  @Length(1, 150)
  external_item_key!: string;

  @IsString()
  @Length(1, 250)
  menu_item_name!: string;
}

export class RecipeIngredientDto {
  @IsUUID()
  ingredient_id!: string;

  @IsString()
  @Matches(/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/)
  base_quantity!: string;
}

export class CreateRecipeDto {
  @IsUUID()
  mapping_id!: string;

  @IsUUID()
  stock_location_id!: string;

  @IsISO8601()
  effective_from!: string;

  @IsOptional()
  @IsISO8601()
  effective_to?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients!: RecipeIngredientDto[];
}

export class SalesRecordDto {
  @IsString()
  @Length(1, 150)
  external_key!: string;

  @IsString()
  @Length(1, 150)
  external_item_key!: string;

  @IsISO8601()
  sold_at!: string;

  @IsString()
  @Matches(/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/)
  quantity!: string;
}

export class CreateSalesImportDto {
  @IsUUID()
  facility_id!: string;

  @IsString()
  @Length(1, 50)
  source!: string;

  @IsString()
  @Length(1, 150)
  external_batch_key!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => SalesRecordDto)
  records!: SalesRecordDto[];
}

export class RecalculateVarianceDto {
  @IsUUID()
  stocktake_id!: string;
}

export class CreateAlertRuleDto {
  @IsOptional()
  @IsUUID()
  facility_id?: string;

  @IsOptional()
  @IsUUID()
  ingredient_id?: string;

  @IsString()
  @Matches(/^(QUANTITY|PERCENT)$/)
  threshold_type!: string;

  @IsString()
  @Matches(/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/)
  threshold_value!: string;
}
