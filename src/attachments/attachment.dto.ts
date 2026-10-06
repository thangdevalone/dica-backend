import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsUUID } from "class-validator";

export class AttachmentResourceDto {
  @ApiProperty({ enum: ["RECEIPT", "DAMAGE_REPORT"] })
  @IsIn(["RECEIPT", "DAMAGE_REPORT"])
  resource_type!: "RECEIPT" | "DAMAGE_REPORT";

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  resource_id!: string;
}
