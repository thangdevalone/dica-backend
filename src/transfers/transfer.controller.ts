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
import { PaginationDto } from "../common/dto/pagination.dto.js";
import {
  CancelTransferDto,
  CreateTransferDto,
  RejectTransferDto,
  TransferCommandDto,
  UpdateTransferDto,
} from "./transfer.dto.js";
import { TransferService } from "./transfer.service.js";

@ApiTags("Điều chuyển")
@ApiBearerAuth()
@Controller("transfers")
export class TransferController {
  constructor(private readonly service: TransferService) {}

  @Get()
  @RequirePermissions("transfer.read")
  list(@CurrentUser() user: AuthUser, @Query() query: PaginationDto) {
    return this.service.list(user, query);
  }

  @Get(":id")
  @RequirePermissions("transfer.read")
  detail(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.detail(user, id);
  }

  @Post()
  @RequirePermissions("transfer.create")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTransferDto) {
    return this.service.create(user, dto);
  }

  @Put(":id")
  @RequirePermissions("transfer.update_draft")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransferDto,
  ) {
    return this.service.updateDraft(user, id, dto);
  }

  @Post(":id/cancel")
  @RequirePermissions("transfer.cancel")
  cancel(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CancelTransferDto,
  ) {
    return this.service.cancel(user, id, dto);
  }

  @Post(":id/submit")
  @RequirePermissions("transfer.submit")
  submit(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: TransferCommandDto,
  ) {
    return this.service.submit(user, id, dto);
  }

  @Post(":id/approve")
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
  @RequirePermissions("transfer.reject")
  reject(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RejectTransferDto,
  ) {
    return this.service.reject(user, id, dto);
  }
}
