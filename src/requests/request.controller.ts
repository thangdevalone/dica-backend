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
import { ApiEndpoint } from "../common/swagger/api-endpoint.decorator.js";
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
  @ApiEndpoint("Xem danh sách yêu cầu hàng", { audience: "mobile" })
  @Get()
  @RequirePermissions("request.read")
  list(@CurrentUser() u: AuthUser, @Query() q: RequestListQueryDto) {
    return this.s.list(u, q);
  }
  @ApiEndpoint("Xem chi tiết yêu cầu hàng", { audience: "mobile" })
  @Get(":id")
  @RequirePermissions("request.read")
  detail(@CurrentUser() u: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.s.detail(u, id);
  }
  @ApiEndpoint("Tạo yêu cầu hàng", { audience: "mobile" })
  @Post()
  @RequirePermissions("request.create")
  create(@CurrentUser() u: AuthUser, @Body() d: CreateRequestDto) {
    return this.s.create(u, d);
  }
  @Put(":id")
  @ApiEndpoint("Cập nhật yêu cầu hàng đang ở bản nháp", {
    audience: "mobile",
  })
  @RequirePermissions("request.update_draft")
  update(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: UpdateRequestDto,
  ) {
    return this.s.updateDraft(u, id, d);
  }
  @Post(":id/revise")
  @ApiEndpoint("API cũ không còn hỗ trợ; tạo phiếu mới bằng POST /requests", {
    audience: "mobile",
  })
  @RequirePermissions("request.revise")
  revise(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: UpdateRequestDto,
  ) {
    return this.s.revise(u, id, d);
  }
  @Post(":id/cancel")
  @ApiEndpoint("Hủy yêu cầu hàng", { audience: "mobile" })
  @RequirePermissions("request.cancel")
  cancel(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: CancelRequestDto,
  ) {
    return this.s.cancel(u, id, d);
  }
  @Post(":id/refresh-routing")
  @ApiEndpoint("Tính lại nguồn cấp cho yêu cầu hàng", { audience: "mobile" })
  @RequirePermissions("request.update_draft")
  refreshRouting(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: VersionCommandDto,
  ) {
    return this.s.refreshRouting(u, id, d);
  }
  @ApiEndpoint("Gửi yêu cầu hàng để duyệt", { audience: "mobile" })
  @Post(":id/submit")
  @RequirePermissions("request.submit")
  submit(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: VersionCommandDto,
  ) {
    return this.s.submit(u, id, d);
  }
  @ApiEndpoint("Duyệt yêu cầu và sinh đơn thực hiện", {
    audience: "mobile",
  })
  @Post(":id/approve")
  @RequirePermissions("request.approve")
  approve(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: VersionCommandDto,
    @Headers("idempotency-key") k?: string,
  ) {
    return this.s.approve(u, id, d, k);
  }
  @ApiEndpoint("Từ chối yêu cầu hàng", { audience: "mobile" })
  @Post(":id/reject")
  @RequirePermissions("request.reject")
  reject(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: RejectRequestDto,
  ) {
    return this.s.reject(u, id, d);
  }
}
