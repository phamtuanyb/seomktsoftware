import type { CanActivate, ExecutionContext} from '@nestjs/common';
import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { ErrorCode, type UserRole } from '@mkt-seo/shared';
import { ROLES_KEY } from '../decorators';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

/** Section 9 — enforces @Roles. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const req = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = req.user;
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException({
        code: ErrorCode.RESOURCE_FORBIDDEN,
        message: 'Bạn không có quyền truy cập tài nguyên này',
      });
    }
    return true;
  }
}
