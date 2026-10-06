import { applyDecorators } from "@nestjs/common";
import { ApiBody, ApiExtension, ApiOperation } from "@nestjs/swagger";

export type ApiAudience = "mobile" | "admin-web" | "both" | "system";

interface ApiEndpointOptions {
  audience?: ApiAudience;
  /** Tương thích với các khai báo Admin Web đã có. */
  adminWeb?: true;
  /** Đánh dấu endpoint được ứng dụng Mobile tích hợp. */
  mobile?: true;
  emptyBody?: boolean;
}

const AUDIENCE_DOC: Record<
  ApiAudience,
  { label: string; description: string }
> = {
  mobile: {
    label: "MOBILE",
    description:
      "Luồng tích hợp: ứng dụng Mobile DICA. Admin Web không cần gọi endpoint này.",
  },
  "admin-web": {
    label: "ADMIN WEB",
    description:
      "Luồng tích hợp: trang quản trị Web DICA. Mobile không cần gọi endpoint này.",
  },
  both: {
    label: "MOBILE + ADMIN WEB",
    description:
      "Luồng tích hợp dùng chung: ứng dụng Mobile DICA và trang quản trị Web DICA đều có thể gọi endpoint này theo quyền được cấp.",
  },
  system: {
    label: "SYSTEM",
    description:
      "Đối tượng tích hợp: hạ tầng giám sát/vận hành; không dùng trực tiếp trên Mobile hoặc Admin Web.",
  },
};

/**
 * Mô tả ngắn một endpoint trên Swagger và đánh dấu các API đang được Admin Web sử dụng.
 */
export function ApiEndpoint(
  summary: string,
  options: ApiEndpointOptions,
): MethodDecorator {
  const inferredAudience: ApiAudience =
    options.adminWeb && options.mobile
      ? "both"
      : options.adminWeb
        ? "admin-web"
        : options.mobile
          ? "mobile"
          : "system";
  const audience = AUDIENCE_DOC[options.audience ?? inferredAudience];
  const bodyDescription = options.emptyBody
    ? "API không yêu cầu dữ liệu đầu vào; có thể gửi object rỗng `{}`."
    : undefined;

  return applyDecorators(
    ApiOperation({
      summary: `[${audience.label}] ${summary}`,
      description: [audience.description, bodyDescription]
        .filter(Boolean)
        .join("\n\n"),
    }),
    ApiExtension("x-dica-audience", {
      value: options.audience ?? inferredAudience,
      clients:
        (options.audience ?? inferredAudience) === "both"
          ? ["mobile", "admin-web"]
          : [options.audience ?? inferredAudience],
    }),
    ...(options.emptyBody
      ? [
          ApiBody({
            required: false,
            description:
              "Không có trường bắt buộc; gửi `{}` hoặc không gửi body.",
            schema: {
              type: "object",
              additionalProperties: false,
              example: {},
            },
          }),
        ]
      : []),
  );
}
