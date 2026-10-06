import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
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
  @ApiProperty({ format: "uuid", description: "Mã dòng đơn thực hiện" })
  @IsUUID()
  order_line_id!: string;
  @ApiProperty({
    example: "5.5",
    description: "Số lượng giao/nhận dạng chuỗi thập phân",
  })
  @IsString()
  @Matches(/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/)
  quantity!: string;
}
export class CreateDispatchDto {
  @ApiProperty({ format: "uuid", description: "Mã đơn thực hiện" })
  @IsUUID()
  order_id!: string;
  @ApiPropertyOptional({ example: "Giao ca sáng", maxLength: 1000 })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  note?: string;
  @ApiProperty({ type: () => [QuantityLineDto], minItems: 1, maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => QuantityLineDto)
  lines!: QuantityLineDto[];
}
export class CreateReceiptDto {
  @ApiProperty({ format: "uuid", description: "Mã đơn thực hiện" })
  @IsUUID()
  order_id!: string;
  @ApiPropertyOptional({
    format: "uuid",
    description: "Mã phiếu giao tương ứng nếu có",
  })
  @IsOptional()
  @IsUUID()
  dispatch_id?: string;
  @ApiPropertyOptional({ example: "Đã kiểm đủ hàng", maxLength: 1000 })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  note?: string;
  @ApiProperty({ type: () => [QuantityLineDto], minItems: 1, maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => QuantityLineDto)
  lines!: QuantityLineDto[];
}
export class PostDocumentDto {
  @ApiProperty({
    example: 1,
    minimum: 1,
    description: "Phiên bản hiện tại để chống ghi đè",
  })
  @IsInt()
  @Min(1)
  expected_version!: number;
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
  @IsIn(["OPEN", "RESOLVED"], {
    message: "Trạng thái chênh lệch không hợp lệ.",
  })
  status?: "OPEN" | "RESOLVED";
}

export class ResolveDiscrepancyDto {
  @ApiProperty({
    example: "Đã đối chiếu và điều chỉnh theo số thực nhận",
    minLength: 3,
    maxLength: 1000,
  })
  @IsString()
  @Length(3, 1000)
  resolution!: string;
}
