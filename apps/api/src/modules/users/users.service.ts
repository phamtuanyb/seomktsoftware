import { Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode } from '@mkt-seo/shared';
import { PrismaService } from '../../common/services/prisma.service';
import type { UpdateProfileDto } from './dto/update-profile.dto';

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: string;
  plan: string;
  email_verified: boolean;
  preferences_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  subscription: {
    plan: string;
    status: string;
    expires_at: string | null;
  } | null;
  quotas: Array<{
    resource: string;
    period: string;
    limit_value: number;
    used: number;
  }>;
}

/**
 * Section 6 — Users module.
 *
 * Lives alongside Auth: Auth owns sign-up/login/email-verify, Users owns the
 * authenticated profile + preferences. /auth/me returns the lean AuthUser
 * payload for token consumers; /users/me here returns the full profile
 * including phone, preferences, current subscription, and quotas — what the
 * Settings page needs in a single round trip.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Không tìm thấy người dùng',
      });
    }
    const [activeSub, quotas] = await Promise.all([
      this.prisma.subscription.findFirst({
        where: { userId, status: 'active' },
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.quota.findMany({ where: { userId } }),
    ]);
    return this.toProfile(user, activeSub, quotas);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserProfile> {
    // Throw 404 before update so we don't accidentally upsert.
    await this.getProfile(userId);
    const data: {
      name?: string | null;
      phone?: string | null;
      avatarUrl?: string | null;
      preferencesJson?: object;
    } = {};
    if (dto.name !== undefined) data.name = dto.name || null;
    if (dto.phone !== undefined) data.phone = dto.phone || null;
    if (dto.avatar_url !== undefined) data.avatarUrl = dto.avatar_url || null;
    if (dto.preferences_json !== undefined) {
      data.preferencesJson = dto.preferences_json as object;
    }
    await this.prisma.user.update({ where: { id: userId }, data });
    return this.getProfile(userId);
  }

  private toProfile(
    user: {
      id: string;
      email: string;
      name: string | null;
      phone: string | null;
      avatarUrl: string | null;
      role: string;
      emailVerifiedAt: Date | null;
      preferencesJson: unknown;
      createdAt: Date;
      updatedAt: Date;
    },
    sub: { plan: string; status: string; expiresAt: Date | null } | null,
    quotas: Array<{ resource: string; period: string; limitValue: number; used: number }>,
  ): UserProfile {
    const plan = sub && (!sub.expiresAt || sub.expiresAt >= new Date()) ? sub.plan : 'trial';
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      avatar_url: user.avatarUrl,
      role: user.role,
      plan,
      email_verified: Boolean(user.emailVerifiedAt),
      preferences_json: (user.preferencesJson as Record<string, unknown>) ?? {},
      created_at: user.createdAt.toISOString(),
      updated_at: user.updatedAt.toISOString(),
      subscription: sub
        ? {
            plan: sub.plan,
            status: sub.status,
            expires_at: sub.expiresAt ? sub.expiresAt.toISOString() : null,
          }
        : null,
      quotas: quotas.map((q) => ({
        resource: q.resource,
        period: q.period,
        limit_value: q.limitValue,
        used: q.used,
      })),
    };
  }
}
