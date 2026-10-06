import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { RequirePermissions } from "../auth/decorators/permissions.decorator.js";
import { ApiEndpoint } from "../common/swagger/api-endpoint.decorator.js";
import { DashboardQueryDto } from "./dashboard.dto.js";
import { DashboardService } from "./dashboard.service.js";

@ApiTags("Tổng quan")
@ApiBearerAuth()
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  /**
   * Ngoài `dashboard.read`, từng khối số liệu tự kiểm tra quyền đọc tương
   * ứng và trả `null` nếu người dùng không có quyền.
   */
  @Get("summary")
  @ApiEndpoint("Lấy các chỉ số và cảnh báo tổng quan", { adminWeb: true })
  @RequirePermissions("dashboard.read")
  summary(@CurrentUser() user: AuthUser, @Query() query: DashboardQueryDto) {
    return this.service.summary(user, query);
  }
}
