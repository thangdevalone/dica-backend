import { IsEnum, IsOptional, IsString, IsUUID, Length } from "class-validator";
import { ScopeType, UserKind } from "../generated/prisma/enums.js";
export class CreateUserDto {
  @IsString() @Length(3, 100) username!: string;
  @IsString() @Length(2, 200) display_name!: string;
  @IsString() @Length(8, 200) password!: string;
  @IsEnum(UserKind) kind!: UserKind;
  @IsOptional() @IsUUID() supplier_id?: string;
}
export class AssignGrantDto {
  @IsUUID() user_id!: string;
  @IsUUID() role_id!: string;
  @IsEnum(ScopeType) scope_type!: ScopeType;
  @IsOptional() @IsUUID() facility_id?: string;
  @IsOptional() @IsUUID() stock_location_id?: string;
  @IsOptional() @IsUUID() department_id?: string;
}
