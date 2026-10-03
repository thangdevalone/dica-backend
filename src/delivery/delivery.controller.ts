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
import {
  CreateDispatchDto,
  CreateReceiptDto,
  DeliveryListQueryDto,
  DiscrepancyListQueryDto,
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
  discrepancies(
    @CurrentUser() u: AuthUser,
    @Query() q: DiscrepancyListQueryDto,
  ) {
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
  @Get("dispatches")
  @RequirePermissions("dispatch.read")
  dispatches(@CurrentUser() u: AuthUser, @Query() q: DeliveryListQueryDto) {
    return this.s.dispatches(u, q);
  }
  @Get("dispatches/:id")
  @RequirePermissions("dispatch.read")
  dispatchDetail(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.s.dispatch(u, id);
  }
  @Get("receipts")
  @RequirePermissions("receipt.read")
  receipts(@CurrentUser() u: AuthUser, @Query() q: DeliveryListQueryDto) {
    return this.s.receipts(u, q);
  }
  @Get("receipts/:id")
  @RequirePermissions("receipt.read")
  receiptDetail(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.s.receipt(u, id);
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
