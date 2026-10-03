import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
  ValidateNested,
} from "class-validator";
export class CreateRequestLineDto {
  @IsUUID() ingredient_id!: string;
  @IsUUID() unit_id!: string;
  @IsString() @Matches(/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/) quantity!: string;
}
export class CreateRequestDto {
  @IsUUID() facility_id!: string;
  @IsUUID() department_id!: string;
  @IsDateString() required_date!: string;
  @IsOptional() @IsString() @Length(0, 1000) note?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateRequestLineDto)
  lines!: CreateRequestLineDto[];
}
export class VersionCommandDto {
  @IsInt() @Min(1) expected_version!: number;
  @IsOptional() @IsString() @Length(0, 1000) note?: string;
}
export class RejectRequestDto extends VersionCommandDto {
  @IsString() @Length(3, 1000) declare note: string;
}

export class UpdateRequestDto extends CreateRequestDto {
  @IsInt()
  @Min(1)
  expected_version!: number;
}

export class CancelRequestDto extends VersionCommandDto {
  @IsString() @Length(3, 1000) declare note: string;
}
