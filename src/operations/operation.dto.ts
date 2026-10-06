import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
  ValidateNested,
} from "class-validator";
import { PaginationDto } from "../common/dto/pagination.dto.js";
import {
  AdjustmentStatus,
  DamageStatus,
  StocktakeStatus,
} from "../generated/prisma/enums.js";

export class OperationListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID("all", { message: "Mã cơ sở không hợp lệ." })
  facility_id?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID("all", { message: "Mã kho không hợp lệ." })
  stock_location_id?: string;
}

export class AdjustmentListQueryDto extends OperationListQueryDto {
  @ApiPropertyOptional({ enum: AdjustmentStatus })
  @IsOptional()
  @IsEnum(AdjustmentStatus, { message: "Trạng thái không hợp lệ." })
  status?: AdjustmentStatus;
}

export class StocktakeListQueryDto extends OperationListQueryDto {
  @ApiPropertyOptional({ enum: StocktakeStatus })
  @IsOptional()
  @IsEnum(StocktakeStatus, { message: "Trạng thái không hợp lệ." })
  status?: StocktakeStatus;
}

export class DamageListQueryDto extends OperationListQueryDto {
  @ApiPropertyOptional({ enum: DamageStatus })
  @IsOptional()
  @IsEnum(DamageStatus, { message: "Trạng thái không hợp lệ." })
  status?: DamageStatus;
}

export class CountLineDto {
  @ApiProperty({ format: "uuid", description: "Mã nguyên liệu" })
  @IsUUID()
  ingredient_id!: string;

  @ApiProperty({
    example: "12.5",
    description: "Số lượng thực tế dạng chuỗi thập phân",
  })
  @IsString()
  @Matches(/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/)
  counted_quantity!: string;
}

export class CreateStocktakeDto {
  @ApiProperty({ format: "uuid", description: "Mã kho kiểm kê" })
  @IsUUID()
  stock_location_id!: string;

  @ApiProperty({ example: "2026-10-06", format: "date" })
  @IsDateString()
  business_date!: string;

  @ApiProperty({ example: "2026-10-06T23:59:59+07:00", format: "date-time" })
  @IsISO8601()
  cutoff_at!: string;

  @ApiProperty({ type: () => [CountLineDto], minItems: 1, maxItems: 500 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CountLineDto)
  lines!: CountLineDto[];
}

export class VersionDto {
  @ApiProperty({
    example: 1,
    minimum: 1,
    description: "Phiên bản hiện tại để chống ghi đè",
  })
  @IsInt()
  @Min(1)
  expected_version!: number;
}

export class UpdateStocktakeDto extends CreateStocktakeDto {
  @ApiProperty({
    example: 1,
    minimum: 1,
    description: "Phiên bản hiện tại để chống ghi đè",
  })
  @IsInt()
  @Min(1)
  expected_version!: number;
}

export class CreateAdjustmentDto {
  @ApiProperty({ format: "uuid", description: "Mã kho cần điều chỉnh" })
  @IsUUID()
  stock_location_id!: string;

  @ApiProperty({ format: "uuid", description: "Mã nguyên liệu" })
  @IsUUID()
  ingredient_id!: string;

  @ApiProperty({
    example: "-2.5",
    description: "Số lượng tăng/giảm dạng chuỗi; âm là giảm",
  })
  @IsString()
  @Matches(/^-?(?:0|[1-9]\d*)(?:\.\d{1,3})?$/)
  quantity!: string;

  @ApiProperty({
    example: "Điều chỉnh theo kết quả kiểm tra",
    minLength: 3,
    maxLength: 1000,
  })
  @IsString()
  @Length(3, 1000)
  reason!: string;

  @ApiPropertyOptional({ example: "MANUAL", maxLength: 50 })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  source_type?: string;

  @ApiPropertyOptional({
    format: "uuid",
    description: "Mã chứng từ nguồn nếu có",
  })
  @IsOptional()
  @IsUUID()
  source_id?: string;
}

export class DamageLineDto {
  @ApiProperty({ format: "uuid", description: "Mã nguyên liệu hỏng" })
  @IsUUID()
  ingredient_id!: string;

  @ApiProperty({
    example: "3.5",
    description: "Số lượng hỏng dạng chuỗi thập phân",
  })
  @IsString()
  @Matches(/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/)
  quantity!: string;

  @ApiPropertyOptional({ example: "Hết hạn sử dụng", maxLength: 1000 })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  reason?: string;
}

export class CreateDamageDto {
  @ApiProperty({ format: "uuid", description: "Mã kho phát sinh hàng hỏng" })
  @IsUUID()
  stock_location_id!: string;

  @ApiProperty({
    example: "Hàng hỏng trong quá trình bảo quản",
    minLength: 3,
    maxLength: 1000,
  })
  @IsString()
  @Length(3, 1000)
  reason!: string;

  @ApiProperty({ type: () => [DamageLineDto], minItems: 1, maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => DamageLineDto)
  lines!: DamageLineDto[];
}

export class UpdateDamageDto extends CreateDamageDto {
  @ApiProperty({
    example: 1,
    minimum: 1,
    description: "Phiên bản hiện tại để chống ghi đè",
  })
  @IsInt()
  @Min(1)
  expected_version!: number;
}
