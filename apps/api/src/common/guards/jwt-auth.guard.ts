import type { ExecutionContext} from '@nestjs/common';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ErrorCode } from '@mkt-seo/shared';
import { IS_PUBLIC_KEY } from '../decorators';

/**
 * Section 9 — JWT auth. Respects @Public() on individual handlers / controllers.
 * Translates Passport failures into our ErrorCode enum (Section 11).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest<TUser>(
    err: Error | null,
    user: TUser | null,
    info: { name?: string; message?: string } | null,
  ): TUser {
    if (err || !user) {
      const code =
        info?.name === 'TokenExpiredError' ? ErrorCode.TOKEN_EXPIRED : ErrorCode.TOKEN_INVALID;
      throw new UnauthorizedException({ code, message: info?.message ?? 'Unauthorized' });
    }
    return user;
  }
}
