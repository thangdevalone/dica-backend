import {
  Body,
  Controller,
  Get,
  Headers,
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
import {
  CreateDispatchDto,
  CreateReceiptDto,
  PostDocumentDto,
  ResolveDiscrepancyDto,
} from "./delivery.dto.js";
import { DeliveryService } from "./delivery.service.js";
@ApiTags("Giao nhận")
@ApiBearerAuth()
@Controller()
export class DeliveryController {
  constructor(private s: DeliveryService) {}
  @Get("discrepancies")
  @RequirePermissions("discrepancy.read")
  discrepancies(@CurrentUser() u: AuthUser, @Query() q: PaginationDto) {
    return this.s.discrepancies(u, q);
  }
  @Post("discrepancies/:id/resolve")
  @RequirePermissions("discrepancy.resolve")
  resolveDiscrepancy(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: ResolveDiscrepancyDto,
  ) {
    return this.s.resolveDiscrepancy(u, id, d);
  }
  @Post("dispatches") @RequirePermissions("dispatch.create") dispatch(
    @CurrentUser() u: AuthUser,
    @Body() d: CreateDispatchDto,
  ) {
    return this.s.createDispatch(u, d);
  }
  @Post("dispatches/:id/post") @RequirePermissions("dispatch.post") postD(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: PostDocumentDto,
    @Headers("idempotency-key") k?: string,
  ) {
    return this.s.postDispatch(u, id, d, k);
  }
  @Post("receipts") @RequirePermissions("receipt.create") receipt(
    @CurrentUser() u: AuthUser,
    @Body() d: CreateReceiptDto,
  ) {
    return this.s.createReceipt(u, d);
  }
  @Post("receipts/:id/post") @RequirePermissions("receipt.post") postR(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: PostDocumentDto,
    @Headers("idempotency-key") k?: string,
  ) {
    return this.s.postReceipt(u, id, d, k);
  }
}
