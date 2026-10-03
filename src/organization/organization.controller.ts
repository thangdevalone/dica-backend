import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { RequirePermissions } from "../auth/decorators/permissions.decorator.js";
import { ConfigAudit } from "../common/audit/config-audit.decorator.js";
import { PaginationDto } from "../common/dto/pagination.dto.js";
import {
  CreateDepartmentDto,
  CreateFacilityDto,
  CreateStockLocationDto,
  OrganizationListQueryDto,
  UpdateDepartmentDto,
  UpdateFacilityDto,
  UpdateStockLocationDto,
} from "./organization.dto.js";
import { OrganizationService } from "./organization.service.js";
@ApiTags("Tổ chức")
@ApiBearerAuth()
@ConfigAudit("ORGANIZATION_CONFIG")
@Controller()
export class OrganizationController {
  constructor(private s: OrganizationService) {}
  @Get("facilities") @RequirePermissions("facility.read") facilities(
    @CurrentUser() u: AuthUser,
    @Query() q: PaginationDto,
  ) {
    return this.s.facilities(u, q);
  }
  @Post("facilities") @RequirePermissions("facility.manage") createF(
    @CurrentUser() u: AuthUser,
    @Body() d: CreateFacilityDto,
  ) {
    return this.s.createFacility(u, d);
  }
  @Patch("facilities/:id") @RequirePermissions("facility.manage") updateF(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: UpdateFacilityDto,
  ) {
    return this.s.updateFacility(u, id, d);
  }
  @Get("stock-locations") @RequirePermissions("stock_location.read") locations(
    @CurrentUser() u: AuthUser,
    @Query() q: OrganizationListQueryDto,
  ) {
    return this.s.locations(u, q);
  }
  @Post("stock-locations") @RequirePermissions("stock_location.manage") createL(
    @CurrentUser() u: AuthUser,
    @Body() d: CreateStockLocationDto,
  ) {
    return this.s.createLocation(u, d);
  }
  @Patch("stock-locations/:id")
  @RequirePermissions("stock_location.manage")
  updateL(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: UpdateStockLocationDto,
  ) {
    return this.s.updateLocation(u, id, d);
  }
  @Get("departments") @RequirePermissions("department.read") departments(
    @CurrentUser() u: AuthUser,
    @Query() q: OrganizationListQueryDto,
  ) {
    return this.s.departments(u, q);
  }
  @Post("departments") @RequirePermissions("department.manage") createD(
    @CurrentUser() u: AuthUser,
    @Body() d: CreateDepartmentDto,
  ) {
    return this.s.createDepartment(u, d);
  }
  @Patch("departments/:id") @RequirePermissions("department.manage") updateD(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: UpdateDepartmentDto,
  ) {
    return this.s.updateDepartment(u, id, d);
  }
}
