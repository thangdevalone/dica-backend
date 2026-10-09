import { ApiProperty } from "@nestjs/swagger";
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export const ATTACHMENT_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export class AttachmentResourceDto {
  @ApiProperty({ enum: ["RECEIPT", "DAMAGE_REPORT", "RETURN"] })
  @IsIn(["RECEIPT", "DAMAGE_REPORT", "RETURN"])
  resource_type!: "RECEIPT" | "DAMAGE_REPORT" | "RETURN";

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  resource_id!: string;
}

export class AttachmentUploadInitDto extends AttachmentResourceDto {
  @ApiProperty({ maxLength: 255, example: "receipt.jpg" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  file_name!: string;

  @ApiProperty({ enum: ATTACHMENT_CONTENT_TYPES })
  @IsIn(ATTACHMENT_CONTENT_TYPES)
  content_type!: (typeof ATTACHMENT_CONTENT_TYPES)[number];

  @ApiProperty({ minimum: 1, maximum: 5 * 1024 * 1024 })
  @IsInt()
  @Min(1)
  @Max(5 * 1024 * 1024)
  size_bytes!: number;
}
