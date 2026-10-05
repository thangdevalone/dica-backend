import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from "class-validator";

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  display_name?: string;

  @IsOptional()
  @IsString()
  @ValidateIf((_, value) => value !== "")
  @Matches(/^\d{9,12}$/, { message: "CCCD/CMND phải có từ 9 đến 12 chữ số." })
  identity_number?: string;

  @IsOptional()
  @IsString()
  @ValidateIf((_, value) => value !== "")
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "Ngày sinh phải có định dạng YYYY-MM-DD.",
  })
  date_of_birth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @ValidateIf((_, value) => value !== "")
  @IsEmail({}, { message: "Email không hợp lệ." })
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;
}

export class ChangeUsernameDto {
  @IsString()
  @Length(3, 100)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message:
      "Tên đăng nhập chỉ được chứa chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.",
  })
  username!: string;

  @IsString()
  @Length(1, 200)
  current_password!: string;
}

export class ChangePasswordDto {
  @IsString()
  @Length(1, 200)
  current_password!: string;

  @IsString()
  @Length(8, 200)
  new_password!: string;
}
