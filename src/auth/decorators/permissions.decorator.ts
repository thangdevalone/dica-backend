import { SetMetadata } from "@nestjs/common";
export const PERMISSIONS_KEY = "permissions";
export const RequirePermissions = (...permissions: string[]): MethodDecorator =>
  SetMetadata(PERMISSIONS_KEY, permissions);
