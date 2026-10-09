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
import { ApiEndpoint } from "../common/swagger/api-endpoint.decorator.js";
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
  @ApiEndpoint("Xem danh sách phiếu điều chỉnh tồn kho", { mobile: true })
  @RequirePermissions("adjustment.read")
  adjustments(
    @CurrentUser() user: AuthUser,
    @Query() query: AdjustmentListQueryDto,
  ) {
    return this.service.adjustments(user, query);
  }

  @Post("inventory-adjustments")
  @ApiEndpoint("Tạo phiếu điều chỉnh tồn kho", { mobile: true })
  @RequirePermissions("adjustment.create")
  createAdjustment(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAdjustmentDto,
  ) {
    return this.service.createAdjustment(user, dto);
  }

  @Post("inventory-adjustments/:id/approve")
  @ApiEndpoint("Duyệt phiếu điều chỉnh tồn kho", { mobile: true })
  @RequirePermissions("adjustment.approve")
  approveAdjustment(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: VersionDto,
  ) {
    return this.service.approveAdjustment(user, id, dto);
  }

  @Post("inventory-adjustments/:id/post")
  @ApiEndpoint("Ghi sổ phiếu điều chỉnh vào tồn kho", { mobile: true })
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
  @ApiEndpoint("Xem danh sách phiếu kiểm kê", { audience: "mobile" })
  @RequirePermissions("stocktake.read")
  stocktakes(
    @CurrentUser() user: AuthUser,
    @Query() query: StocktakeListQueryDto,
  ) {
    return this.service.stocktakes(user, query);
  }

  @Post("stocktakes")
  @ApiEndpoint("Tạo phiếu kiểm kê", { audience: "mobile" })
  @RequirePermissions("stocktake.create")
  createStocktake(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateStocktakeDto,
  ) {
    return this.service.createStocktake(user, dto);
  }

  @Put("stocktakes/:id")
  @ApiEndpoint("Cập nhật phiếu kiểm kê đang ở bản nháp", {
    audience: "mobile",
  })
  @RequirePermissions("stocktake.update_draft")
  updateStocktake(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateStocktakeDto,
  ) {
    return this.service.updateStocktake(user, id, dto);
  }

  @Post("stocktakes/:id/submit")
  @ApiEndpoint("Gửi phiếu kiểm kê để xử lý", { audience: "mobile" })
  @RequirePermissions("stocktake.submit")
  submitStocktake(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: VersionDto,
  ) {
    return this.service.submitStocktake(user, id, dto);
  }

  @Post("stocktakes/:id/reopen")
  @ApiEndpoint("Mở lại phiếu kiểm kê", { audience: "mobile" })
  @RequirePermissions("stocktake.reopen")
  reopenStocktake(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: VersionDto,
  ) {
    return this.service.reopenStocktake(user, id, dto);
  }

  @Get("damage-reports")
  @ApiEndpoint("Xem danh sách phiếu báo hỏng", { audience: "mobile" })
  @RequirePermissions("damage.read")
  damages(@CurrentUser() user: AuthUser, @Query() query: DamageListQueryDto) {
    return this.service.damages(user, query);
  }

  @Post("damage-reports")
  @ApiEndpoint("Tạo phiếu báo hỏng", { audience: "mobile" })
  @RequirePermissions("damage.create")
  createDamage(@CurrentUser() user: AuthUser, @Body() dto: CreateDamageDto) {
    return this.service.createDamage(user, dto);
  }

  @Put("damage-reports/:id")
  @ApiEndpoint("Cập nhật phiếu báo hỏng đang ở bản nháp", {
    audience: "mobile",
  })
  @RequirePermissions("damage.update_draft")
  updateDamage(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateDamageDto,
  ) {
    return this.service.updateDamage(user, id, dto);
  }

  @Post("damage-reports/:id/submit")
  @ApiEndpoint("Gửi phiếu báo hỏng để xác nhận", { audience: "mobile" })
  @RequirePermissions("damage.submit")
  submitDamage(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: VersionDto,
  ) {
    return this.service.submitDamage(user, id, dto);
  }

  @Post("damage-reports/:id/confirm")
  @ApiEndpoint("Xác nhận và ghi nhận hao hụt do hỏng", { mobile: true })
  @RequirePermissions("damage.confirm")
  confirmDamage(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: VersionDto,
  ) {
    return this.service.confirmDamage(user, id, dto);
  }
}
