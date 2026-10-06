import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { RequirePermissions } from "../auth/decorators/permissions.decorator.js";
import { PaginationDto } from "../common/dto/pagination.dto.js";
import { ApiEndpoint } from "../common/swagger/api-endpoint.decorator.js";
import {
  CancelOrderDto,
  CloseOutstandingDto,
  OrderListQueryDto,
} from "./order.dto.js";
import { OrderService } from "./order.service.js";
@ApiTags("Đơn thực hiện")
@ApiBearerAuth()
@Controller()
export class OrderController {
  constructor(private s: OrderService) {}
  @Post("orders/:id/close-outstanding")
  @ApiEndpoint("Đóng phần số lượng còn thiếu của đơn", { adminWeb: true })
  @RequirePermissions("order.close_outstanding")
  closeOutstanding(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: CloseOutstandingDto,
  ) {
    return this.s.closeOutstanding(u, id, d);
  }
  @Post("orders/:id/cancel")
  @ApiEndpoint("Hủy đơn thực hiện", { adminWeb: true })
  @RequirePermissions("order.cancel")
  cancel(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: CancelOrderDto,
  ) {
    return this.s.cancel(u, id, d);
  }
  @ApiEndpoint("Xem danh sách đơn thực hiện", { audience: "both" })
  @Get("orders")
  @RequirePermissions("order.read")
  list(@CurrentUser() u: AuthUser, @Query() q: OrderListQueryDto) {
    return this.s.list(u, q);
  }
  @ApiEndpoint("Xem chi tiết đơn thực hiện", { audience: "both" })
  @Get("orders/:id")
  @RequirePermissions("order.read")
  detail(@CurrentUser() u: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.s.detail(u, id);
  }
  @Get("supplier/orders")
  @ApiEndpoint("Nhà cung cấp xem các đơn được giao", { audience: "future" })
  @RequirePermissions("supplier_order.read_own")
  supplier(@CurrentUser() u: AuthUser, @Query() q: PaginationDto) {
    return this.s.supplierList(u, q);
  }
  @Get("supplier/orders/:id")
  @ApiEndpoint("Nhà cung cấp xem chi tiết đơn được giao", {
    audience: "future",
  })
  @RequirePermissions("supplier_order.read_own")
  supplierDetail(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.s.supplierDetail(u, id);
  }
}
