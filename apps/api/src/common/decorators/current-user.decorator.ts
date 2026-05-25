import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { PlanTier, UserRole } from '@mkt-seo/shared';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  plan: PlanTier;
  jti?: string;
}

/**
 * Extracts the authenticated user from `req.user` (populated by JwtAuthGuard).
 * Throws nothing if there is no user — guards are responsible for that.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!req.user) return undefined;
    return data ? req.user[data] : req.user;
  },
);
