import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
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
import { DocumentStatus } from "../generated/prisma/enums.js";
export class RequestListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: DocumentStatus })
  @IsOptional()
  @IsEnum(DocumentStatus, { message: "Trạng thái yêu cầu không hợp lệ." })
  status?: DocumentStatus;
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  facility_id?: string;
}
export class CreateRequestLineDto {
  @ApiProperty({ format: "uuid", description: "Mã nguyên liệu" })
  @IsUUID()
  ingredient_id!: string;
  @ApiProperty({ format: "uuid", description: "Mã đơn vị tính" })
  @IsUUID()
  unit_id!: string;
  @ApiProperty({
    example: "10.5",
    description: "Số lượng dạng chuỗi thập phân",
  })
  @IsString()
  @Matches(/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/)
  quantity!: string;
}
export class CreateRequestDto {
  @ApiProperty({ format: "uuid", description: "Mã cơ sở nhận hàng" })
  @IsUUID()
  facility_id!: string;
  @ApiProperty({ format: "uuid", description: "Mã bộ phận yêu cầu" })
  @IsUUID()
  department_id!: string;
  @ApiProperty({ example: "2026-10-10", format: "date" })
  @IsDateString()
  required_date!: string;
  @ApiPropertyOptional({ example: "Giao trước 10 giờ", maxLength: 1000 })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  note?: string;
  @ApiProperty({
    type: () => [CreateRequestLineDto],
    minItems: 1,
    maxItems: 100,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateRequestLineDto)
  lines!: CreateRequestLineDto[];
}
export class VersionCommandDto {
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
export class RejectRequestDto extends VersionCommandDto {
  @ApiProperty({
    example: "Số lượng vượt nhu cầu",
    minLength: 3,
    maxLength: 1000,
  })
  @IsString()
  @Length(3, 1000)
  declare note: string;
}

export class UpdateRequestDto extends CreateRequestDto {
  @ApiProperty({
    example: 1,
    minimum: 1,
    description: "Phiên bản hiện tại để chống ghi đè",
  })
  @IsInt()
  @Min(1)
  expected_version!: number;
}

export class CancelRequestDto extends VersionCommandDto {
  @ApiProperty({ example: "Không còn nhu cầu", minLength: 3, maxLength: 1000 })
  @IsString()
  @Length(3, 1000)
  declare note: string;
}
