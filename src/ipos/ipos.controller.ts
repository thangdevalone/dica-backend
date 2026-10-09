import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { RequirePermissions } from "../auth/decorators/permissions.decorator.js";
import { ConfigAudit } from "../common/audit/config-audit.decorator.js";
import { ApiEndpoint } from "../common/swagger/api-endpoint.decorator.js";
import {
  CancelSalesRecordDto,
  CreateAlertRuleDto,
  CreateMappingDto,
  CreateRecipeDto,
  CreateSalesImportDto,
  IposListQueryDto,
  RecalculateVarianceDto,
  RecipeListQueryDto,
  VarianceListQueryDto,
} from "./ipos.dto.js";
import { IposService } from "./ipos.service.js";

@ApiTags("iPOS, định mức và hao hụt")
@ApiBearerAuth()
@Controller()
export class IposController {
  constructor(private readonly service: IposService) {}

  @Post("sales-records/:id/cancel")
  @ApiEndpoint("Ghi nhận hủy dữ liệu bán hàng đã nhập", { audience: "mobile" })
  @RequirePermissions("sales_import.commit")
  cancelSale(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CancelSalesRecordDto,
    @Headers("idempotency-key") key?: string,
  ) {
    return this.service.cancelSale(user, id, dto.reason, key);
  }

  @Get("sales-imports/adapter-status")
  @ApiEndpoint("Kiểm tra trạng thái kết nối bộ chuyển đổi iPOS", {
    adminWeb: true,
  })
  @RequirePermissions("sales_import.read")
  adapterStatus() {
    return this.service.adapterStatus();
  }

  @Get("sales-imports")
  @ApiEndpoint("Xem danh sách đợt nhập dữ liệu bán hàng", { adminWeb: true })
  @RequirePermissions("sales_import.read")
  salesImports(
    @CurrentUser() user: AuthUser,
    @Query() query: IposListQueryDto,
  ) {
    return this.service.salesImports(user, query);
  }

  @Get("menu-item-mappings")
  @ApiEndpoint("Xem ánh xạ món bán sang nguyên liệu", { adminWeb: true })
  @RequirePermissions("ipos_mapping.read")
  mappings(@CurrentUser() user: AuthUser, @Query() query: IposListQueryDto) {
    return this.service.mappings(user, query);
  }

  @Post("menu-item-mappings")
  @ApiEndpoint("Tạo ánh xạ món bán từ iPOS", { adminWeb: true })
  @RequirePermissions("ipos_mapping.manage")
  @ConfigAudit("IPOS_MAPPING_CONFIG")
  createMapping(@CurrentUser() user: AuthUser, @Body() dto: CreateMappingDto) {
    return this.service.createMapping(user, dto);
  }

  @Get("recipes")
  @ApiEndpoint("Xem danh sách định mức nguyên liệu", { adminWeb: true })
  @RequirePermissions("recipe.read")
  recipes(@CurrentUser() user: AuthUser, @Query() query: RecipeListQueryDto) {
    return this.service.recipes(user, query);
  }

  @Post("recipes")
  @ApiEndpoint("Tạo phiên bản định mức nguyên liệu", {
    audience: "admin-web",
  })
  @RequirePermissions("recipe.manage")
  @ConfigAudit("RECIPE_CONFIG")
  createRecipe(@CurrentUser() user: AuthUser, @Body() dto: CreateRecipeDto) {
    return this.service.createRecipe(user, dto);
  }

  @Post("sales-imports")
  @ApiEndpoint("Tạo đợt nhập dữ liệu bán hàng", {
    audience: "admin-web",
  })
  @RequirePermissions("sales_import.create")
  createImport(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSalesImportDto,
  ) {
    return this.service.createImport(user, dto);
  }

  @Post("sales-imports/:id/validate")
  @ApiEndpoint("Kiểm tra dữ liệu của đợt nhập bán hàng", {
    adminWeb: true,
    emptyBody: true,
  })
  @RequirePermissions("sales_import.create")
  validateImport(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.validateImport(user, id);
  }

  @Get("sales-imports/:id/preview")
  @ApiEndpoint("Xem trước kết quả xử lý đợt nhập bán hàng", {
    audience: "admin-web",
  })
  @RequirePermissions("sales_import.read")
  previewImport(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.previewImport(user, id);
  }

  @Post("sales-imports/:id/commit")
  @ApiEndpoint("Chốt đợt nhập và ghi nhận dữ liệu bán hàng", {
    adminWeb: true,
    emptyBody: true,
  })
  @RequirePermissions("sales_import.commit")
  commitImport(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("idempotency-key") key?: string,
  ) {
    return this.service.commitImport(user, id, key);
  }

  @Get("variances")
  @ApiEndpoint("Xem kết quả chênh lệch tiêu hao", { adminWeb: true })
  @RequirePermissions("variance.read")
  variances(
    @CurrentUser() user: AuthUser,
    @Query() query: VarianceListQueryDto,
  ) {
    return this.service.variances(user, query);
  }

  @Post("variances/recalculate")
  @ApiEndpoint("Tính lại chênh lệch tiêu hao cho phiếu kiểm kê", {
    audience: "admin-web",
  })
  @RequirePermissions("variance.recalculate")
  recalculate(
    @CurrentUser() user: AuthUser,
    @Body() dto: RecalculateVarianceDto,
  ) {
    return this.service.recalculate(user, dto);
  }

  @Post("alert-rules")
  @ApiEndpoint("Tạo quy tắc cảnh báo chênh lệch", { adminWeb: true })
  @RequirePermissions("alert_rule.manage")
  @ConfigAudit("ALERT_RULE_CONFIG")
  alertRule(@CurrentUser() user: AuthUser, @Body() dto: CreateAlertRuleDto) {
    return this.service.createAlertRule(user, dto);
  }

  @Get("alert-rules")
  @ApiEndpoint("Xem danh sách quy tắc cảnh báo", { adminWeb: true })
  @RequirePermissions("alert_rule.manage")
  alertRules(@CurrentUser() user: AuthUser, @Query() query: IposListQueryDto) {
    return this.service.alertRules(user, query);
  }
}
