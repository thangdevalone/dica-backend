import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from "class-validator";
import { PaginationDto } from "../common/dto/pagination.dto.js";

export class UpdatePaymentDto {
  @ApiProperty({
    example: "1500000",
    description: "Giá trị đã thanh toán dạng chuỗi thập phân",
  })
  @IsString()
  @Matches(/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/)
  paid_value!: string;

  @ApiProperty({
    example: 0,
    minimum: 0,
    description: "Phiên bản hiện tại để chống ghi đè",
  })
  @IsInt()
  @Min(0)
  expected_version!: number;
}

export class ReportQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID("all", { message: "Mã cơ sở không hợp lệ." })
  facility_id?: string;
}
