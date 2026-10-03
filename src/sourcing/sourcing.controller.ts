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
import {
  BulkSourceRuleDto,
  EligibilityListQueryDto,
  SourceRuleListQueryDto,
  UpsertEligibilityDto,
  UpsertSourceRuleDto,
} from "./sourcing.dto.js";
import { SourcingService } from "./sourcing.service.js";
@ApiTags("Nguồn cấp")
@ApiBearerAuth()
@ConfigAudit("SOURCING_CONFIG")
@Controller()
export class SourcingController {
  constructor(private s: SourcingService) {}
  @Get("item-eligibility") @RequirePermissions("eligibility.read") e(
    @CurrentUser() u: AuthUser,
    @Query() q: EligibilityListQueryDto,
  ) {
    return this.s.eligibility(u, q);
  }
  @Post("item-eligibility") @RequirePermissions("eligibility.manage") ue(
    @CurrentUser() u: AuthUser,
    @Body() d: UpsertEligibilityDto,
  ) {
    return this.s.upsertEligibility(u, d);
  }
  @Get("source-rules") @RequirePermissions("source_rule.read") r(
    @CurrentUser() u: AuthUser,
    @Query() q: SourceRuleListQueryDto,
  ) {
    return this.s.rules(u, q);
  }
  @Get("source-rules/:id/history") @RequirePermissions("source_rule.read") h(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Query() q: PaginationDto,
  ) {
    return this.s.history(u, id, q);
  }
  @Post("source-rules") @RequirePermissions("source_rule.manage") ur(
    @CurrentUser() u: AuthUser,
    @Body() d: UpsertSourceRuleDto,
  ) {
    return this.s.rule(u, d);
  }
  @Post("source-rules/bulk-update")
  @RequirePermissions("source_rule.bulk_update")
  b(@CurrentUser() u: AuthUser, @Body() d: BulkSourceRuleDto) {
    return this.s.bulk(u, d);
  }
}
