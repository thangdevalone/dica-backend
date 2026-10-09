import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsISO8601,
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
import { TransferStatus } from "../generated/prisma/enums.js";

export class TransferListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: TransferStatus })
  @IsOptional()
  @IsEnum(TransferStatus, { message: "Trạng thái điều chuyển không hợp lệ." })
  status?: TransferStatus;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID("all", { message: "Mã cơ sở không hợp lệ." })
  facility_id?: string;
}

export class CreateTransferLineDto {
  @ApiProperty({ format: "uuid", description: "Mã nguyên liệu" })
  @IsUUID()
  ingredient_id!: string;

  @ApiProperty({ format: "uuid", description: "Mã đơn vị tính" })
  @IsUUID()
  unit_id!: string;

  @ApiProperty({
    example: "5.25",
    description: "Số lượng dạng chuỗi thập phân",
  })
  @IsString()
  @Matches(/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/)
  quantity!: string;
}

export class CreateTransferDto {
  @ApiProperty({ format: "uuid", description: "Mã kho xuất" })
  @IsUUID()
  from_stock_location_id!: string;

  @ApiProperty({ format: "uuid", description: "Mã kho nhận" })
  @IsUUID()
  to_stock_location_id!: string;

  @ApiProperty({
    type: String,
    format: "date-time",
    example: "2026-10-06T10:30:00+07:00",
    description: "Bắt đầu khoảng giờ dự kiến nhận hàng.",
  })
  @IsISO8601({ strict: true })
  expected_arrival_at!: string;

  @ApiProperty({
    type: String,
    format: "date-time",
    description: "Kết thúc khoảng giờ dự kiến nhận hàng.",
  })
  @IsISO8601({ strict: true })
  expected_arrival_end_at!: string;

  @ApiPropertyOptional({
    example: "Chuyển bổ sung nguyên liệu",
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  note?: string;

  @ApiProperty({
    type: () => [CreateTransferLineDto],
    minItems: 1,
    maxItems: 100,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateTransferLineDto)
  lines!: CreateTransferLineDto[];
}

export class TransferCommandDto {
  @ApiProperty({
    example: 1,
    minimum: 1,
    description: "Phiên bản hiện tại để chống ghi đè",
  })
  @IsInt()
  @Min(1)
  expected_version!: number;

  @ApiPropertyOptional({ example: "Ghi chú thao tác", maxLength: 1000 })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  note?: string;
}

export class RejectTransferDto extends TransferCommandDto {
  @ApiProperty({
    example: "Kho nhận chưa thể tiếp nhận",
    minLength: 3,
    maxLength: 1000,
  })
  @IsString()
  @Length(3, 1000)
  declare note: string;
}

export class UpdateTransferDto extends CreateTransferDto {
  @ApiProperty({
    example: 1,
    minimum: 1,
    description: "Phiên bản hiện tại để chống ghi đè",
  })
  @IsInt()
  @Min(1)
  expected_version!: number;
}

export class CancelTransferDto extends TransferCommandDto {
  @ApiProperty({
    example: "Không còn nhu cầu điều chuyển",
    minLength: 3,
    maxLength: 1000,
  })
  @IsString()
  @Length(3, 1000)
  declare note: string;
}
