import { Body, Controller, Get, Headers, Ip, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { AuthUser } from "./auth.types.js";
import { AuthService } from "./auth.service.js";
import { CurrentUser } from "./decorators/current-user.decorator.js";
import { Public } from "./decorators/public.decorator.js";
import { LoginDto, RefreshTokenDto } from "./dto/login.dto.js";
@ApiTags("Xác thực")
@Controller()
export class AuthController {
  constructor(private auth: AuthService) {}
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("auth/login")
  login(
    @Body() d: LoginDto,
    @Ip() ip: string,
    @Headers("user-agent") ua?: string,
  ) {
    return this.auth.login(d, {
      ipAddress: ip,
      ...(ua ? { userAgent: ua } : {}),
    });
  }
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("auth/refresh")
  refresh(@Body() d: RefreshTokenDto) {
    return this.auth.refresh(d.refresh_token);
  }
  @ApiBearerAuth() @Post("auth/logout") logout(@CurrentUser() u: AuthUser) {
    return this.auth.logout(u);
  }
  @ApiBearerAuth() @Get("me") me(@CurrentUser() u: AuthUser) {
    return this.auth.me(u);
  }
  @ApiBearerAuth() @Get("me/permissions") permissions(
    @CurrentUser() u: AuthUser,
  ) {
    return this.auth.permissions(u);
  }
}
