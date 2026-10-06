import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Put,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { RequirePermissions } from "../auth/decorators/permissions.decorator.js";
import { ApiEndpoint } from "../common/swagger/api-endpoint.decorator.js";
import {
  CancelTransferDto,
  CreateTransferDto,
  RejectTransferDto,
  TransferCommandDto,
  TransferListQueryDto,
  UpdateTransferDto,
} from "./transfer.dto.js";
import { TransferService } from "./transfer.service.js";

@ApiTags("Điều chuyển")
@ApiBearerAuth()
@Controller("transfers")
export class TransferController {
  constructor(private readonly service: TransferService) {}

  @Get()
  @ApiEndpoint("Xem danh sách phiếu điều chuyển", { audience: "both" })
  @RequirePermissions("transfer.read")
  list(@CurrentUser() user: AuthUser, @Query() query: TransferListQueryDto) {
    return this.service.list(user, query);
  }

  @Get(":id")
  @ApiEndpoint("Xem chi tiết phiếu điều chuyển", { audience: "both" })
  @RequirePermissions("transfer.read")
  detail(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.detail(user, id);
  }

  @Post()
  @ApiEndpoint("Tạo phiếu điều chuyển", { audience: "both" })
  @RequirePermissions("transfer.create")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTransferDto) {
    return this.service.create(user, dto);
  }

  @Put(":id")
  @ApiEndpoint("Cập nhật phiếu điều chuyển đang ở bản nháp", {
    audience: "both",
  })
  @RequirePermissions("transfer.update_draft")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransferDto,
  ) {
    return this.service.updateDraft(user, id, dto);
  }

  @Post(":id/cancel")
  @ApiEndpoint("Hủy phiếu điều chuyển", { audience: "both" })
  @RequirePermissions("transfer.cancel")
  cancel(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CancelTransferDto,
  ) {
    return this.service.cancel(user, id, dto);
  }

  @Post(":id/submit")
  @ApiEndpoint("Gửi phiếu điều chuyển để duyệt", { audience: "both" })
  @RequirePermissions("transfer.submit")
  submit(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: TransferCommandDto,
  ) {
    return this.service.submit(user, id, dto);
  }

  @Post(":id/approve")
  @ApiEndpoint("Duyệt và ghi nhận phiếu điều chuyển", {
    audience: "admin-web",
  })
  @RequirePermissions("transfer.approve")
  approve(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: TransferCommandDto,
    @Headers("idempotency-key") key?: string,
  ) {
    return this.service.approve(user, id, dto, key);
  }

  @Post(":id/reject")
  @ApiEndpoint("Từ chối phiếu điều chuyển", { audience: "admin-web" })
  @RequirePermissions("transfer.reject")
  reject(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RejectTransferDto,
  ) {
    return this.service.reject(user, id, dto);
  }
}
