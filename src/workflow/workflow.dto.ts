import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import type { PurgeKind } from "./purge.service.js";

export class PurgeParamsDto {
  @ApiProperty({
    enum: ["facility", "stock_location", "ingredient", "supplier"],
  })
  @IsIn(["facility", "stock_location", "ingredient", "supplier"])
  kind!: PurgeKind;
  @ApiProperty() @IsUUID() id!: string;
}
export class PurgeDto {
  @ApiProperty() @IsString() @Length(1, 200) password!: string;
  @ApiProperty() @IsString() @Matches(/^[a-f0-9]{64}$/) preview_hash!: string;
}

export class WorkflowPolicyDto {
  @ApiProperty() @IsBoolean() payment_approval_required!: boolean;
  @ApiProperty({ minimum: 6, maximum: 12 })
  @IsInt()
  @Min(6)
  @Max(12)
  attachment_retention_months!: number;
}
export class PriceRuleDto {
  @ApiProperty() @IsUUID() ingredient_id!: string;
  @ApiProperty()
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,4})?$/)
  base_price!: string;
  @ApiProperty()
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,3})(?:\.\d{1,4})?$/)
  tolerance_percent!: string;
}
export class PriceLineDto {
  @ApiProperty() @IsUUID() order_line_id!: string;
  @ApiProperty()
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,4})?$/)
  unit_price!: string;
}
export class OrderPricesDto {
  @ApiProperty() @IsInt() @Min(1) expected_version!: number;
  @ApiPropertyOptional({ minimum: 0, maximum: 3650 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3650)
  payment_term_days?: number;
  @ApiProperty({ type: [PriceLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PriceLineDto)
  lines!: PriceLineDto[];
}
export class WorkflowCommandDto {
  @ApiProperty() @IsInt() @Min(1) expected_version!: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  note?: string;
}
export class ReturnLineDto {
  @ApiProperty() @IsUUID() order_line_id!: string;
  @ApiProperty()
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,3})?$/)
  quantity!: string;
}
export class CreateReturnDto {
  @ApiProperty() @IsUUID() order_id!: string;
  @ApiProperty() @IsString() @Length(3, 1000) note!: string;
  @ApiProperty({ type: [ReturnLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReturnLineDto)
  lines!: ReturnLineDto[];
}
