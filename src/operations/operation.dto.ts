import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
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

export class CountLineDto {
  @IsUUID()
  ingredient_id!: string;

  @IsString()
  @Matches(/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/)
  counted_quantity!: string;
}

export class CreateStocktakeDto {
  @IsUUID()
  stock_location_id!: string;

  @IsDateString()
  business_date!: string;

  @IsISO8601()
  cutoff_at!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CountLineDto)
  lines!: CountLineDto[];
}

export class VersionDto {
  @IsInt()
  @Min(1)
  expected_version!: number;
}

export class UpdateStocktakeDto extends CreateStocktakeDto {
  @IsInt()
  @Min(1)
  expected_version!: number;
}

export class CreateAdjustmentDto {
  @IsUUID()
  stock_location_id!: string;

  @IsUUID()
  ingredient_id!: string;

  @IsString()
  @Matches(/^-?(?:0|[1-9]\d*)(?:\.\d{1,3})?$/)
  quantity!: string;

  @IsString()
  @Length(3, 1000)
  reason!: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  source_type?: string;

  @IsOptional()
  @IsUUID()
  source_id?: string;
}

export class DamageLineDto {
  @IsUUID()
  ingredient_id!: string;

  @IsString()
  @Matches(/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/)
  quantity!: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  reason?: string;
}

export class CreateDamageDto {
  @IsUUID()
  stock_location_id!: string;

  @IsString()
  @Length(3, 1000)
  reason!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => DamageLineDto)
  lines!: DamageLineDto[];
}

export class UpdateDamageDto extends CreateDamageDto {
  @IsInt()
  @Min(1)
  expected_version!: number;
}
