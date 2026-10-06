import { Body, Controller, Get, Ip, Patch, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import type { AuthUser } from "./auth.types.js";
import { AuthService } from "./auth.service.js";
import { CurrentUser } from "./decorators/current-user.decorator.js";
import { Public } from "./decorators/public.decorator.js";
import { ApiEndpoint } from "../common/swagger/api-endpoint.decorator.js";
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
  @ApiEndpoint("Đăng nhập và nhận access token, refresh token", {
    audience: "both",
  })
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
  @ApiEndpoint("Đổi refresh token lấy cặp token mới", { audience: "both" })
  @Post("auth/refresh")
  refresh(@Body() d: RefreshTokenDto) {
    return this.auth.refresh(d.refresh_token);
  }
  @ApiBearerAuth()
  @ApiEndpoint("Đăng xuất và thu hồi phiên đăng nhập hiện tại", {
    audience: "both",
    emptyBody: true,
  })
  @Post("auth/logout")
  logout(@CurrentUser() u: AuthUser) {
    return this.auth.logout(u);
  }
  @ApiBearerAuth()
  @ApiEndpoint("Lấy hồ sơ của tài khoản đang đăng nhập", {
    audience: "both",
  })
  @Get("me")
  me(@CurrentUser() u: AuthUser) {
    return this.auth.me(u);
  }
  @ApiBearerAuth()
  @ApiEndpoint("Cập nhật thông tin cá nhân của tài khoản", {
    audience: "both",
  })
  @Patch("me/profile")
  updateProfile(@CurrentUser() u: AuthUser, @Body() d: UpdateProfileDto) {
    return this.auth.updateProfile(u, d);
  }
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiEndpoint("Đổi tên đăng nhập của tài khoản", { audience: "both" })
  @Patch("me/account")
  changeUsername(@CurrentUser() u: AuthUser, @Body() d: ChangeUsernameDto) {
    return this.auth.changeUsername(u, d);
  }
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiEndpoint("Đổi mật khẩu của tài khoản", { audience: "both" })
  @Post("me/change-password")
  changePassword(@CurrentUser() u: AuthUser, @Body() d: ChangePasswordDto) {
    return this.auth.changePassword(u, d);
  }
  @ApiBearerAuth()
  @ApiEndpoint("Lấy danh sách quyền và phạm vi của tài khoản", {
    audience: "both",
  })
  @Get("me/permissions")
  permissions(@CurrentUser() u: AuthUser) {
    return this.auth.permissions(u);
  }
}
