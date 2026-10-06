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
import { ApiEndpoint } from "../common/swagger/api-endpoint.decorator.js";
import * as D from "./catalog.dto.js";
import { CatalogService } from "./catalog.service.js";
@ApiTags("Danh mục")
@ApiBearerAuth()
@ConfigAudit("CATALOG_CONFIG")
@Controller()
export class CatalogController {
  constructor(private s: CatalogService) {}
  @Get("conversions")
  @ApiEndpoint("Xem hệ số quy đổi đơn vị", { audience: "both" })
  @RequirePermissions("conversion.read")
  conversions(@CurrentUser() u: AuthUser, @Query() q: PaginationDto) {
    return this.s.conversions(u, q);
  }
  @Post("conversions")
  @ApiEndpoint("Tạo hệ số quy đổi đơn vị", { adminWeb: true })
  @RequirePermissions("conversion.manage")
  conversion(@CurrentUser() u: AuthUser, @Body() d: D.CreateConversionDto) {
    return this.s.conversion(u, d);
  }
  @ApiEndpoint("Xem danh sách đơn vị tính", { audience: "both" })
  @Get("units")
  @RequirePermissions("unit.read")
  units(@CurrentUser() u: AuthUser, @Query() q: PaginationDto) {
    return this.s.list(u, "unit", q);
  }
  @ApiEndpoint("Tạo đơn vị tính", { adminWeb: true })
  @Post("units")
  @RequirePermissions("unit.manage")
  unit(@CurrentUser() u: AuthUser, @Body() d: D.CreateUnitDto) {
    return this.s.unit(u, d);
  }
  @ApiEndpoint("Xem danh sách nhóm nguyên liệu", { audience: "both" })
  @Get("ingredient-groups")
  @RequirePermissions("ingredient.read")
  groups(@CurrentUser() u: AuthUser, @Query() q: PaginationDto) {
    return this.s.list(u, "group", q);
  }
  @Post("ingredient-groups")
  @ApiEndpoint("Tạo nhóm nguyên liệu", { adminWeb: true })
  @RequirePermissions("ingredient_group.manage")
  group(@CurrentUser() u: AuthUser, @Body() d: D.CreateIngredientGroupDto) {
    return this.s.group(u, d);
  }
  @ApiEndpoint("Xem danh sách nguyên liệu", { audience: "both" })
  @Get("ingredients")
  @RequirePermissions("ingredient.read")
  ingredients(@CurrentUser() u: AuthUser, @Query() q: PaginationDto) {
    return this.s.list(u, "ingredient", q);
  }
  @ApiEndpoint("Tạo nguyên liệu", { adminWeb: true })
  @Post("ingredients")
  @RequirePermissions("ingredient.manage")
  ingredient(@CurrentUser() u: AuthUser, @Body() d: D.CreateIngredientDto) {
    return this.s.ingredient(u, d);
  }
  @ApiEndpoint("Xem danh sách nhà cung cấp", { audience: "both" })
  @Get("suppliers")
  @RequirePermissions("supplier.read")
  suppliers(@CurrentUser() u: AuthUser, @Query() q: PaginationDto) {
    return this.s.list(u, "supplier", q);
  }
  @ApiEndpoint("Tạo nhà cung cấp", { adminWeb: true })
  @Post("suppliers")
  @RequirePermissions("supplier.manage")
  supplier(@CurrentUser() u: AuthUser, @Body() d: D.CreateSupplierDto) {
    return this.s.supplier(u, d);
  }
  @Post("supplier-ingredients")
  @ApiEndpoint("Liên kết nguyên liệu với nhà cung cấp", { adminWeb: true })
  @RequirePermissions("supplier_ingredient.manage")
  link(@CurrentUser() u: AuthUser, @Body() d: D.LinkSupplierIngredientDto) {
    return this.s.link(u, d);
  }
  @Get("supplier-ingredients")
  @ApiEndpoint("Xem liên kết nguyên liệu - nhà cung cấp", {
    audience: "both",
  })
  @RequirePermissions("supplier_ingredient.read")
  supplierIngredients(
    @CurrentUser() u: AuthUser,
    @Query() q: D.SupplierIngredientQueryDto,
  ) {
    return this.s.supplierIngredients(u, q);
  }
  @Patch("supplier-ingredients/:id")
  @ApiEndpoint("Cập nhật liên kết nguyên liệu - nhà cung cấp", {
    adminWeb: true,
  })
  @RequirePermissions("supplier_ingredient.manage")
  updateSupplierIngredient(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: D.UpdateSupplierIngredientDto,
  ) {
    return this.s.updateSupplierIngredient(u, id, d);
  }
  @Patch("units/:id")
  @ApiEndpoint("Cập nhật đơn vị tính", { adminWeb: true })
  @RequirePermissions("unit.manage")
  updateUnit(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: D.UpdateUnitDto,
  ) {
    return this.s.updateUnit(u, id, d);
  }
  @Patch("ingredient-groups/:id")
  @ApiEndpoint("Cập nhật nhóm nguyên liệu", { adminWeb: true })
  @RequirePermissions("ingredient_group.manage")
  updateGroup(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: D.UpdateIngredientGroupDto,
  ) {
    return this.s.updateGroup(u, id, d);
  }
  @Patch("ingredients/:id")
  @ApiEndpoint("Cập nhật nguyên liệu", { adminWeb: true })
  @RequirePermissions("ingredient.manage")
  updateIngredient(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: D.UpdateIngredientDto,
  ) {
    return this.s.updateIngredient(u, id, d);
  }
  @Patch("suppliers/:id")
  @ApiEndpoint("Cập nhật nhà cung cấp", { adminWeb: true })
  @RequirePermissions("supplier.manage")
  updateSupplier(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: D.UpdateSupplierDto,
  ) {
    return this.s.updateSupplier(u, id, d);
  }
}
