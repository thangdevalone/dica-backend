import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length, MaxLength } from "class-validator";
export class LoginDto {
  @ApiProperty({ example: "admin" })
  @IsString()
  @Length(3, 100)
  username!: string;
  @ApiProperty({ example: "MatKhauAnToan#2026" })
  @IsString()
  // Chính sách độ dài chỉ áp dụng khi tạo/đặt lại mật khẩu; đăng nhập chỉ cần không rỗng.
  @Length(1, 200, { message: "Vui lòng nhập mật khẩu." })
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
