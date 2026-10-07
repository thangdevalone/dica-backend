import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import type { AuthUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { RequirePermissions } from "../auth/decorators/permissions.decorator.js";
import { ApiEndpoint } from "../common/swagger/api-endpoint.decorator.js";
import {
  AttachmentResourceDto,
  AttachmentUploadInitDto,
} from "./attachment.dto.js";
import { AttachmentService } from "./attachment.service.js";

@ApiTags("Ảnh đính kèm")
@ApiBearerAuth()
@Controller("attachments")
export class AttachmentController {
  constructor(private readonly service: AttachmentService) {}

  @Get()
  @ApiEndpoint("Xem ảnh đính kèm của phiếu nhận hàng hoặc báo hỏng", {
    audience: "both",
  })
  @RequirePermissions("attachment.upload")
  list(@CurrentUser() user: AuthUser, @Query() query: AttachmentResourceDto) {
    return this.service.list(user, query);
  }

  @Post("upload-init")
  @ApiEndpoint("Khởi tạo URL để mobile tải ảnh trực tiếp lên R2", {
    audience: "mobile",
  })
  @RequirePermissions("attachment.upload")
  createUpload(
    @CurrentUser() user: AuthUser,
    @Body() dto: AttachmentUploadInitDto,
  ) {
    return this.service.createUpload(user, dto);
  }

  @Post(":id/finalize")
  @ApiEndpoint("Xác nhận ảnh đã được mobile tải trực tiếp lên R2", {
    audience: "mobile",
    emptyBody: true,
  })
  @RequirePermissions("attachment.upload")
  finalizeUpload(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.finalizeUpload(user, id);
  }

  @Get(":id/view-url")
  @ApiEndpoint("Cấp URL ngắn hạn để xem ảnh trực tiếp từ R2", {
    audience: "both",
  })
  @RequirePermissions("attachment.upload")
  viewUrl(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.viewUrl(user, id);
  }

  @Get(":id/content")
  @ApiEndpoint("Tải nội dung ảnh đính kèm", { audience: "both" })
  @RequirePermissions("attachment.upload")
  async content(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.service.content(user, id);
    response.setHeader("Content-Type", result.mimeType);
    response.setHeader("Content-Length", result.sizeBytes);
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader(
      "Content-Disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
    );
    return result.file;
  }
}
