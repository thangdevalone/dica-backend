import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsISO8601,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";
import { PaginationDto } from "../common/dto/pagination.dto.js";
export class CreateUnitDto {
  @ApiProperty({ example: "KG", maxLength: 30 })
  @IsString()
  @Length(1, 30)
  code!: string;
  @ApiProperty({ example: "Kilogram", maxLength: 100 })
  @IsString()
  @Length(1, 100)
  name!: string;
  @ApiPropertyOptional({ example: 3, minimum: 0, maximum: 6, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  decimal_scale?: number;
}
export class CreateIngredientGroupDto {
  @ApiProperty({ example: "THUC_PHAM", maxLength: 50 })
  @IsString()
  @Length(1, 50)
  code!: string;
  @ApiProperty({ example: "Thực phẩm", maxLength: 200 })
  @IsString()
  @Length(1, 200)
  name!: string;
}
export class CreateIngredientDto {
  @ApiProperty({ example: "CF001", maxLength: 50 })
  @IsString()
  @Length(1, 50)
  code!: string;
  @ApiProperty({ example: "Cà phê hạt", maxLength: 200 })
  @IsString()
  @Length(1, 200)
  name!: string;
  @ApiProperty({ format: "uuid", description: "Đơn vị tính cơ sở" })
  @IsUUID()
  base_unit_id!: string;
  @ApiPropertyOptional({ format: "uuid", description: "Nhóm nguyên liệu" })
  @IsOptional()
  @IsUUID()
  group_id?: string;
}
export class CreateSupplierDto {
  @ApiProperty({ example: "NCC001", maxLength: 50 })
  @IsString()
  @Length(1, 50)
  code!: string;
  @ApiProperty({ example: "Công ty Nguyên liệu A", maxLength: 200 })
  @IsString()
  @Length(1, 200)
  name!: string;
  @ApiPropertyOptional({ example: "0901234567", maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
  @ApiPropertyOptional({ example: "sales@ncc-a.vn", format: "email" })
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;
}
export class LinkSupplierIngredientDto {
  @ApiProperty({ format: "uuid", description: "Mã nhà cung cấp" })
  @IsUUID()
  supplier_id!: string;
  @ApiProperty({ format: "uuid", description: "Mã nguyên liệu" })
  @IsUUID()
  ingredient_id!: string;
  @ApiPropertyOptional({ example: "SKU-NCC-001", maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  supplier_sku?: string;
  @ApiPropertyOptional({
    example: "125000.5",
    description: "Giá tham chiếu dạng chuỗi thập phân",
  })
  @IsOptional()
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,15})(?:\.\d{1,4})?$/)
  reference_price?: string;
}

export class CreateConversionDto {
  @ApiProperty({ format: "uuid", description: "Mã nguyên liệu" })
  @IsUUID()
  ingredient_id!: string;
  @ApiProperty({ format: "uuid", description: "Đơn vị cần quy đổi" })
  @IsUUID()
  unit_id!: string;
  @ApiProperty({ example: "1000", description: "Hệ số sang đơn vị cơ sở" })
  @IsString()
  @Matches(/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/)
  factor_to_base!: string;
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
}

/** Mã (code) không cho sửa vì đã được tham chiếu trong snapshot/chứng từ. */
export class UpdateUnitDto {
  @ApiPropertyOptional({ example: "Kilogram", maxLength: 100 })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;
  @ApiPropertyOptional({ example: 3, minimum: 0, maximum: 6 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  decimal_scale?: number;
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
export class UpdateIngredientGroupDto {
  @ApiPropertyOptional({ example: "Thực phẩm", maxLength: 200 })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
export class UpdateIngredientDto {
  @ApiPropertyOptional({ example: "Cà phê hạt Arabica", maxLength: 200 })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;
  @ApiPropertyOptional({
    format: "uuid",
    nullable: true,
    description: "Gửi null để bỏ nhóm",
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsUUID()
  group_id?: string | null;
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
export class UpdateSupplierDto {
  @ApiPropertyOptional({ example: "Công ty Nguyên liệu A", maxLength: 200 })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;
  @ApiPropertyOptional({ example: "0901234567", maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
  @ApiPropertyOptional({ example: "sales@ncc-a.vn", format: "email" })
  @IsOptional()
  @ValidateIf((_o, v) => v !== "")
  @IsEmail()
  @MaxLength(200)
  email?: string;
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
export class UpdateSupplierIngredientDto {
  @ApiPropertyOptional({ example: "SKU-NCC-001", maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  supplier_sku?: string;
  @ApiPropertyOptional({
    example: "125000.5",
    nullable: true,
    description: "Gửi null để bỏ giá tham chiếu",
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,15})(?:\.\d{1,4})?$/)
  reference_price?: string | null;
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
export class SupplierIngredientQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  supplier_id?: string;
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  ingredient_id?: string;
}
