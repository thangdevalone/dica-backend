import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
  ValidateNested,
} from "class-validator";

export class CreateTransferLineDto {
  @IsUUID()
  ingredient_id!: string;

  @IsUUID()
  unit_id!: string;

  @IsString()
  @Matches(/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/)
  quantity!: string;
}

export class CreateTransferDto {
  @IsUUID()
  from_stock_location_id!: string;

  @IsUUID()
  to_stock_location_id!: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateTransferLineDto)
  lines!: CreateTransferLineDto[];
}

export class TransferCommandDto {
  @IsInt()
  @Min(1)
  expected_version!: number;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  note?: string;
}

export class RejectTransferDto extends TransferCommandDto {
  @IsString()
  @Length(3, 1000)
  declare note: string;
}

export class UpdateTransferDto extends CreateTransferDto {
  @IsInt()
  @Min(1)
  expected_version!: number;
}

export class CancelTransferDto extends TransferCommandDto {
  @IsString()
  @Length(3, 1000)
  declare note: string;
}
