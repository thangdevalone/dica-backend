import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from "class-validator";
import { PaginationDto } from "../common/dto/pagination.dto.js";
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
/** Mã và cơ sở không cho sửa vì đã được tham chiếu trong chứng từ/quyền. */
export class UpdateFacilityDto {
  @IsOptional() @IsString() @Length(2, 200) name?: string;
  @IsOptional() @IsEnum(FacilityType) type?: FacilityType;
  @IsOptional() @IsBoolean() active?: boolean;
}
export class UpdateStockLocationDto {
  @IsOptional() @IsString() @Length(2, 200) name?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
export class UpdateDepartmentDto {
  @IsOptional() @IsString() @Length(2, 200) name?: string;
  @IsOptional() @IsEnum(DepartmentType) type?: DepartmentType;
  @IsOptional() @IsUUID() stock_location_id?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
}
export class OrganizationListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  facility_id?: string;
}
