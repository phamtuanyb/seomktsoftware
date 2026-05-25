import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '@mkt-seo/shared';
import { REQUIRE_QUOTA_KEY, type RequireQuotaConfig } from '../decorators';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';
import { QuotaService } from '../services/quota.service';

/** Section 10 — checks quota before allowing a quota-consuming action. */
@Injectable()
export class QuotaGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly quotas: QuotaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const cfg = this.reflector.getAllAndOverride<RequireQuotaConfig>(REQUIRE_QUOTA_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!cfg) return true;
    const req = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = req.user;
    if (!user) {
      throw new ForbiddenException({
        code: ErrorCode.RESOURCE_FORBIDDEN,
        message: 'Chưa xác thực người dùng',
      });
    }
    const result = await this.quotas.checkQuota(user.id, cfg.resource, cfg.amount);
    if (!result.allowed) {
      throw new ForbiddenException({
        code: ErrorCode.QUOTA_EXCEEDED,
        message: `Bạn đã hết hạn mức ${cfg.resource}. Đã dùng ${result.used}/${result.limit}.`,
        details: { resource: cfg.resource, required: cfg.amount, ...result },
      });
    }
    return true;
  }
}
