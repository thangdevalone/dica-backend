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
import { PaginationDto } from "../common/dto/pagination.dto.js";
import { InventoryService } from "./inventory.service.js";
@ApiTags("Tồn kho và thông báo")
@ApiBearerAuth()
@Controller()
export class InventoryController {
  constructor(private s: InventoryService) {}
  @Get("stock-balances") @RequirePermissions("stock.read") balances(
    @CurrentUser() u: AuthUser,
    @Query() q: PaginationDto,
  ) {
    return this.s.balances(u, q);
  }
  @Get("stock-ledger") @RequirePermissions("stock_ledger.read") ledger(
    @CurrentUser() u: AuthUser,
    @Query() q: PaginationDto,
  ) {
    return this.s.ledger(u, q);
  }
  @Get("notifications")
  @RequirePermissions("notification.read_own")
  notifications(@CurrentUser() u: AuthUser, @Query() q: PaginationDto) {
    return this.s.notifications(u, q);
  }

  @Get("notifications/:id")
  @RequirePermissions("notification.read_own")
  notification(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.s.notification(u, id);
  }

  @Post("notifications/:id/read")
  @RequirePermissions("notification.mark_own")
  markNotificationRead(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.s.markNotificationRead(u, id);
  }
}
