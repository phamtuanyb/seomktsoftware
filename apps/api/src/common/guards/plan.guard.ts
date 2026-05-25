import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode, type PlanTier } from '@mkt-seo/shared';
import { REQUIRE_PLAN_KEY } from '../decorators';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

/** Section 9 — enforces @RequirePlan. */
@Injectable()
export class PlanGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PlanTier[]>(REQUIRE_PLAN_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const req = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!req.user || !required.includes(req.user.plan)) {
      throw new ForbiddenException({
        code: ErrorCode.PLAN_REQUIRED,
        message: `Tính năng này yêu cầu gói: ${required.join(', ')}`,
        details: { required_plans: required, current_plan: req.user?.plan },
      });
    }
    return true;
  }
}
