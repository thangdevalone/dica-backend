import {
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
import { ApiEndpoint } from "../common/swagger/api-endpoint.decorator.js";
import {
  InventoryListQueryDto,
  LedgerListQueryDto,
  NotificationListQueryDto,
} from "./inventory.dto.js";
import { InventoryService } from "./inventory.service.js";
@ApiTags("Tồn kho và thông báo")
@ApiBearerAuth()
@Controller()
export class InventoryController {
  constructor(private s: InventoryService) {}
  @ApiEndpoint("Xem số dư tồn kho hiện tại", { audience: "mobile" })
  @Get("stock-balances")
  @RequirePermissions("stock.read")
  balances(@CurrentUser() u: AuthUser, @Query() q: InventoryListQueryDto) {
    return this.s.balances(u, q);
  }
  @ApiEndpoint("Xem lịch sử bút toán nhập xuất tồn", { audience: "mobile" })
  @Get("stock-ledger")
  @RequirePermissions("stock_ledger.read")
  ledger(@CurrentUser() u: AuthUser, @Query() q: LedgerListQueryDto) {
    return this.s.ledger(u, q);
  }
  @Get("notifications")
  @ApiEndpoint("Xem danh sách thông báo của tài khoản", { audience: "mobile" })
  @RequirePermissions("notification.read_own")
  notifications(
    @CurrentUser() u: AuthUser,
    @Query() q: NotificationListQueryDto,
  ) {
    return this.s.notifications(u, q);
  }

  @Post("notifications/read-all")
  @ApiEndpoint("Đánh dấu toàn bộ thông báo là đã đọc", {
    audience: "mobile",
    emptyBody: true,
  })
  @RequirePermissions("notification.mark_own")
  markAllNotificationsRead(@CurrentUser() u: AuthUser) {
    return this.s.markAllNotificationsRead(u);
  }

  @Get("notifications/:id")
  @ApiEndpoint("Xem chi tiết một thông báo", { audience: "mobile" })
  @RequirePermissions("notification.read_own")
  notification(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.s.notification(u, id);
  }

  @Post("notifications/:id/read")
  @ApiEndpoint("Đánh dấu một thông báo là đã đọc", {
    audience: "mobile",
    emptyBody: true,
  })
  @RequirePermissions("notification.mark_own")
  markNotificationRead(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.s.markNotificationRead(u, id);
  }
}
