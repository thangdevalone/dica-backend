import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length, MaxLength } from "class-validator";
export class LoginDto {
  @ApiProperty({ example: "admin" })
  @IsString()
  @Length(3, 100)
  username!: string;
  @ApiProperty({ example: "MatKhauAnToan#2026" })
  @IsString()
  @Length(8, 200, { message: "Mật khẩu phải có ít nhất 8 ký tự." })
  password!: string;
  @ApiProperty({ example: "DICA" })
  @IsString()
  @Length(2, 50)
  organization_code!: string;
}
export class RefreshTokenDto {
  @ApiProperty()
  @IsString({ message: "Refresh token không hợp lệ." })
  @MaxLength(4096)
  refresh_token!: string;
}
