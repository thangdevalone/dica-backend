import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { RequirePermissions } from "../auth/decorators/permissions.decorator.js";
import { ConfigAudit } from "../common/audit/config-audit.decorator.js";
import { PaginationDto } from "../common/dto/pagination.dto.js";
import * as D from "./catalog.dto.js";
import { CatalogService } from "./catalog.service.js";
@ApiTags("Danh mục")
@ApiBearerAuth()
@ConfigAudit("CATALOG_CONFIG")
@Controller()
export class CatalogController {
  constructor(private s: CatalogService) {}
  @Get("conversions")
  @RequirePermissions("conversion.read")
  conversions(@CurrentUser() u: AuthUser, @Query() q: PaginationDto) {
    return this.s.conversions(u, q);
  }
  @Post("conversions")
  @RequirePermissions("conversion.manage")
  conversion(@CurrentUser() u: AuthUser, @Body() d: D.CreateConversionDto) {
    return this.s.conversion(u, d);
  }
  @Get("units") @RequirePermissions("unit.read") units(
    @CurrentUser() u: AuthUser,
    @Query() q: PaginationDto,
  ) {
    return this.s.list(u, "unit", q);
  }
  @Post("units") @RequirePermissions("unit.manage") unit(
    @CurrentUser() u: AuthUser,
    @Body() d: D.CreateUnitDto,
  ) {
    return this.s.unit(u, d);
  }
  @Get("ingredient-groups") @RequirePermissions("ingredient.read") groups(
    @CurrentUser() u: AuthUser,
    @Query() q: PaginationDto,
  ) {
    return this.s.list(u, "group", q);
  }
  @Post("ingredient-groups")
  @RequirePermissions("ingredient_group.manage")
  group(@CurrentUser() u: AuthUser, @Body() d: D.CreateIngredientGroupDto) {
    return this.s.group(u, d);
  }
  @Get("ingredients") @RequirePermissions("ingredient.read") ingredients(
    @CurrentUser() u: AuthUser,
    @Query() q: PaginationDto,
  ) {
    return this.s.list(u, "ingredient", q);
  }
  @Post("ingredients") @RequirePermissions("ingredient.manage") ingredient(
    @CurrentUser() u: AuthUser,
    @Body() d: D.CreateIngredientDto,
  ) {
    return this.s.ingredient(u, d);
  }
  @Get("suppliers") @RequirePermissions("supplier.read") suppliers(
    @CurrentUser() u: AuthUser,
    @Query() q: PaginationDto,
  ) {
    return this.s.list(u, "supplier", q);
  }
  @Post("suppliers") @RequirePermissions("supplier.manage") supplier(
    @CurrentUser() u: AuthUser,
    @Body() d: D.CreateSupplierDto,
  ) {
    return this.s.supplier(u, d);
  }
  @Post("supplier-ingredients")
  @RequirePermissions("supplier_ingredient.manage")
  link(@CurrentUser() u: AuthUser, @Body() d: D.LinkSupplierIngredientDto) {
    return this.s.link(u, d);
  }
}
