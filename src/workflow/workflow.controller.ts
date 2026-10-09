import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { RequirePermissions } from "../auth/decorators/permissions.decorator.js";
import { ApiEndpoint } from "../common/swagger/api-endpoint.decorator.js";
import { PaginationDto } from "../common/dto/pagination.dto.js";
import { WorkflowService } from "./workflow.service.js";
import {
  CreateReturnDto,
  OrderPricesDto,
  PriceRuleDto,
  WorkflowCommandDto,
  WorkflowPolicyDto,
  PurgeParamsDto,
  PurgeDto,
} from "./workflow.dto.js";
import { PurgeService } from "./purge.service.js";

@ApiTags("Quy tắc nghiệp vụ")
@ApiBearerAuth()
@Controller()
export class WorkflowController {
  constructor(
    private readonly service: WorkflowService,
    private readonly purge: PurgeService,
  ) {}
  @Get("permanent-delete/:kind/:id")
  @ApiEndpoint("Xem phạm vi xóa vĩnh viễn", { audience: "admin-web" })
  @RequirePermissions("system.purge")
  purgePreview(@CurrentUser() user: AuthUser, @Param() params: PurgeParamsDto) {
    return this.purge.preview(user, params.kind, params.id);
  }
  @Post("permanent-delete/:kind/:id")
  @ApiEndpoint("Xóa dữ liệu và lịch sử bằng mật khẩu ADMIN", {
    audience: "admin-web",
  })
  @RequirePermissions("system.purge")
  purgeExecute(
    @CurrentUser() user: AuthUser,
    @Param() params: PurgeParamsDto,
    @Body() dto: PurgeDto,
  ) {
    return this.purge.execute(
      user,
      params.kind,
      params.id,
      dto.password,
      dto.preview_hash,
    );
  }
  @Get("workflow-policy")
  @ApiEndpoint("Xem chính sách nghiệp vụ", { audience: "admin-web" })
  @RequirePermissions("workflow_policy.manage")
  policy(@CurrentUser() user: AuthUser) {
    return this.service.policy(user);
  }
  @Put("workflow-policy")
  @ApiEndpoint("Cấu hình chính sách nghiệp vụ", { audience: "admin-web" })
  @RequirePermissions("workflow_policy.manage")
  updatePolicy(@CurrentUser() user: AuthUser, @Body() dto: WorkflowPolicyDto) {
    return this.service.updatePolicy(user, dto);
  }
  @Get("price-rules")
  @ApiEndpoint("Xem giá chuẩn và ngưỡng cảnh báo", { audience: "admin-web" })
  @RequirePermissions("price_rule.manage")
  rules(@CurrentUser() user: AuthUser, @Query() query: PaginationDto) {
    return this.service.rules(user, query);
  }
  @Put("price-rules")
  @ApiEndpoint("Cấu hình giá chuẩn theo đơn vị cơ sở", {
    audience: "admin-web",
  })
  @RequirePermissions("price_rule.manage")
  updateRule(@CurrentUser() user: AuthUser, @Body() dto: PriceRuleDto) {
    return this.service.updateRule(user, dto);
  }
  @Put("orders/:id/prices")
  @ApiEndpoint("Nhập giá và thời hạn thanh toán", { audience: "mobile" })
  @RequirePermissions("price.update")
  prices(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: OrderPricesDto,
    @Headers("idempotency-key") key?: string,
  ) {
    return this.service.prices(user, id, dto, key);
  }
  @Post("orders/:id/payment-confirm")
  @ApiEndpoint("Xác nhận khoản thanh toán do người khác nhập", {
    audience: "mobile",
  })
  @RequirePermissions("payment_tracking.confirm")
  confirm(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: WorkflowCommandDto,
    @Headers("idempotency-key") key?: string,
  ) {
    return this.service.confirmPayment(user, id, dto, key);
  }
  @Get("returns")
  @ApiEndpoint("Danh sách phiếu hoàn hàng", { audience: "mobile" })
  @RequirePermissions("return.read")
  returns(@CurrentUser() user: AuthUser, @Query() query: PaginationDto) {
    return this.service.returns(user, query);
  }
  @Get("returns/:id")
  @ApiEndpoint("Chi tiết phiếu hoàn hàng", { audience: "mobile" })
  @RequirePermissions("return.read")
  returnDetail(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.returnDetail(user, id);
  }
  @Post("returns")
  @ApiEndpoint("Tạo phiếu hoàn về nguồn đã cấp", { audience: "mobile" })
  @RequirePermissions("return.create")
  createReturn(@CurrentUser() user: AuthUser, @Body() dto: CreateReturnDto) {
    return this.service.createReturn(user, dto);
  }
  @Post("returns/:id/submit")
  @ApiEndpoint("Gửi phiếu hoàn kèm ảnh hàng và hóa đơn", { audience: "mobile" })
  @RequirePermissions("return.create")
  submitReturn(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: WorkflowCommandDto,
  ) {
    return this.service.returnCommand(user, id, dto, "SUBMITTED");
  }
  @Post("returns/:id/approve")
  @ApiEndpoint("Duyệt hoàn hàng", { audience: "mobile" })
  @RequirePermissions("return.approve")
  approveReturn(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: WorkflowCommandDto,
  ) {
    return this.service.returnCommand(user, id, dto, "APPROVED");
  }
  @Post("returns/:id/reject")
  @ApiEndpoint("Từ chối hoàn hàng", { audience: "mobile" })
  @RequirePermissions("return.approve")
  rejectReturn(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: WorkflowCommandDto,
  ) {
    return this.service.returnCommand(user, id, dto, "REJECTED");
  }
}
