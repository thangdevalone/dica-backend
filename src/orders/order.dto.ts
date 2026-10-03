import { IsInt, IsString, Length, Min } from "class-validator";

export class CloseOutstandingDto {
  @IsInt()
  @Min(1)
  expected_version!: number;

  @IsString()
  @Length(3, 1000)
  reason!: string;
}

export class CancelOrderDto extends CloseOutstandingDto {}
