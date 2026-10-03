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
import { CancelOrderDto, CloseOutstandingDto } from "./order.dto.js";
import { OrderService } from "./order.service.js";
@ApiTags("Đơn thực hiện")
@ApiBearerAuth()
@Controller()
export class OrderController {
  constructor(private s: OrderService) {}
  @Post("orders/:id/close-outstanding")
  @RequirePermissions("order.close_outstanding")
  closeOutstanding(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: CloseOutstandingDto,
  ) {
    return this.s.closeOutstanding(u, id, d);
  }
  @Post("orders/:id/cancel")
  @RequirePermissions("order.cancel")
  cancel(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: CancelOrderDto,
  ) {
    return this.s.cancel(u, id, d);
  }
  @Get("orders") @RequirePermissions("order.read") list(
    @CurrentUser() u: AuthUser,
    @Query() q: PaginationDto,
  ) {
    return this.s.list(u, q);
  }
  @Get("orders/:id") @RequirePermissions("order.read") detail(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.s.detail(u, id);
  }
  @Get("supplier/orders")
  @RequirePermissions("supplier_order.read_own")
  supplier(@CurrentUser() u: AuthUser, @Query() q: PaginationDto) {
    return this.s.supplierList(u, q);
  }
  @Get("supplier/orders/:id")
  @RequirePermissions("supplier_order.read_own")
  supplierDetail(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.s.supplierDetail(u, id);
  }
}
