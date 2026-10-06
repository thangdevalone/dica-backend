import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../auth/decorators/public.decorator.js";
import { ApiEndpoint } from "../common/swagger/api-endpoint.decorator.js";
import { PrismaService } from "../database/prisma.service.js";
@ApiTags("Vận hành")
@Controller("health")
export class HealthController {
  constructor(private db: PrismaService) {}
  @Public()
  @ApiEndpoint("Kiểm tra tiến trình API còn hoạt động", {
    audience: "system",
  })
  @Get("live")
  live() {
    return { data: { status: "ok" }, message: "Dịch vụ đang hoạt động." };
  }
  @Public()
  @ApiEndpoint("Kiểm tra API và cơ sở dữ liệu đã sẵn sàng", { adminWeb: true })
  @Get("ready")
  async ready() {
    try {
      await this.db.$queryRaw`SELECT 1`;
      return {
        data: { status: "ready", database: "connected" },
        message: "Dịch vụ sẵn sàng nhận yêu cầu.",
      };
    } catch {
      throw new ServiceUnavailableException({
        code: "SERVICE_NOT_READY",
        message: "Dịch vụ chưa kết nối được cơ sở dữ liệu.",
      });
    }
  }
}
