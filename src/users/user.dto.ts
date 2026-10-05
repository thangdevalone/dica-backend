import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from "class-validator";
import { PaginationDto } from "../common/dto/pagination.dto.js";
import { ScopeType, UserKind } from "../generated/prisma/enums.js";
export class GrantListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID("all", { message: "Mã tài khoản không hợp lệ." })
  user_id?: string;
}
export class CreateUserDto {
  @IsString()
  @Length(3, 100)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message:
      "Tên đăng nhập chỉ được chứa chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.",
  })
  username!: string;
  @IsOptional() @IsString() @Length(0, 200) display_name?: string;
  @IsString() @Length(8, 200) password!: string;
  @IsEnum(UserKind) kind!: UserKind;
  @IsOptional() @IsUUID() supplier_id?: string;
  @IsUUID() role_id!: string;
  @IsEnum(ScopeType) scope_type!: ScopeType;
  @IsOptional() @IsUUID() facility_id?: string;
  @IsOptional() @IsUUID() stock_location_id?: string;
  @IsOptional() @IsUUID() department_id?: string;
}
export class AssignGrantDto {
  @IsUUID() user_id!: string;
  @IsUUID() role_id!: string;
  @IsEnum(ScopeType) scope_type!: ScopeType;
  @IsOptional() @IsUUID() facility_id?: string;
  @IsOptional() @IsUUID() stock_location_id?: string;
  @IsOptional() @IsUUID() department_id?: string;
}
export class UpdateUserDto {
  @IsOptional() @IsString() @Length(2, 200) display_name?: string;
}
export class ResetPasswordDto {
  @IsString() @Length(8, 200) password!: string;
}
