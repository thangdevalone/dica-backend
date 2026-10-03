import { IsInt, IsString, Matches, Min } from "class-validator";

export class UpdatePaymentDto {
  @IsString()
  @Matches(/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/)
  paid_value!: string;

  @IsInt()
  @Min(0)
  expected_version!: number;
}
