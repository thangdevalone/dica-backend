import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { RequirePermissions } from "../auth/decorators/permissions.decorator.js";
import { ConfigAudit } from "../common/audit/config-audit.decorator.js";
import { PaginationDto } from "../common/dto/pagination.dto.js";
import { ApiEndpoint } from "../common/swagger/api-endpoint.decorator.js";
import {
  AssignGrantDto,
  CreateRoleDto,
  CreateUserDto,
  GrantListQueryDto,
  ResetPasswordDto,
  UpdateRoleDto,
  UpdateUserDto,
} from "./user.dto.js";
import { UserService } from "./user.service.js";
@ApiTags("Tài khoản và quyền")
@ApiBearerAuth()
@ConfigAudit("IDENTITY_ACCESS_CONFIG")
@Controller()
export class UserController {
  constructor(private s: UserService) {}
  @ApiEndpoint("Xem danh sách tài khoản", { adminWeb: true })
  @Get("users")
  @RequirePermissions("user.read")
  list(@CurrentUser() u: AuthUser, @Query() q: PaginationDto) {
    return this.s.list(u, q);
  }
  @ApiEndpoint("Tạo tài khoản và cấp quyền ban đầu", { adminWeb: true })
  @Post("users")
  @RequirePermissions("user.create", "grant.assign")
  create(@CurrentUser() u: AuthUser, @Body() d: CreateUserDto) {
    return this.s.create(u, d);
  }
  @Patch("users/:id/deactivate")
  @ApiEndpoint("Vô hiệu hóa một tài khoản", {
    adminWeb: true,
    emptyBody: true,
  })
  @RequirePermissions("user.deactivate")
  deactivate(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.s.deactivate(u, id);
  }
  @Patch("users/:id/activate")
  @ApiEndpoint("Kích hoạt lại một tài khoản", {
    adminWeb: true,
    emptyBody: true,
  })
  @RequirePermissions("user.update")
  activate(@CurrentUser() u: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.s.activate(u, id);
  }
  @Post("users/:id/reset-password")
  @ApiEndpoint("Đặt lại mật khẩu cho tài khoản", { adminWeb: true })
  @RequirePermissions("user.reset_password")
  resetPassword(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: ResetPasswordDto,
  ) {
    return this.s.resetPassword(u, id, d);
  }
  @Patch("users/:id")
  @ApiEndpoint("Cập nhật thông tin tài khoản", { adminWeb: true })
  @RequirePermissions("user.update")
  update(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: UpdateUserDto,
  ) {
    return this.s.update(u, id, d);
  }
  @ApiEndpoint("Xem danh sách vai trò", { adminWeb: true })
  @Get("roles")
  @RequirePermissions("role.read")
  roles(@CurrentUser() u: AuthUser, @Query() q: PaginationDto) {
    return this.s.roles(u, q);
  }
  @ApiEndpoint("Tạo vai trò tùy chỉnh và chọn bộ quyền", { adminWeb: true })
  @Post("roles")
  @RequirePermissions("role.manage")
  createRole(@CurrentUser() u: AuthUser, @Body() d: CreateRoleDto) {
    return this.s.createRole(u, d);
  }
  @ApiEndpoint("Cập nhật vai trò tùy chỉnh hoặc bộ quyền của vai trò gốc", {
    adminWeb: true,
  })
  @Patch("roles/:id")
  @RequirePermissions("role.manage")
  updateRole(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: UpdateRoleDto,
  ) {
    return this.s.updateRole(u, id, d);
  }
  @ApiEndpoint("Xem danh mục quyền hệ thống", { adminWeb: true })
  @Get("permissions")
  @RequirePermissions("role.read")
  permissions(@CurrentUser() u: AuthUser, @Query() q: PaginationDto) {
    return this.s.permissions(u, q);
  }
  @ApiEndpoint("Xem các quyền đã cấp cho tài khoản", { adminWeb: true })
  @Get("grants")
  @RequirePermissions("grant.read")
  grants(@CurrentUser() u: AuthUser, @Query() q: GrantListQueryDto) {
    return this.s.grants(u, q);
  }
  @ApiEndpoint("Cấp vai trò và phạm vi cho tài khoản", { adminWeb: true })
  @Post("grants")
  @RequirePermissions("grant.assign")
  assign(@CurrentUser() u: AuthUser, @Body() d: AssignGrantDto) {
    return this.s.assign(u, d);
  }
  @ApiEndpoint("Thu hồi một quyền đã cấp", { adminWeb: true })
  @Delete("grants/:id")
  @RequirePermissions("grant.revoke")
  revoke(@CurrentUser() u: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.s.revoke(u, id);
  }
}
