import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: "Nguyễn Văn A", maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  display_name?: string;

  @ApiPropertyOptional({
    example: "012345678901",
    description: "CCCD/CMND gồm 9-12 chữ số",
  })
  @IsOptional()
  @IsString()
  @ValidateIf((_, value) => value !== "")
  @Matches(/^\d{9,12}$/, { message: "CCCD/CMND phải có từ 9 đến 12 chữ số." })
  identity_number?: string;

  @ApiPropertyOptional({ example: "1995-08-20", format: "date" })
  @IsOptional()
  @IsString()
  @ValidateIf((_, value) => value !== "")
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "Ngày sinh phải có định dạng YYYY-MM-DD.",
  })
  date_of_birth?: string;

  @ApiPropertyOptional({ example: "0901234567", maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ example: "user@dica.vn", format: "email" })
  @IsOptional()
  @IsString()
  @ValidateIf((_, value) => value !== "")
  @IsEmail({}, { message: "Email không hợp lệ." })
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({
    example: "123 Nguyễn Huệ, Quận 1, TP.HCM",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;
}

export class ChangeUsernameDto {
  @ApiProperty({ example: "nguyenvana", minLength: 3, maxLength: 100 })
  @IsString()
  @Length(3, 100)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message:
      "Tên đăng nhập chỉ được chứa chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.",
  })
  username!: string;

  @ApiProperty({ example: "MatKhauHienTai#2026" })
  @IsString()
  @Length(1, 200)
  current_password!: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: "MatKhauHienTai#2026" })
  @IsString()
  @Length(1, 200)
  current_password!: string;

  @ApiProperty({ example: "MatKhauMoi#2026", minLength: 8 })
  @IsString()
  @Length(8, 200)
  new_password!: string;
}
