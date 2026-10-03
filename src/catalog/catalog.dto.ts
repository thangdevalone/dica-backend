import { ApiPropertyOptional } from "@nestjs/swagger";
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
  @IsString() @Length(1, 30) code!: string;
  @IsString() @Length(1, 100) name!: string;
  @IsOptional() @IsInt() @Min(0) @Max(6) decimal_scale?: number;
}
export class CreateIngredientGroupDto {
  @IsString() @Length(1, 50) code!: string;
  @IsString() @Length(1, 200) name!: string;
}
export class CreateIngredientDto {
  @IsString() @Length(1, 50) code!: string;
  @IsString() @Length(1, 200) name!: string;
  @IsUUID() base_unit_id!: string;
  @IsOptional() @IsUUID() group_id?: string;
}
export class CreateSupplierDto {
  @IsString() @Length(1, 50) code!: string;
  @IsString() @Length(1, 200) name!: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsEmail() @MaxLength(200) email?: string;
}
export class LinkSupplierIngredientDto {
  @IsUUID() supplier_id!: string;
  @IsUUID() ingredient_id!: string;
  @IsOptional() @IsString() @MaxLength(100) supplier_sku?: string;
  @IsOptional()
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,15})(?:\.\d{1,4})?$/)
  reference_price?: string;
}

export class CreateConversionDto {
  @IsUUID() ingredient_id!: string;
  @IsUUID() unit_id!: string;
  @IsString()
  @Matches(/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/)
  factor_to_base!: string;
  @IsISO8601() effective_from!: string;
  @IsOptional() @IsISO8601() effective_to?: string;
}

/** Mã (code) không cho sửa vì đã được tham chiếu trong snapshot/chứng từ. */
export class UpdateUnitDto {
  @IsOptional() @IsString() @Length(1, 100) name?: string;
  @IsOptional() @IsInt() @Min(0) @Max(6) decimal_scale?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}
export class UpdateIngredientGroupDto {
  @IsOptional() @IsString() @Length(1, 200) name?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
export class UpdateIngredientDto {
  @IsOptional() @IsString() @Length(1, 200) name?: string;
  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsUUID() group_id?:
    | string
    | null;
  @IsOptional() @IsBoolean() active?: boolean;
}
export class UpdateSupplierDto {
  @IsOptional() @IsString() @Length(1, 200) name?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @ValidateIf((_o, v) => v !== "") @IsEmail() @MaxLength(200)
  email?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
export class UpdateSupplierIngredientDto {
  @IsOptional() @IsString() @MaxLength(100) supplier_sku?: string;
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,15})(?:\.\d{1,4})?$/)
  reference_price?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
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
