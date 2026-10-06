import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
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
  @ApiProperty({ example: "HCM01", maxLength: 50 })
  @IsString()
  @Length(2, 50)
  code!: string;
  @ApiProperty({ example: "Chi nhánh Quận 1", maxLength: 200 })
  @IsString()
  @Length(2, 200)
  name!: string;
  @ApiProperty({ enum: FacilityType })
  @IsEnum(FacilityType)
  type!: FacilityType;
}
export class CreateStockLocationDto {
  @ApiProperty({ format: "uuid", description: "Mã cơ sở" })
  @IsUUID()
  facility_id!: string;
  @ApiProperty({ example: "KHO01", maxLength: 50 })
  @IsString()
  @Length(2, 50)
  code!: string;
  @ApiProperty({ example: "Kho nguyên liệu", maxLength: 200 })
  @IsString()
  @Length(2, 200)
  name!: string;
  @ApiPropertyOptional({ enum: StockLocationType })
  @IsOptional()
  @IsEnum(StockLocationType)
  type?: StockLocationType;
}
export class CreateDepartmentDto {
  @ApiProperty({ format: "uuid", description: "Mã cơ sở" })
  @IsUUID()
  facility_id!: string;
  @ApiPropertyOptional({
    format: "uuid",
    description: "Kho mặc định của bộ phận",
  })
  @IsOptional()
  @IsUUID()
  stock_location_id?: string;
  @ApiProperty({ example: "BEP01", maxLength: 50 })
  @IsString()
  @Length(2, 50)
  code!: string;
  @ApiProperty({ example: "Bếp chính", maxLength: 200 })
  @IsString()
  @Length(2, 200)
  name!: string;
  @ApiProperty({ enum: DepartmentType })
  @IsEnum(DepartmentType)
  type!: DepartmentType;
}
/** Mã và cơ sở không cho sửa vì đã được tham chiếu trong chứng từ/quyền. */
export class UpdateFacilityDto {
  @ApiPropertyOptional({ example: "Chi nhánh Quận 1", maxLength: 200 })
  @IsOptional()
  @IsString()
  @Length(2, 200)
  name?: string;
  @ApiPropertyOptional({ enum: FacilityType })
  @IsOptional()
  @IsEnum(FacilityType)
  type?: FacilityType;
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
export class UpdateStockLocationDto {
  @ApiPropertyOptional({ example: "Kho nguyên liệu", maxLength: 200 })
  @IsOptional()
  @IsString()
  @Length(2, 200)
  name?: string;
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
export class UpdateDepartmentDto {
  @ApiPropertyOptional({ example: "Bếp chính", maxLength: 200 })
  @IsOptional()
  @IsString()
  @Length(2, 200)
  name?: string;
  @ApiPropertyOptional({ enum: DepartmentType })
  @IsOptional()
  @IsEnum(DepartmentType)
  type?: DepartmentType;
  @ApiPropertyOptional({
    format: "uuid",
    nullable: true,
    description: "Gửi null để bỏ kho mặc định",
  })
  @IsOptional()
  @IsUUID()
  stock_location_id?: string | null;
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
export class OrganizationListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  facility_id?: string;
}
