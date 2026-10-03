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
import {
  CancelRequestDto,
  CreateRequestDto,
  RejectRequestDto,
  RequestListQueryDto,
  UpdateRequestDto,
  VersionCommandDto,
} from "./request.dto.js";
import { RequestService } from "./request.service.js";
@ApiTags("Yêu cầu hàng")
@ApiBearerAuth()
@Controller("requests")
export class RequestController {
  constructor(private s: RequestService) {}
  @Get() @RequirePermissions("request.read") list(
    @CurrentUser() u: AuthUser,
    @Query() q: RequestListQueryDto,
  ) {
    return this.s.list(u, q);
  }
  @Get(":id") @RequirePermissions("request.read") detail(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.s.detail(u, id);
  }
  @Post() @RequirePermissions("request.create") create(
    @CurrentUser() u: AuthUser,
    @Body() d: CreateRequestDto,
  ) {
    return this.s.create(u, d);
  }
  @Put(":id")
  @RequirePermissions("request.update_draft")
  update(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: UpdateRequestDto,
  ) {
    return this.s.updateDraft(u, id, d);
  }
  @Post(":id/revise")
  @RequirePermissions("request.revise")
  revise(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: UpdateRequestDto,
  ) {
    return this.s.revise(u, id, d);
  }
  @Post(":id/cancel")
  @RequirePermissions("request.cancel")
  cancel(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: CancelRequestDto,
  ) {
    return this.s.cancel(u, id, d);
  }
  @Post(":id/refresh-routing")
  @RequirePermissions("request.update_draft")
  refreshRouting(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: VersionCommandDto,
  ) {
    return this.s.refreshRouting(u, id, d);
  }
  @Post(":id/submit") @RequirePermissions("request.submit") submit(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: VersionCommandDto,
  ) {
    return this.s.submit(u, id, d);
  }
  @Post(":id/approve") @RequirePermissions("request.approve") approve(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: VersionCommandDto,
    @Headers("idempotency-key") k?: string,
  ) {
    return this.s.approve(u, id, d, k);
  }
  @Post(":id/reject") @RequirePermissions("request.reject") reject(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: RejectRequestDto,
  ) {
    return this.s.reject(u, id, d);
  }
}
