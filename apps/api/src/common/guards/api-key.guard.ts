import type { CanActivate, ExecutionContext} from '@nestjs/common';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import { ErrorCode } from '@mkt-seo/shared';
import { REQUIRE_SCOPE_KEY } from '../decorators';
import type { PrismaService } from '../services/prisma.service';

/**
 * Phase 2 — API key authentication via `X-API-Key` header. Scopes enforced via
 * @RequireScope. Lookup hashes the supplied key (SHA-256) and matches against
 * `api_keys.key_hash`.
 *
 * Scaffolded here so the schema + decorator are wired from MVP (Section 6).
 * MVP routes will not attach this guard yet.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined>; user?: unknown }>();
    const headerKey = req.headers['x-api-key'];
    if (!headerKey) {
      throw new UnauthorizedException({
        code: ErrorCode.INVALID_CREDENTIALS,
        message: 'Thiếu header X-API-Key',
      });
    }
    const hash = createHash('sha256').update(headerKey).digest('hex');
    const key = await this.prisma.apiKey.findUnique({ where: { keyHash: hash } });
    if (!key || key.revokedAt) {
      throw new UnauthorizedException({
        code: ErrorCode.INVALID_CREDENTIALS,
        message: 'API key không hợp lệ hoặc đã thu hồi',
      });
    }
    if (key.expiresAt && key.expiresAt < new Date()) {
      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_EXPIRED,
        message: 'API key đã hết hạn',
      });
    }
    const requiredScopes = this.reflector.getAllAndOverride<string[]>(REQUIRE_SCOPE_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (requiredScopes?.length) {
      const missing = requiredScopes.filter((s) => !key.scopes.includes(s));
      if (missing.length) {
        throw new UnauthorizedException({
          code: ErrorCode.RESOURCE_FORBIDDEN,
          message: `Thiếu scope: ${missing.join(', ')}`,
        });
      }
    }
    // Bubble identity to the request so @CurrentUser works.
    (req as { user: unknown }).user = { id: key.userId, apiKeyId: key.id };
    return true;
  }
}
