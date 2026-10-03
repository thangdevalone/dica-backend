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
import {
  AssignGrantDto,
  CreateUserDto,
  GrantListQueryDto,
  ResetPasswordDto,
  UpdateUserDto,
} from "./user.dto.js";
import { UserService } from "./user.service.js";
@ApiTags("Tài khoản và quyền")
@ApiBearerAuth()
@ConfigAudit("IDENTITY_ACCESS_CONFIG")
@Controller()
export class UserController {
  constructor(private s: UserService) {}
  @Get("users") @RequirePermissions("user.read") list(
    @CurrentUser() u: AuthUser,
    @Query() q: PaginationDto,
  ) {
    return this.s.list(u, q);
  }
  @Post("users") @RequirePermissions("user.create") create(
    @CurrentUser() u: AuthUser,
    @Body() d: CreateUserDto,
  ) {
    return this.s.create(u, d);
  }
  @Patch("users/:id/deactivate")
  @RequirePermissions("user.deactivate")
  deactivate(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.s.deactivate(u, id);
  }
  @Patch("users/:id/activate")
  @RequirePermissions("user.update")
  activate(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.s.activate(u, id);
  }
  @Post("users/:id/reset-password")
  @RequirePermissions("user.reset_password")
  resetPassword(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: ResetPasswordDto,
  ) {
    return this.s.resetPassword(u, id, d);
  }
  @Patch("users/:id")
  @RequirePermissions("user.update")
  update(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: UpdateUserDto,
  ) {
    return this.s.update(u, id, d);
  }
  @Get("roles") @RequirePermissions("role.read") roles(
    @CurrentUser() u: AuthUser,
    @Query() q: PaginationDto,
  ) {
    return this.s.roles(u, q);
  }
  @Get("permissions") @RequirePermissions("role.read") permissions(
    @CurrentUser() u: AuthUser,
    @Query() q: PaginationDto,
  ) {
    return this.s.permissions(u, q);
  }
  @Get("grants") @RequirePermissions("grant.read") grants(
    @CurrentUser() u: AuthUser,
    @Query() q: GrantListQueryDto,
  ) {
    return this.s.grants(u, q);
  }
  @Post("grants") @RequirePermissions("grant.assign") assign(
    @CurrentUser() u: AuthUser,
    @Body() d: AssignGrantDto,
  ) {
    return this.s.assign(u, d);
  }
  @Delete("grants/:id") @RequirePermissions("grant.revoke") revoke(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.s.revoke(u, id);
  }
}
