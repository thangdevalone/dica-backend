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
export class QuantityLineDto {
  @IsUUID() order_line_id!: string;
  @IsString() @Matches(/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/) quantity!: string;
}
export class CreateDispatchDto {
  @IsUUID() order_id!: string;
  @IsOptional() @IsString() @Length(0, 1000) note?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => QuantityLineDto)
  lines!: QuantityLineDto[];
}
export class CreateReceiptDto {
  @IsUUID() order_id!: string;
  @IsOptional() @IsUUID() dispatch_id?: string;
  @IsOptional() @IsString() @Length(0, 1000) note?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => QuantityLineDto)
  lines!: QuantityLineDto[];
}
export class PostDocumentDto {
  @IsInt() @Min(1) expected_version!: number;
}

export class ResolveDiscrepancyDto {
  @IsString()
  @Length(3, 1000)
  resolution!: string;
}
