import { SetMetadata } from "@nestjs/common";

export const AUTHENTICATED_KEY = "authenticated_only";
/** Endpoints operating only on the signed-in user's own session/profile. */
export const Authenticated = (): MethodDecorator =>
  SetMetadata(AUTHENTICATED_KEY, true);
