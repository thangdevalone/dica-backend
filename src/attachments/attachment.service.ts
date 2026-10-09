import { HttpStatus, Injectable, Logger, StreamableFile } from "@nestjs/common";
import { fileTypeFromBuffer } from "file-type";
import { randomUUID } from "node:crypto";
import type { AuthUser } from "../auth/auth.types.js";
import { ScopeService } from "../auth/scope.service.js";
import { ApiException } from "../common/errors/api.exception.js";
import { ErrorCode } from "../common/errors/error-codes.js";
import { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../database/prisma.service.js";
import {
  ATTACHMENT_CONTENT_TYPES,
  type AttachmentResourceDto,
  type AttachmentUploadInitDto,
} from "./attachment.dto.js";
import { R2StorageService } from "./r2-storage.service.js";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set<string>(ATTACHMENT_CONTENT_TYPES);
const EXTENSIONS: Record<(typeof ATTACHMENT_CONTENT_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

@Injectable()
export class AttachmentService {
  private readonly logger = new Logger(AttachmentService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly scope: ScopeService,
    private readonly storage: R2StorageService,
  ) {}

  async list(user: AuthUser, query: AttachmentResourceDto) {
    await this.authorize(user, query);
    const attachments = await this.db.attachment.findMany({
      where: {
        organizationId: user.organizationId,
        resourceType: query.resource_type,
        resourceId: query.resource_id,
        uploadStatus: "READY",
      },
      select: {
        id: true,
        resourceType: true,
        resourceId: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        objectKey: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    const data = attachments.map(({ objectKey, ...attachment }) => ({
      ...attachment,
      viewUrl: `/api/v1/attachments/${attachment.id}/content`,
    }));
    return { data, message: "Lấy danh sách ảnh đính kèm thành công." };
  }

  async createUpload(user: AuthUser, dto: AttachmentUploadInitDto) {
    if (
      !ALLOWED_IMAGE_TYPES.has(dto.content_type) ||
      dto.size_bytes < 1 ||
      dto.size_bytes > MAX_FILE_SIZE ||
      !dto.file_name.trim()
    )
      throw new ApiException(
        ErrorCode.VALIDATION_ERROR,
        "Thông tin file tải lên không hợp lệ.",
        HttpStatus.BAD_REQUEST,
      );

    await this.authorize(user, dto);
    const id = randomUUID();
    const extension = EXTENSIONS[dto.content_type];
    const objectKey = `attachments/${user.organizationId}/${id}.${extension}`;
    const signed = await this.storage.createUploadUrl(
      objectKey,
      dto.content_type,
      dto.size_bytes,
    );

    const attachment = await this.db.$transaction(
      async (tx) => {
        const count = await tx.attachment.count({
          where: {
            organizationId: user.organizationId,
            resourceType: dto.resource_type,
            resourceId: dto.resource_id,
            OR: [
              { uploadStatus: "READY" },
              { uploadStatus: "PENDING", uploadExpiresAt: { gt: new Date() } },
            ],
          },
        });
        if (count >= 10)
          throw new ApiException(
            ErrorCode.VALIDATION_ERROR,
            "Mỗi phiếu chỉ được tối đa 10 ảnh.",
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        return tx.attachment.create({
          data: {
            id,
            organizationId: user.organizationId,
            uploadedById: user.id,
            resourceType: dto.resource_type,
            resourceId: dto.resource_id,
            fileName: dto.file_name.trim().slice(0, 255),
            mimeType: dto.content_type,
            sizeBytes: dto.size_bytes,
            objectKey,
            uploadStatus: "PENDING",
            uploadExpiresAt: signed.expiresAt,
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
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return {
      data: {
        attachment,
        uploadUrl: signed.url,
        method: "PUT",
        headers: {
          "Content-Type": dto.content_type,
          "Content-Length": String(dto.size_bytes),
          "If-None-Match": "*",
        },
        expiresAt: signed.expiresAt,
      },
      message: "Khởi tạo tải ảnh trực tiếp lên R2 thành công.",
    };
  }

  async finalizeUpload(user: AuthUser, id: string) {
    const attachment = await this.db.attachment.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!attachment) this.notFound();
    await this.authorize(user, {
      resource_type: attachment.resourceType as
        "RECEIPT" | "DAMAGE_REPORT" | "RETURN",
      resource_id: attachment.resourceId,
    });
    if (attachment.uploadStatus === "READY")
      return {
        data: this.metadata(attachment),
        message: "Ảnh đã hoàn tất tải lên.",
      };
    if (!attachment.objectKey) this.notFound();

    if (
      attachment.uploadExpiresAt &&
      attachment.uploadExpiresAt.getTime() < Date.now()
    ) {
      await this.removePending(attachment.id, attachment.objectKey);
      throw new ApiException(
        ErrorCode.INVALID_STATE,
        "Phiên tải ảnh đã hết hạn. Vui lòng khởi tạo lại.",
        HttpStatus.GONE,
      );
    }

    const object = await this.storage.head(attachment.objectKey);
    if (!object)
      throw new ApiException(
        ErrorCode.INVALID_STATE,
        "Ảnh chưa được tải lên R2.",
        HttpStatus.CONFLICT,
      );

    if (
      object.contentLength !== attachment.sizeBytes ||
      object.contentType !== attachment.mimeType
    ) {
      await this.removePending(attachment.id, attachment.objectKey);
      throw new ApiException(
        ErrorCode.VALIDATION_ERROR,
        "Kích thước hoặc Content-Type của ảnh không khớp phiên tải lên.",
        HttpStatus.BAD_REQUEST,
      );
    }

    const detectedType = await fileTypeFromBuffer(
      await this.storage.readPrefix(attachment.objectKey),
    );
    if (
      !detectedType ||
      !this.sameImageType(detectedType.mime, attachment.mimeType)
    ) {
      await this.removePending(attachment.id, attachment.objectKey);
      throw new ApiException(
        ErrorCode.VALIDATION_ERROR,
        "Nội dung file tải lên không phải định dạng ảnh hợp lệ.",
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.db.$transaction(
      async (tx) => {
        const current = await tx.attachment.findFirst({
          where: { id: attachment.id },
        });
        if (!current) this.notFound();
        if (current.uploadStatus === "READY") return;
        const count = await tx.attachment.count({
          where: {
            organizationId: user.organizationId,
            resourceType: attachment.resourceType,
            resourceId: attachment.resourceId,
            uploadStatus: "READY",
          },
        });
        if (count >= 10)
          throw new ApiException(
            ErrorCode.VALIDATION_ERROR,
            "Mỗi phiếu chỉ được tối đa 10 ảnh.",
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        await tx.attachment.updateMany({
          where: { id: attachment.id, uploadStatus: "PENDING" },
          data: { uploadStatus: "READY", uploadExpiresAt: null },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return {
      data: this.metadata(attachment),
      message: "Hoàn tất tải ảnh lên R2 thành công.",
    };
  }

  async content(user: AuthUser, id: string) {
    const attachment = await this.db.attachment.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
        uploadStatus: "READY",
      },
    });
    if (!attachment) this.notFound();
    await this.authorize(user, {
      resource_type: attachment.resourceType as
        "RECEIPT" | "DAMAGE_REPORT" | "RETURN",
      resource_id: attachment.resourceId,
    });

    const file = attachment.objectKey
      ? new StreamableFile(await this.storage.get(attachment.objectKey))
      : new StreamableFile(Buffer.from(attachment.content ?? this.notFound()));
    return {
      file,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
    };
  }

  private async removePending(id: string, objectKey: string) {
    try {
      await this.storage.delete(objectKey);
      await this.db.attachment.delete({ where: { id } });
    } catch (error) {
      this.logger.error(
        `Could not remove invalid R2 upload ${objectKey}`,
        error,
      );
      throw new ApiException(
        ErrorCode.SOURCE_UNAVAILABLE,
        "Không thể dọn file tải lên không hợp lệ.",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private sameImageType(detected: string, declared: string) {
    if (detected === declared) return true;
    return (
      (detected === "image/heic" || detected === "image/heif") &&
      (declared === "image/heic" || declared === "image/heif")
    );
  }

  private metadata(attachment: {
    id: string;
    resourceType: string;
    resourceId: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    objectKey?: string | null;
    createdAt: Date;
  }) {
    return {
      id: attachment.id,
      resourceType: attachment.resourceType,
      resourceId: attachment.resourceId,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      createdAt: attachment.createdAt,
      viewUrl: `/api/v1/attachments/${attachment.id}/content`,
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
    if (resource.resource_type === "RETURN") {
      const document = await this.db.returnDocument.findFirst({
        where: {
          id: resource.resource_id,
          order: { organizationId: user.organizationId },
        },
        include: { order: { include: { destinationStockLocation: true } } },
      });
      if (!document) this.notFound();
      this.scope.assertAccess(user, "attachment.upload", {
        facilityId: document.order.destinationStockLocation.facilityId,
        stockLocationId: document.order.destinationStockLocationId,
        createdById: document.createdById,
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
