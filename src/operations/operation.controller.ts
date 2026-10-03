import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Put,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { RequirePermissions } from "../auth/decorators/permissions.decorator.js";
import {
  AdjustmentListQueryDto,
  CreateAdjustmentDto,
  CreateDamageDto,
  CreateStocktakeDto,
  DamageListQueryDto,
  StocktakeListQueryDto,
  UpdateDamageDto,
  UpdateStocktakeDto,
  VersionDto,
} from "./operation.dto.js";
import { OperationService } from "./operation.service.js";

@ApiTags("Kiểm kê và báo hỏng")
@ApiBearerAuth()
@Controller()
export class OperationController {
  constructor(private readonly service: OperationService) {}

  @Get("inventory-adjustments")
  @RequirePermissions("adjustment.read")
  adjustments(
    @CurrentUser() user: AuthUser,
    @Query() query: AdjustmentListQueryDto,
  ) {
    return this.service.adjustments(user, query);
  }

  @Post("inventory-adjustments")
  @RequirePermissions("adjustment.create")
  createAdjustment(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAdjustmentDto,
  ) {
    return this.service.createAdjustment(user, dto);
  }

  @Post("inventory-adjustments/:id/approve")
  @RequirePermissions("adjustment.approve")
  approveAdjustment(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: VersionDto,
  ) {
    return this.service.approveAdjustment(user, id, dto);
  }

  @Post("inventory-adjustments/:id/post")
  @RequirePermissions("adjustment.post")
  postAdjustment(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: VersionDto,
    @Headers("idempotency-key") key?: string,
  ) {
    return this.service.postAdjustment(user, id, dto, key);
  }

  @Get("stocktakes")
  @RequirePermissions("stocktake.read")
  stocktakes(
    @CurrentUser() user: AuthUser,
    @Query() query: StocktakeListQueryDto,
  ) {
    return this.service.stocktakes(user, query);
  }

  @Post("stocktakes")
  @RequirePermissions("stocktake.create")
  createStocktake(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateStocktakeDto,
  ) {
    return this.service.createStocktake(user, dto);
  }

  @Put("stocktakes/:id")
  @RequirePermissions("stocktake.update_draft")
  updateStocktake(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateStocktakeDto,
  ) {
    return this.service.updateStocktake(user, id, dto);
  }

  @Post("stocktakes/:id/submit")
  @RequirePermissions("stocktake.submit")
  submitStocktake(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: VersionDto,
  ) {
    return this.service.submitStocktake(user, id, dto);
  }

  @Post("stocktakes/:id/reopen")
  @RequirePermissions("stocktake.reopen")
  reopenStocktake(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: VersionDto,
  ) {
    return this.service.reopenStocktake(user, id, dto);
  }

  @Get("damage-reports")
  @RequirePermissions("damage.read")
  damages(@CurrentUser() user: AuthUser, @Query() query: DamageListQueryDto) {
    return this.service.damages(user, query);
  }

  @Post("damage-reports")
  @RequirePermissions("damage.create")
  createDamage(@CurrentUser() user: AuthUser, @Body() dto: CreateDamageDto) {
    return this.service.createDamage(user, dto);
  }

  @Put("damage-reports/:id")
  @RequirePermissions("damage.update_draft")
  updateDamage(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateDamageDto,
  ) {
    return this.service.updateDamage(user, id, dto);
  }

  @Post("damage-reports/:id/submit")
  @RequirePermissions("damage.submit")
  submitDamage(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: VersionDto,
  ) {
    return this.service.submitDamage(user, id, dto);
  }

  @Post("damage-reports/:id/confirm")
  @RequirePermissions("damage.confirm")
  confirmDamage(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: VersionDto,
  ) {
    return this.service.confirmDamage(user, id, dto);
  }
}
