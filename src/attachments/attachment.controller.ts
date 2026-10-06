import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import type { AuthUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { RequirePermissions } from "../auth/decorators/permissions.decorator.js";
import { ApiEndpoint } from "../common/swagger/api-endpoint.decorator.js";
import { AttachmentResourceDto } from "./attachment.dto.js";
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

  @Post()
  @ApiEndpoint("Tải ảnh xác nhận cho phiếu nhận hàng hoặc báo hỏng", {
    audience: "mobile",
  })
  @RequirePermissions("attachment.upload")
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["resource_type", "resource_id", "file"],
      properties: {
        resource_type: { type: "string", enum: ["RECEIPT", "DAMAGE_REPORT"] },
        resource_id: { type: "string", format: "uuid" },
        file: { type: "string", format: "binary" },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  upload(
    @CurrentUser() user: AuthUser,
    @Body() dto: AttachmentResourceDto,
    @UploadedFile()
    file?: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
  ) {
    return this.service.upload(user, dto, file);
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
    response.setHeader(
      "Content-Disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
    );
    return result.file;
  }
}
