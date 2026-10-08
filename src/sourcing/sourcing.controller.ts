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
import { ConfigAudit } from "../common/audit/config-audit.decorator.js";
import { PaginationDto } from "../common/dto/pagination.dto.js";
import { ApiEndpoint } from "../common/swagger/api-endpoint.decorator.js";
import {
  BulkSourceRuleDto,
  BulkEligibilityDto,
  EligibilityListQueryDto,
  GroupEligibilityListQueryDto,
  SourceRuleListQueryDto,
  UpsertEligibilityDto,
  UpsertGroupEligibilityDto,
  UpsertSourceRuleDto,
} from "./sourcing.dto.js";
import { SourcingService } from "./sourcing.service.js";
@ApiTags("Nguồn cấp")
@ApiBearerAuth()
@ConfigAudit("SOURCING_CONFIG")
@Controller()
export class SourcingController {
  constructor(private s: SourcingService) {}
  @ApiEndpoint("Xem nguyên liệu được phép yêu cầu theo bộ phận", {
    audience: "both",
  })
  @Get("item-eligibility")
  @RequirePermissions("eligibility.read")
  e(@CurrentUser() u: AuthUser, @Query() q: EligibilityListQueryDto) {
    return this.s.eligibility(u, q);
  }
  @ApiEndpoint("Thiết lập quyền yêu cầu nguyên liệu cho bộ phận", {
    adminWeb: true,
  })
  @Post("item-eligibility")
  @RequirePermissions("eligibility.manage")
  ue(@CurrentUser() u: AuthUser, @Body() d: UpsertEligibilityDto) {
    return this.s.upsertEligibility(u, d);
  }
  @ApiEndpoint("Thiết lập hàng loạt quyền yêu cầu nguyên liệu cho bộ phận", {
    adminWeb: true,
  })
  @Post("item-eligibility/bulk-update")
  @RequirePermissions("eligibility.manage")
  be(@CurrentUser() u: AuthUser, @Body() d: BulkEligibilityDto) {
    return this.s.bulkEligibility(u, d);
  }
  @ApiEndpoint("Xem nhóm hàng được phép yêu cầu theo bộ phận", {
    audience: "both",
  })
  @Get("group-eligibility")
  @RequirePermissions("eligibility.read")
  ge(@CurrentUser() u: AuthUser, @Query() q: GroupEligibilityListQueryDto) {
    return this.s.groupEligibility(u, q);
  }
  @ApiEndpoint("Thiết lập quyền yêu cầu theo nhóm hàng cho bộ phận", {
    adminWeb: true,
  })
  @Post("group-eligibility")
  @RequirePermissions("eligibility.manage")
  uge(@CurrentUser() u: AuthUser, @Body() d: UpsertGroupEligibilityDto) {
    return this.s.upsertGroupEligibility(u, d);
  }
  @ApiEndpoint("Xem quy tắc chọn nguồn cấp", { adminWeb: true })
  @Get("source-rules")
  @RequirePermissions("source_rule.read")
  r(@CurrentUser() u: AuthUser, @Query() q: SourceRuleListQueryDto) {
    return this.s.rules(u, q);
  }
  @ApiEndpoint("Xem lịch sử thay đổi quy tắc nguồn cấp", { adminWeb: true })
  @Get("source-rules/:id/history")
  @RequirePermissions("source_rule.read")
  h(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Query() q: PaginationDto,
  ) {
    return this.s.history(u, id, q);
  }
  @ApiEndpoint("Tạo hoặc cập nhật quy tắc nguồn cấp", { adminWeb: true })
  @Post("source-rules")
  @RequirePermissions("source_rule.manage")
  ur(@CurrentUser() u: AuthUser, @Body() d: UpsertSourceRuleDto) {
    return this.s.rule(u, d);
  }
  @Post("source-rules/bulk-update")
  @ApiEndpoint("Cập nhật hàng loạt quy tắc nguồn cấp", { adminWeb: true })
  @RequirePermissions("source_rule.bulk_update")
  b(@CurrentUser() u: AuthUser, @Body() d: BulkSourceRuleDto) {
    return this.s.bulk(u, d);
  }
}
