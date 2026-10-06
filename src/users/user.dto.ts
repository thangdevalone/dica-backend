import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
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
  @ApiProperty({ example: "nguyenvana", minLength: 3, maxLength: 100 })
  @IsString()
  @Length(3, 100)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message:
      "Tên đăng nhập chỉ được chứa chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.",
  })
  username!: string;
  @ApiPropertyOptional({ example: "Nguyễn Văn A", maxLength: 200 })
  @IsOptional()
  @IsString()
  @Length(0, 200)
  display_name?: string;
  @ApiProperty({ example: "MatKhauAnToan#2026", minLength: 8 })
  @IsString()
  @Length(8, 200)
  password!: string;
  @ApiProperty({ enum: UserKind })
  @IsEnum(UserKind)
  kind!: UserKind;
  @ApiPropertyOptional({
    format: "uuid",
    description: "Bắt buộc với tài khoản nhà cung cấp",
  })
  @IsOptional()
  @IsUUID()
  supplier_id?: string;
  @ApiProperty({ format: "uuid", description: "Vai trò cấp ban đầu" })
  @IsUUID()
  role_id!: string;
  @ApiProperty({ enum: ScopeType, description: "Loại phạm vi quyền ban đầu" })
  @IsEnum(ScopeType)
  scope_type!: ScopeType;
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  facility_id?: string;
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  stock_location_id?: string;
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  department_id?: string;
}
export class AssignGrantDto {
  @ApiProperty({ format: "uuid", description: "Tài khoản được cấp quyền" })
  @IsUUID()
  user_id!: string;
  @ApiProperty({ format: "uuid", description: "Vai trò được cấp" })
  @IsUUID()
  role_id!: string;
  @ApiProperty({ enum: ScopeType })
  @IsEnum(ScopeType)
  scope_type!: ScopeType;
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  facility_id?: string;
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  stock_location_id?: string;
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  department_id?: string;
}
export class UpdateUserDto {
  @ApiPropertyOptional({
    example: "Nguyễn Văn A",
    minLength: 2,
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @Length(2, 200)
  display_name?: string;
}
export class ResetPasswordDto {
  @ApiProperty({ example: "MatKhauMoi#2026", minLength: 8 })
  @IsString()
  @Length(8, 200)
  password!: string;
}
