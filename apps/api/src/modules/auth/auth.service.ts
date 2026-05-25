import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcrypt';
import { uuidv7 } from 'uuidv7';
import { ErrorCode, PLAN_QUOTAS, type AuthUser, type PlanTier } from '@mkt-seo/shared';
import { PrismaService } from '../../common/services/prisma.service';
import { EventBusService } from '../../common/services/event-bus.service';
import { TokenService, type IssuedTokens } from './services/token.service';
import { EmailService } from './services/email.service';
import type { RegisterDto, LoginDto } from './dto';

export interface AuthResult {
  user: AuthUser;
  tokens: IssuedTokens;
}

const TRIAL_DAYS = 14;

/**
 * Section 6 + 9 — Authentication. New users land on the `trial` plan with
 * quota rows pre-seeded. The verification email is dispatched via EmailService
 * which runs in stub mode until SENDGRID_API_KEY is configured.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly email: EmailService,
    private readonly eventBus: EventBusService,
    private readonly cfg: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException({
        code: ErrorCode.EMAIL_ALREADY_EXISTS,
        message: 'Email đã được sử dụng',
      });
    }

    const rounds = this.cfg.get<number>('jwt.bcryptRounds') ?? 12;
    const passwordHash = await bcrypt.hash(dto.password, rounds);
    const now = new Date();
    const trialEnd = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          id: uuidv7(),
          email: dto.email,
          passwordHash,
          name: dto.name ?? null,
          role: 'user',
        },
      });

      await tx.subscription.create({
        data: {
          id: uuidv7(),
          userId: created.id,
          plan: 'trial',
          status: 'active',
          startedAt: now,
          expiresAt: trialEnd,
        },
      });

      const planQuota = PLAN_QUOTAS.trial;
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const quotaRows = [
        {
          resource: 'articles' as const,
          period: 'monthly',
          limit: planQuota.articles_monthly,
          reset: monthEnd,
        },
        {
          resource: 'keywords' as const,
          period: 'monthly',
          limit: planQuota.keywords_monthly,
          reset: monthEnd,
        },
        { resource: 'sites' as const, period: 'lifetime', limit: planQuota.sites, reset: null },
        {
          resource: 'brand_voices' as const,
          period: 'lifetime',
          limit: planQuota.brand_voices,
          reset: null,
        },
        {
          resource: 'images' as const,
          period: 'monthly',
          limit: planQuota.images_monthly,
          reset: monthEnd,
        },
      ];
      for (const row of quotaRows) {
        await tx.quota.create({
          data: {
            id: uuidv7(),
            userId: created.id,
            resource: row.resource,
            period: row.period,
            limitValue: row.limit ?? -1,
            resetAt: row.reset,
          },
        });
      }

      return created;
    });

    // Best-effort email — failures should not block registration.
    try {
      const verifyToken = await this.tokens.createEmailVerifyToken(user.id);
      await this.email.sendVerifyEmail(user.email, verifyToken);
    } catch (err) {
      this.logger.warn(`Verify email dispatch failed for ${user.email}: ${(err as Error).message}`);
    }

    const issued = await this.tokens.issueTokens({
      id: user.id,
      email: user.email,
      plan: 'trial',
      role: 'user',
    });

    await this.eventBus.emit('user.registered', { user_id: user.id, email: user.email });

    return {
      user: this.toAuthUser(user, 'trial'),
      tokens: issued,
    };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException({
        code: ErrorCode.INVALID_CREDENTIALS,
        message: 'Email hoặc mật khẩu không đúng',
      });
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({
        code: ErrorCode.INVALID_CREDENTIALS,
        message: 'Email hoặc mật khẩu không đúng',
      });
    }
    const plan = await this.resolveActivePlan(user.id);
    const tokens = await this.tokens.issueTokens({
      id: user.id,
      email: user.email,
      plan,
      role: user.role as 'user' | 'admin',
    });
    return { user: this.toAuthUser(user, plan), tokens };
  }

  async refresh(refreshToken: string): Promise<IssuedTokens> {
    let payload;
    try {
      payload = await this.tokens.verifyRefreshToken(refreshToken);
    } catch (err) {
      const message = (err as Error).message;
      const code =
        message === 'REFRESH_REVOKED'
          ? ErrorCode.TOKEN_INVALID
          : message === 'jwt expired'
            ? ErrorCode.TOKEN_EXPIRED
            : ErrorCode.TOKEN_INVALID;
      throw new UnauthorizedException({ code, message: 'Refresh token không hợp lệ' });
    }
    // Rotation: revoke the old refresh, issue a fresh pair.
    await this.tokens.revokeRefreshToken(payload.jti);
    return this.tokens.issueTokens({
      id: payload.sub,
      email: payload.email,
      plan: payload.plan,
      role: payload.role,
    });
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    try {
      const payload = await this.tokens.verifyRefreshToken(refreshToken);
      await this.tokens.revokeRefreshToken(payload.jti);
    } catch {
      // Silently succeed — logout should be idempotent.
    }
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.deletedAt) {
      // Don't leak account existence.
      return;
    }
    const token = await this.tokens.createPasswordResetToken(user.id);
    try {
      await this.email.sendPasswordReset(user.email, token);
    } catch (err) {
      this.logger.warn(`Reset email dispatch failed for ${user.email}: ${(err as Error).message}`);
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const userId = await this.tokens.consumePasswordResetToken(token);
    if (!userId) {
      throw new BadRequestException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn',
      });
    }
    const rounds = this.cfg.get<number>('jwt.bcryptRounds') ?? 12;
    const passwordHash = await bcrypt.hash(newPassword, rounds);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    // Invalidate every active session — force re-login on all devices.
    await this.tokens.revokeAllRefreshTokensForUser(userId);
  }

  async verifyEmail(token: string): Promise<void> {
    const userId = await this.tokens.consumeEmailVerifyToken(token);
    if (!userId) {
      throw new BadRequestException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'Token xác thực email không hợp lệ hoặc đã hết hạn',
      });
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Không tìm thấy người dùng',
      });
    }
    const plan = await this.resolveActivePlan(user.id);
    return this.toAuthUser(user, plan);
  }

  private async resolveActivePlan(userId: string): Promise<PlanTier> {
    const sub = await this.prisma.subscription.findFirst({
      where: { userId, status: 'active' },
      orderBy: { startedAt: 'desc' },
    });
    if (!sub) return 'trial';
    if (sub.expiresAt && sub.expiresAt < new Date()) return 'trial';
    return sub.plan as PlanTier;
  }

  private toAuthUser(
    user: {
      id: string;
      email: string;
      name: string | null;
      avatarUrl: string | null;
      role: string;
      emailVerifiedAt: Date | null;
      createdAt: Date;
    },
    plan: PlanTier,
  ): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatarUrl,
      role: user.role as 'user' | 'admin',
      plan,
      email_verified: !!user.emailVerifiedAt,
      created_at: user.createdAt.toISOString(),
    };
  }
}
