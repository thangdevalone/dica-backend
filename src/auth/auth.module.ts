import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { AccessTokenGuard } from "./guards/access-token.guard.js";
import { PermissionGuard } from "./guards/permission.guard.js";
import { ScopeService } from "./scope.service.js";
@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    ScopeService,
    { provide: APP_GUARD, useClass: AccessTokenGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
  exports: [ScopeService],
})
export class AuthModule {}
