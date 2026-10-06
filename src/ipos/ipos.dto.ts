import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
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
  @ApiProperty({ format: "uuid", description: "Mã cơ sở" })
  @IsUUID()
  facility_id!: string;

  @ApiProperty({ example: "IPOS", maxLength: 50 })
  @IsString()
  @Length(1, 50)
  source!: string;

  @ApiProperty({ example: "ITEM-001", maxLength: 150 })
  @IsString()
  @Length(1, 150)
  external_item_key!: string;

  @ApiProperty({ example: "Cà phê sữa", maxLength: 250 })
  @IsString()
  @Length(1, 250)
  menu_item_name!: string;
}

export class RecipeIngredientDto {
  @ApiProperty({ format: "uuid", description: "Mã nguyên liệu" })
  @IsUUID()
  ingredient_id!: string;

  @ApiProperty({
    example: "0.025",
    description: "Định lượng theo đơn vị cơ sở",
  })
  @IsString()
  @Matches(/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/)
  base_quantity!: string;
}

export class CreateRecipeDto {
  @ApiProperty({ format: "uuid", description: "Mã ánh xạ món bán" })
  @IsUUID()
  mapping_id!: string;

  @ApiProperty({ format: "uuid", description: "Kho xuất nguyên liệu" })
  @IsUUID()
  stock_location_id!: string;

  @ApiProperty({ example: "2026-10-06T00:00:00+07:00", format: "date-time" })
  @IsISO8601()
  effective_from!: string;

  @ApiPropertyOptional({
    example: "2026-12-31T23:59:59+07:00",
    format: "date-time",
  })
  @IsOptional()
  @IsISO8601()
  effective_to?: string;

  @ApiProperty({
    type: () => [RecipeIngredientDto],
    minItems: 1,
    maxItems: 100,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients!: RecipeIngredientDto[];
}

export class SalesRecordDto {
  @ApiProperty({ example: "SALE-000001", maxLength: 150 })
  @IsString()
  @Length(1, 150)
  external_key!: string;

  @ApiProperty({ example: "ITEM-001", maxLength: 150 })
  @IsString()
  @Length(1, 150)
  external_item_key!: string;

  @ApiProperty({ example: "2026-10-06T12:30:00+07:00", format: "date-time" })
  @IsISO8601()
  sold_at!: string;

  @ApiProperty({
    example: "2",
    description: "Số lượng bán dạng chuỗi thập phân",
  })
  @IsString()
  @Matches(/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/)
  quantity!: string;
}

export class CreateSalesImportDto {
  @ApiProperty({ format: "uuid", description: "Mã cơ sở" })
  @IsUUID()
  facility_id!: string;

  @ApiProperty({ example: "IPOS", maxLength: 50 })
  @IsString()
  @Length(1, 50)
  source!: string;

  @ApiProperty({ example: "BATCH-20261006-01", maxLength: 150 })
  @IsString()
  @Length(1, 150)
  external_batch_key!: string;

  @ApiProperty({ type: () => [SalesRecordDto], minItems: 1, maxItems: 5000 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => SalesRecordDto)
  records!: SalesRecordDto[];
}

export class RecalculateVarianceDto {
  @ApiProperty({ format: "uuid", description: "Mã phiếu kiểm kê" })
  @IsUUID()
  stocktake_id!: string;
}

export class CreateAlertRuleDto {
  @ApiPropertyOptional({
    format: "uuid",
    description: "Giới hạn quy tắc theo cơ sở",
  })
  @IsOptional()
  @IsUUID()
  facility_id?: string;

  @ApiPropertyOptional({
    format: "uuid",
    description: "Giới hạn quy tắc theo nguyên liệu",
  })
  @IsOptional()
  @IsUUID()
  ingredient_id?: string;

  @ApiProperty({ enum: ["QUANTITY", "PERCENT"], example: "PERCENT" })
  @IsString()
  @Matches(/^(QUANTITY|PERCENT)$/)
  threshold_type!: string;

  @ApiProperty({
    example: "10",
    description: "Ngưỡng cảnh báo dạng chuỗi thập phân",
  })
  @IsString()
  @Matches(/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/)
  threshold_value!: string;
}
