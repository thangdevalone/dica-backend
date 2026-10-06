import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { RequirePermissions } from "../auth/decorators/permissions.decorator.js";
import { ApiEndpoint } from "../common/swagger/api-endpoint.decorator.js";
import { AuditQueryDto } from "./audit.dto.js";
import { SystemService } from "./system.service.js";

@ApiTags("Audit và hệ thống")
@ApiBearerAuth()
@Controller()
export class SystemController {
  constructor(private readonly service: SystemService) {}

  @Get("audit-events")
  @ApiEndpoint("Xem nhật ký thao tác và thay đổi hệ thống", { adminWeb: true })
  @RequirePermissions("audit.read")
  audits(@CurrentUser() user: AuthUser, @Query() query: AuditQueryDto) {
    return this.service.audits(user, query);
  }
}
