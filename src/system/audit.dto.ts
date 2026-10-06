import { IsOptional, IsString, Length } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { PaginationDto } from "../common/dto/pagination.dto.js";

export class AuditQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    example: "CREATE",
    description: "Lọc theo hành động audit",
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  action?: string;

  @ApiPropertyOptional({
    example: "USER",
    description: "Lọc theo loại tài nguyên",
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  resource_type?: string;
}
