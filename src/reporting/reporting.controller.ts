import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { RequirePermissions } from "../auth/decorators/permissions.decorator.js";
import { ApiEndpoint } from "../common/swagger/api-endpoint.decorator.js";
import { ReportQueryDto, UpdatePaymentDto } from "./reporting.dto.js";
import { ReportingService } from "./reporting.service.js";

@ApiTags("Đối soát và báo cáo")
@ApiBearerAuth()
@Controller()
export class ReportingController {
  constructor(private readonly service: ReportingService) {}

  @Get("orders/:id/payment-tracking")
  @ApiEndpoint("Xem thông tin theo dõi thanh toán của đơn", {
    audience: "admin-web",
  })
  @RequirePermissions("payment_tracking.read")
  payment(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.payment(user, id);
  }

  @Put("orders/:id/payment-tracking")
  @ApiEndpoint("Cập nhật giá trị đã thanh toán của đơn", {
    audience: "admin-web",
  })
  @RequirePermissions("payment_tracking.update")
  updatePayment(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdatePaymentDto,
    @Headers("idempotency-key") key?: string,
  ) {
    return this.service.updatePayment(user, id, dto, key);
  }

  @Get("reports/stock")
  @ApiEndpoint("Xem báo cáo tồn kho", { adminWeb: true })
  @RequirePermissions("report.stock")
  stock(@CurrentUser() user: AuthUser, @Query() query: ReportQueryDto) {
    return this.service.stockReport(user, query);
  }

  @Get("reports/fulfillment")
  @ApiEndpoint("Xem báo cáo mức độ đáp ứng đơn", { adminWeb: true })
  @RequirePermissions("report.fulfillment")
  fulfillment(@CurrentUser() user: AuthUser, @Query() query: ReportQueryDto) {
    return this.service.fulfillmentReport(user, query);
  }

  @Get("reports/damage")
  @ApiEndpoint("Xem báo cáo hàng hỏng", { adminWeb: true })
  @RequirePermissions("report.damage")
  damage(@CurrentUser() user: AuthUser, @Query() query: ReportQueryDto) {
    return this.service.damageReport(user, query);
  }

  @Get("reports/variance")
  @ApiEndpoint("Xem báo cáo chênh lệch định mức", { adminWeb: true })
  @RequirePermissions("report.variance")
  variance(@CurrentUser() user: AuthUser, @Query() query: ReportQueryDto) {
    return this.service.varianceReport(user, query);
  }

  @Get("reports/payment")
  @ApiEndpoint("Xem báo cáo thanh toán", { adminWeb: true })
  @RequirePermissions("report.payment")
  paymentReport(@CurrentUser() user: AuthUser, @Query() query: ReportQueryDto) {
    return this.service.paymentReport(user, query);
  }
}
