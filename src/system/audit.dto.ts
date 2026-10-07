import { IsDateString, IsOptional, IsString, Length } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { PaginationDto } from "../common/dto/pagination.dto.js";

export class AuditQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    example: "request.",
    description: "Lọc gần đúng theo hành động hoặc nhóm hành động audit",
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

  @ApiPropertyOptional({
    example: "nguyenvana",
    description: "Tìm người thực hiện theo tên hiển thị hoặc tên đăng nhập",
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  actor?: string;

  @ApiPropertyOptional({
    example: "2026-10-01T00:00:00.000Z",
    description: "Thời điểm bắt đầu, ISO-8601",
  })
  @IsOptional()
  @IsDateString()
  created_from?: string;

  @ApiPropertyOptional({
    example: "2026-10-07T23:59:59.999Z",
    description: "Thời điểm kết thúc, ISO-8601",
  })
  @IsOptional()
  @IsDateString()
  created_to?: string;
}
