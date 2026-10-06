import { HttpStatus, Injectable, StreamableFile } from "@nestjs/common";
import type { AuthUser } from "../auth/auth.types.js";
import { ScopeService } from "../auth/scope.service.js";
import { ApiException } from "../common/errors/api.exception.js";
import { ErrorCode } from "../common/errors/error-codes.js";
import { PrismaService } from "../database/prisma.service.js";
import type { AttachmentResourceDto } from "./attachment.dto.js";

interface UploadedImage {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class AttachmentService {
  constructor(
    private readonly db: PrismaService,
    private readonly scope: ScopeService,
  ) {}

  async list(user: AuthUser, query: AttachmentResourceDto) {
    await this.authorize(user, query);
    const data = await this.db.attachment.findMany({
      where: {
        organizationId: user.organizationId,
        resourceType: query.resource_type,
        resourceId: query.resource_id,
      },
      select: {
        id: true,
        resourceType: true,
        resourceId: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return { data, message: "Lấy danh sách ảnh đính kèm thành công." };
  }

  async upload(
    user: AuthUser,
    dto: AttachmentResourceDto,
    file?: UploadedImage,
  ) {
    if (!file)
      throw new ApiException(
        ErrorCode.VALIDATION_ERROR,
        "Thiếu file ảnh đính kèm.",
        HttpStatus.BAD_REQUEST,
      );
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.mimetype))
      throw new ApiException(
        ErrorCode.VALIDATION_ERROR,
        "Chỉ hỗ trợ ảnh JPEG, PNG, WEBP hoặc HEIC/HEIF.",
        HttpStatus.BAD_REQUEST,
      );
    if (file.size > 5 * 1024 * 1024)
      throw new ApiException(
        ErrorCode.VALIDATION_ERROR,
        "Ảnh đính kèm không được vượt quá 5 MB.",
        HttpStatus.BAD_REQUEST,
      );
    await this.authorize(user, dto);
    const data = await this.db.attachment.create({
      data: {
        organizationId: user.organizationId,
        uploadedById: user.id,
        resourceType: dto.resource_type,
        resourceId: dto.resource_id,
        fileName: file.originalname.slice(0, 255),
        mimeType: file.mimetype,
        sizeBytes: file.size,
        content: Uint8Array.from(file.buffer),
      },
      select: {
        id: true,
        resourceType: true,
        resourceId: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
      },
    });
    return { data, message: "Tải ảnh đính kèm thành công." };
  }

  async content(user: AuthUser, id: string) {
    const attachment = await this.db.attachment.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!attachment) this.notFound();
    await this.authorize(user, {
      resource_type: attachment.resourceType as "RECEIPT" | "DAMAGE_REPORT",
      resource_id: attachment.resourceId,
    });
    return {
      file: new StreamableFile(Buffer.from(attachment.content)),
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
    };
  }

  private async authorize(user: AuthUser, resource: AttachmentResourceDto) {
    if (resource.resource_type === "RECEIPT") {
      const receipt = await this.db.receipt.findFirst({
        where: {
          id: resource.resource_id,
          order: { organizationId: user.organizationId },
        },
        include: { order: { include: { destinationStockLocation: true } } },
      });
      if (!receipt) this.notFound();
      this.scope.assertAccess(user, "attachment.upload", {
        facilityId: receipt.order.destinationStockLocation.facilityId,
        stockLocationId: receipt.order.destinationStockLocationId,
      });
      return;
    }
    const report = await this.db.damageReport.findFirst({
      where: {
        id: resource.resource_id,
        stockLocation: { facility: { organizationId: user.organizationId } },
      },
      include: { stockLocation: true },
    });
    if (!report) this.notFound();
    this.scope.assertAccess(user, "attachment.upload", {
      facilityId: report.stockLocation.facilityId,
      stockLocationId: report.stockLocationId,
      createdById: report.createdById,
    });
  }

  private notFound(): never {
    throw new ApiException(
      ErrorCode.RESOURCE_NOT_FOUND,
      "Không tìm thấy ảnh đính kèm hoặc chứng từ.",
      HttpStatus.NOT_FOUND,
    );
  }
}
