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
import {
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

  @Get("sales-imports/adapter-status")
  @RequirePermissions("sales_import.read")
  adapterStatus() {
    return this.service.adapterStatus();
  }

  @Get("sales-imports")
  @RequirePermissions("sales_import.read")
  salesImports(
    @CurrentUser() user: AuthUser,
    @Query() query: IposListQueryDto,
  ) {
    return this.service.salesImports(user, query);
  }

  @Get("menu-item-mappings")
  @RequirePermissions("ipos_mapping.read")
  mappings(@CurrentUser() user: AuthUser, @Query() query: IposListQueryDto) {
    return this.service.mappings(user, query);
  }

  @Post("menu-item-mappings")
  @RequirePermissions("ipos_mapping.manage")
  @ConfigAudit("IPOS_MAPPING_CONFIG")
  createMapping(@CurrentUser() user: AuthUser, @Body() dto: CreateMappingDto) {
    return this.service.createMapping(user, dto);
  }

  @Get("recipes")
  @RequirePermissions("recipe.read")
  recipes(@CurrentUser() user: AuthUser, @Query() query: RecipeListQueryDto) {
    return this.service.recipes(user, query);
  }

  @Post("recipes")
  @RequirePermissions("recipe.manage")
  @ConfigAudit("RECIPE_CONFIG")
  createRecipe(@CurrentUser() user: AuthUser, @Body() dto: CreateRecipeDto) {
    return this.service.createRecipe(user, dto);
  }

  @Post("sales-imports")
  @RequirePermissions("sales_import.create")
  createImport(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSalesImportDto,
  ) {
    return this.service.createImport(user, dto);
  }

  @Post("sales-imports/:id/validate")
  @RequirePermissions("sales_import.create")
  validateImport(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.validateImport(user, id);
  }

  @Get("sales-imports/:id/preview")
  @RequirePermissions("sales_import.read")
  previewImport(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.previewImport(user, id);
  }

  @Post("sales-imports/:id/commit")
  @RequirePermissions("sales_import.commit")
  commitImport(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("idempotency-key") key?: string,
  ) {
    return this.service.commitImport(user, id, key);
  }

  @Get("variances")
  @RequirePermissions("variance.read")
  variances(
    @CurrentUser() user: AuthUser,
    @Query() query: VarianceListQueryDto,
  ) {
    return this.service.variances(user, query);
  }

  @Post("variances/recalculate")
  @RequirePermissions("variance.recalculate")
  recalculate(
    @CurrentUser() user: AuthUser,
    @Body() dto: RecalculateVarianceDto,
  ) {
    return this.service.recalculate(user, dto);
  }

  @Post("alert-rules")
  @RequirePermissions("alert_rule.manage")
  @ConfigAudit("ALERT_RULE_CONFIG")
  alertRule(@CurrentUser() user: AuthUser, @Body() dto: CreateAlertRuleDto) {
    return this.service.createAlertRule(user, dto);
  }

  @Get("alert-rules")
  @RequirePermissions("alert_rule.manage")
  alertRules(@CurrentUser() user: AuthUser, @Query() query: IposListQueryDto) {
    return this.service.alertRules(user, query);
  }
}
