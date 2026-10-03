import { IsOptional, IsString, Length } from "class-validator";
import { PaginationDto } from "../common/dto/pagination.dto.js";

export class AuditQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  action?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  resource_type?: string;
}
