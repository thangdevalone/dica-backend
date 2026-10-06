import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, Length } from "class-validator";

export class RegisterPushDeviceDto {
  @ApiProperty({
    description:
      "FCM registration token lấy từ Firebase Messaging trên Android hoặc iOS.",
    minLength: 20,
    maxLength: 4096,
  })
  @IsString()
  @Length(20, 4096)
  token!: string;

  @ApiPropertyOptional({ enum: ["ANDROID", "IOS"], default: "ANDROID" })
  @IsOptional()
  @IsIn(["ANDROID", "IOS"])
  platform?: "ANDROID" | "IOS";

  @ApiPropertyOptional({
    maxLength: 200,
    description: "ID cài đặt do app tự sinh.",
  })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  device_id?: string;

  @ApiPropertyOptional({ maxLength: 50, example: "1.0.0+12" })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  app_version?: string;
}

export class UnregisterPushDeviceDto {
  @ApiProperty({ minLength: 20, maxLength: 4096 })
  @IsString()
  @Length(20, 4096)
  token!: string;
}
