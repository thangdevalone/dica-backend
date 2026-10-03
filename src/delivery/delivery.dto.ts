import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
  ValidateNested,
} from "class-validator";
import { PaginationDto } from "../common/dto/pagination.dto.js";
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

export class DeliveryListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID("all", { message: "Mã đơn không hợp lệ." })
  order_id?: string;

  @ApiPropertyOptional({
    enum: ["DRAFT", "POSTED", "PENDING_EXCESS_REVIEW", "CANCELLED"],
  })
  @IsOptional()
  @IsIn(["DRAFT", "POSTED", "PENDING_EXCESS_REVIEW", "CANCELLED"], {
    message: "Trạng thái chứng từ không hợp lệ.",
  })
  status?: "DRAFT" | "POSTED" | "PENDING_EXCESS_REVIEW" | "CANCELLED";
}

export class DiscrepancyListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ["OPEN", "RESOLVED"] })
  @IsOptional()
  @IsIn(["OPEN", "RESOLVED"], { message: "Trạng thái chênh lệch không hợp lệ." })
  status?: "OPEN" | "RESOLVED";
}

export class ResolveDiscrepancyDto {
  @IsString()
  @Length(3, 1000)
  resolution!: string;
}
