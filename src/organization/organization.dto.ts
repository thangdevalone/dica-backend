import { IsEnum, IsOptional, IsString, IsUUID, Length } from "class-validator";
import {
  DepartmentType,
  FacilityType,
  StockLocationType,
} from "../generated/prisma/enums.js";
export class CreateFacilityDto {
  @IsString() @Length(2, 50) code!: string;
  @IsString() @Length(2, 200) name!: string;
  @IsEnum(FacilityType) type!: FacilityType;
}
export class CreateStockLocationDto {
  @IsUUID() facility_id!: string;
  @IsString() @Length(2, 50) code!: string;
  @IsString() @Length(2, 200) name!: string;
  @IsOptional() @IsEnum(StockLocationType) type?: StockLocationType;
}
export class CreateDepartmentDto {
  @IsUUID() facility_id!: string;
  @IsOptional() @IsUUID() stock_location_id?: string;
  @IsString() @Length(2, 50) code!: string;
  @IsString() @Length(2, 200) name!: string;
  @IsEnum(DepartmentType) type!: DepartmentType;
}
