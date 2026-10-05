import { Body, Controller, Get, Ip, Patch, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import type { AuthUser } from "./auth.types.js";
import { AuthService } from "./auth.service.js";
import { CurrentUser } from "./decorators/current-user.decorator.js";
import { Public } from "./decorators/public.decorator.js";
import { LoginDto, RefreshTokenDto } from "./dto/login.dto.js";
import {
  ChangePasswordDto,
  ChangeUsernameDto,
  UpdateProfileDto,
} from "./dto/profile.dto.js";
@ApiTags("Xác thực")
@Controller()
export class AuthController {
  constructor(private auth: AuthService) {}
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("auth/login")
  login(@Body() d: LoginDto, @Ip() ip: string, @Req() request: Request) {
    const userAgent = request.get("user-agent");
    return this.auth.login(d, {
      ipAddress: ip,
      ...(userAgent ? { userAgent } : {}),
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
  @ApiBearerAuth() @Patch("me/profile") updateProfile(
    @CurrentUser() u: AuthUser,
    @Body() d: UpdateProfileDto,
  ) {
    return this.auth.updateProfile(u, d);
  }
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Patch("me/account")
  changeUsername(@CurrentUser() u: AuthUser, @Body() d: ChangeUsernameDto) {
    return this.auth.changeUsername(u, d);
  }
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("me/change-password")
  changePassword(@CurrentUser() u: AuthUser, @Body() d: ChangePasswordDto) {
    return this.auth.changePassword(u, d);
  }
  @ApiBearerAuth() @Get("me/permissions") permissions(
    @CurrentUser() u: AuthUser,
  ) {
    return this.auth.permissions(u);
  }
}
