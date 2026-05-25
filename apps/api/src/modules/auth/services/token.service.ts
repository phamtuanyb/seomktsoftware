import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash } from 'node:crypto';
import { uuidv7 } from 'uuidv7';
import type { Redis as RedisClient } from 'ioredis';
import type { PlanTier, UserRole } from '@mkt-seo/shared';
import { REDIS_CLIENT } from '../../../common/services/redis.service';

export interface TokenPayload {
  sub: string;
  email: string;
  plan: PlanTier;
  role: UserRole;
  jti: string;
  // iat + exp populated by jsonwebtoken
}

export interface IssuedTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

/** Section 9 — JWT issuance, refresh token session store, password/email tokens. */
@Injectable()
export class TokenService {
  /** Redis key prefix for active refresh sessions. */
  private static readonly REFRESH_PREFIX = 'auth:refresh:';
  private static readonly PASSWORD_RESET_PREFIX = 'auth:reset:';
  private static readonly EMAIL_VERIFY_PREFIX = 'auth:verify:';

  constructor(
    private readonly jwt: JwtService,
    private readonly cfg: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
  ) {}

  async issueTokens(user: {
    id: string;
    email: string;
    plan: PlanTier;
    role: UserRole;
  }): Promise<IssuedTokens> {
    const accessJti = uuidv7();
    const refreshJti = uuidv7();
    const accessExp = this.cfg.get<string>('jwt.accessExpiresIn') ?? '15m';
    const refreshExp = this.cfg.get<string>('jwt.refreshExpiresIn') ?? '30d';

    const access_token = this.jwt.sign(
      { sub: user.id, email: user.email, plan: user.plan, role: user.role, jti: accessJti },
      { expiresIn: accessExp },
    );
    const refresh_token = this.jwt.sign(
      { sub: user.id, email: user.email, plan: user.plan, role: user.role, jti: refreshJti },
      { expiresIn: refreshExp },
    );

    const ttl = this.expiresInSeconds(refreshExp);
    await this.redis.set(
      TokenService.REFRESH_PREFIX + refreshJti,
      JSON.stringify({ userId: user.id, issuedAt: Date.now() }),
      'EX',
      ttl,
    );

    return {
      access_token,
      refresh_token,
      expires_in: this.expiresInSeconds(accessExp),
    };
  }

  /** Returns the JWT payload if the refresh token is valid AND still in Redis. */
  async verifyRefreshToken(refreshToken: string): Promise<TokenPayload> {
    const payload = this.jwt.verify<TokenPayload>(refreshToken);
    const exists = await this.redis.exists(TokenService.REFRESH_PREFIX + payload.jti);
    if (!exists) {
      throw new Error('REFRESH_REVOKED');
    }
    return payload;
  }

  async revokeRefreshToken(jti: string): Promise<void> {
    await this.redis.del(TokenService.REFRESH_PREFIX + jti);
  }

  async revokeAllRefreshTokensForUser(userId: string): Promise<void> {
    // Refresh keys are jti-keyed; we use a paginated scan to find ones whose
    // value points at the user. Acceptable for MVP — Sprint 3 introduces a
    // secondary set per user to make this O(1).
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        TokenService.REFRESH_PREFIX + '*',
        'COUNT',
        200,
      );
      cursor = next;
      if (keys.length) {
        const values = await this.redis.mget(...keys);
        const stale = keys.filter((_, i) => {
          try {
            return values[i] && (JSON.parse(values[i]!) as { userId: string }).userId === userId;
          } catch {
            return false;
          }
        });
        if (stale.length) await this.redis.del(...stale);
      }
    } while (cursor !== '0');
  }

  // ----- Password reset + email verify (opaque random tokens, not JWTs) -----

  async createPasswordResetToken(userId: string, ttlSeconds = 3600): Promise<string> {
    const raw = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(raw).digest('hex');
    await this.redis.set(TokenService.PASSWORD_RESET_PREFIX + hash, userId, 'EX', ttlSeconds);
    return raw;
  }

  async consumePasswordResetToken(rawToken: string): Promise<string | null> {
    const hash = createHash('sha256').update(rawToken).digest('hex');
    const key = TokenService.PASSWORD_RESET_PREFIX + hash;
    const userId = await this.redis.get(key);
    if (!userId) return null;
    await this.redis.del(key);
    return userId;
  }

  async createEmailVerifyToken(userId: string, ttlSeconds = 86400): Promise<string> {
    const raw = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(raw).digest('hex');
    await this.redis.set(TokenService.EMAIL_VERIFY_PREFIX + hash, userId, 'EX', ttlSeconds);
    return raw;
  }

  async consumeEmailVerifyToken(rawToken: string): Promise<string | null> {
    const hash = createHash('sha256').update(rawToken).digest('hex');
    const key = TokenService.EMAIL_VERIFY_PREFIX + hash;
    const userId = await this.redis.get(key);
    if (!userId) return null;
    await this.redis.del(key);
    return userId;
  }

  private expiresInSeconds(value: string | number): number {
    if (typeof value === 'number') return value;
    const match = value.match(/^(\d+)([smhd])$/);
    if (!match) return 900;
    const n = parseInt(match[1] ?? '0', 10);
    switch (match[2]) {
      case 's':
        return n;
      case 'm':
        return n * 60;
      case 'h':
        return n * 3600;
      case 'd':
        return n * 86400;
      default:
        return 900;
    }
  }
}
