import { ApiPropertyOptional } from "@nestjs/swagger";
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
  @IsString()
  @Matches(/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/)
  paid_value!: string;

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
