import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { RequirePermissions } from "../auth/decorators/permissions.decorator.js";
import { ApiEndpoint } from "../common/swagger/api-endpoint.decorator.js";
import { RegisterPushDeviceDto, UnregisterPushDeviceDto } from "./push.dto.js";
import { PushService } from "./push.service.js";

@ApiTags("Push notification")
@ApiBearerAuth()
@Controller("push-devices")
export class PushController {
  constructor(private readonly service: PushService) {}

  @Get()
  @ApiEndpoint("Xem các thiết bị Android/iOS đang nhận push", {
    audience: "mobile",
  })
  @RequirePermissions("notification.read_own")
  devices(@CurrentUser() user: AuthUser) {
    return this.service.devices(user);
  }

  @Post()
  @ApiEndpoint("Đăng ký hoặc làm mới FCM token của thiết bị Android/iOS", {
    audience: "mobile",
  })
  @RequirePermissions("notification.read_own")
  register(@CurrentUser() user: AuthUser, @Body() dto: RegisterPushDeviceDto) {
    return this.service.register(user, dto);
  }

  @Post("unregister")
  @ApiEndpoint("Ngừng gửi FCM push tới thiết bị Android/iOS", {
    audience: "mobile",
  })
  @RequirePermissions("notification.read_own")
  unregister(
    @CurrentUser() user: AuthUser,
    @Body() dto: UnregisterPushDeviceDto,
  ) {
    return this.service.unregister(user, dto);
  }
}
