import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Readable } from "node:stream";
import { ApiException } from "../common/errors/api.exception.js";
import { ErrorCode } from "../common/errors/error-codes.js";

@Injectable()
export class R2StorageService {
  private readonly logger = new Logger(R2StorageService.name);
  private readonly bucket: string;
  private readonly client: S3Client;
  private readonly uploadUrlTtlSeconds: number;
  private readonly publicBaseUrl: string;

  constructor(config: ConfigService) {
    const accountId = config.getOrThrow<string>("R2_ACCOUNT_ID");
    this.bucket = config.getOrThrow<string>("R2_BUCKET");
    this.uploadUrlTtlSeconds = config.get<number>(
      "R2_UPLOAD_URL_TTL_SECONDS",
      600,
    );
    this.publicBaseUrl = config
      .getOrThrow<string>("R2_PUBLIC_BASE_URL")
      .replace(/\/+$/, "");
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.getOrThrow<string>("R2_ACCESS_KEY_ID"),
        secretAccessKey: config.getOrThrow<string>("R2_SECRET_ACCESS_KEY"),
      },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }

  publicUrl(key: string) {
    const encodedKey = key
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    return `${this.publicBaseUrl}/${encodedKey}`;
  }

  async createUploadUrl(
    key: string,
    contentType: string,
    contentLength: number,
  ) {
    try {
      const expiresAt = new Date(Date.now() + this.uploadUrlTtlSeconds * 1_000);
      const url = await getSignedUrl(
        this.client,
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          ContentType: contentType,
          ContentLength: contentLength,
          IfNoneMatch: "*",
        }),
        {
          expiresIn: this.uploadUrlTtlSeconds,
          signableHeaders: new Set([
            "content-length",
            "content-type",
            "if-none-match",
          ]),
        },
      );
      return { url, expiresAt };
    } catch (error) {
      this.logger.error(`R2 presign failed for key ${key}`, error);
      this.unavailable();
    }
  }

  async head(key: string) {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        contentLength: result.ContentLength,
        contentType: result.ContentType,
      };
    } catch (error) {
      if (this.httpStatus(error) === 404) return null;
      this.logger.error(`R2 HEAD failed for key ${key}`, error);
      this.unavailable();
    }
  }

  async readPrefix(key: string, maxBytes = 4_096): Promise<Buffer> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Range: `bytes=0-${maxBytes - 1}`,
        }),
      );
      if (!result.Body) throw new Error("Invalid R2 body");
      return Buffer.from(await result.Body.transformToByteArray());
    } catch (error) {
      this.logger.error(`R2 prefix read failed for key ${key}`, error);
      this.unavailable();
    }
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentLength: body.length,
          ContentType: contentType,
        }),
      );
    } catch (error) {
      this.logger.error(`R2 upload failed for key ${key}`, error);
      this.unavailable();
    }
  }

  async get(key: string): Promise<Readable> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!(result.Body instanceof Readable))
        throw new Error("Invalid R2 body");
      return result.Body;
    } catch (error) {
      this.logger.error(`R2 download failed for key ${key}`, error);
      this.unavailable();
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  private unavailable(): never {
    throw new ApiException(
      ErrorCode.SOURCE_UNAVAILABLE,
      "Kho lưu trữ file tạm thời không khả dụng.",
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  private httpStatus(error: unknown): number | undefined {
    return (error as { $metadata?: { httpStatusCode?: number } }).$metadata
      ?.httpStatusCode;
  }
}
