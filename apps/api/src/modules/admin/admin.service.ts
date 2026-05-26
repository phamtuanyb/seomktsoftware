import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import { ErrorCode, type PlanTier } from '@mkt-seo/shared';
import { PrismaService } from '../../common/services/prisma.service';
import type {
  ListUsersQueryDto,
  OverrideQuotaDto,
  OverrideSubscriptionDto,
  UpdateUserDto,
} from './dto/admin.dto';

export interface AdminUserListItem {
  id: string;
  email: string;
  name: string | null;
  role: string;
  plan: string;
  email_verified: boolean;
  created_at: string;
  deleted_at: string | null;
  stats: {
    articles: number;
    keywords: number;
    sites: number;
    brand_voices: number;
    images: number;
  };
}

export interface AdminUserDetail extends AdminUserListItem {
  phone: string | null;
  avatar_url: string | null;
  preferences_json: Record<string, unknown>;
  updated_at: string;
  subscriptions: Array<{
    id: string;
    plan: string;
    status: string;
    started_at: string;
    expires_at: string | null;
    created_at: string;
  }>;
  quotas: Array<{
    resource: string;
    period: string;
    limit_value: number;
    used: number;
    reset_at: string | null;
  }>;
  recent_audit_logs: Array<{
    action: string;
    resource_type: string | null;
    resource_id: string | null;
    created_at: string;
    metadata_json: Record<string, unknown> | null;
  }>;
}

/**
 * Sprint 12 — Admin module backing.
 *
 * Multi-tenancy note: unlike the per-user services, AdminService deliberately
 * does NOT filter by `req.user.id`. Authorization happens up the stack via
 * `@Roles('admin')` + RolesGuard; once we reach this class we trust the
 * caller is a superuser and let them touch any row. Every mutation writes
 * to `audit_logs` so the trail is reconstructable.
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listUsers(query: ListUsersQueryDto): Promise<{
    items: AdminUserListItem[];
    cursor: string | null;
    has_more: boolean;
  }> {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const decoded = query.cursor ? this.decodeCursor(query.cursor) : null;

    const where: {
      role?: string;
      OR?: Array<{
        email?: { contains: string; mode: 'insensitive' };
        name?: { contains: string; mode: 'insensitive' };
      }>;
      AND?: Array<{ createdAt: { lt: Date } }>;
    } = {};
    if (query.role) where.role = query.role;
    if (query.q) {
      where.OR = [
        { email: { contains: query.q, mode: 'insensitive' } },
        { name: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    if (decoded) where.AND = [{ createdAt: { lt: decoded.createdAt } }];

    const rows = await this.prisma.user.findMany({
      where,
      include: {
        subscriptions: { where: { status: 'active' }, orderBy: { startedAt: 'desc' }, take: 1 },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    // Optional plan filter applied post-query (because plan resolution depends on subscription state).
    let filtered = rows;
    if (query.plan) {
      filtered = rows.filter((r) => this.resolvePlan(r.subscriptions[0]) === query.plan);
    }

    const hasMore = filtered.length > limit;
    const page = hasMore ? filtered.slice(0, limit) : filtered;

    // Counts in one round trip: groupBy across all child tables in parallel.
    const userIds = page.map((u) => u.id);
    const [articles, keywords, sites, brandVoices, images] = await Promise.all([
      this.prisma.article.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, deletedAt: null },
        _count: true,
      }),
      this.prisma.keyword.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds } },
        _count: true,
      }),
      this.prisma.site.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, deletedAt: null },
        _count: true,
      }),
      this.prisma.brandVoice.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, deletedAt: null },
        _count: true,
      }),
      this.prisma.image.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds } },
        _count: true,
      }),
    ]);

    const countOf = (arr: Array<{ userId: string; _count: number }>, id: string) =>
      arr.find((a) => a.userId === id)?._count ?? 0;

    const items: AdminUserListItem[] = page.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      plan: this.resolvePlan(u.subscriptions[0]),
      email_verified: Boolean(u.emailVerifiedAt),
      created_at: u.createdAt.toISOString(),
      deleted_at: u.deletedAt ? u.deletedAt.toISOString() : null,
      stats: {
        articles: countOf(articles, u.id),
        keywords: countOf(keywords, u.id),
        sites: countOf(sites, u.id),
        brand_voices: countOf(brandVoices, u.id),
        images: countOf(images, u.id),
      },
    }));

    const last = page.at(-1);
    return {
      items,
      cursor: hasMore && last ? this.encodeCursor(last.createdAt) : null,
      has_more: hasMore,
    };
  }

  async getUser(userId: string): Promise<AdminUserDetail> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Không tìm thấy người dùng',
      });
    }
    const [subscriptions, quotas, articles, keywords, sites, brandVoices, images, auditLogs] =
      await Promise.all([
        this.prisma.subscription.findMany({ where: { userId }, orderBy: { startedAt: 'desc' } }),
        this.prisma.quota.findMany({ where: { userId } }),
        this.prisma.article.count({ where: { userId, deletedAt: null } }),
        this.prisma.keyword.count({ where: { userId } }),
        this.prisma.site.count({ where: { userId, deletedAt: null } }),
        this.prisma.brandVoice.count({ where: { userId, deletedAt: null } }),
        this.prisma.image.count({ where: { userId } }),
        this.prisma.auditLog.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
      ]);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      avatar_url: user.avatarUrl,
      role: user.role,
      plan: this.resolvePlan(subscriptions[0]),
      email_verified: Boolean(user.emailVerifiedAt),
      preferences_json: (user.preferencesJson as Record<string, unknown>) ?? {},
      created_at: user.createdAt.toISOString(),
      updated_at: user.updatedAt.toISOString(),
      deleted_at: user.deletedAt ? user.deletedAt.toISOString() : null,
      stats: {
        articles,
        keywords,
        sites,
        brand_voices: brandVoices,
        images,
      },
      subscriptions: subscriptions.map((s) => ({
        id: s.id,
        plan: s.plan,
        status: s.status,
        started_at: s.startedAt.toISOString(),
        expires_at: s.expiresAt ? s.expiresAt.toISOString() : null,
        created_at: s.createdAt.toISOString(),
      })),
      quotas: quotas.map((q) => ({
        resource: q.resource,
        period: q.period,
        limit_value: q.limitValue,
        used: q.used,
        reset_at: q.resetAt ? q.resetAt.toISOString() : null,
      })),
      recent_audit_logs: auditLogs.map((a) => ({
        action: a.action,
        resource_type: a.resourceType,
        resource_id: a.resourceId,
        created_at: a.createdAt.toISOString(),
        metadata_json: (a.metadataJson as Record<string, unknown> | null) ?? null,
      })),
    };
  }

  async updateUser(
    adminId: string,
    userId: string,
    dto: UpdateUserDto,
    context: { ip?: string; ua?: string } = {},
  ): Promise<AdminUserDetail> {
    if (adminId === userId && dto.role === 'user') {
      // Stop an admin from accidentally demoting themselves and locking everyone out.
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Admin không thể tự demote chính mình. Nhờ admin khác thực hiện.',
      });
    }

    const before = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!before) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Không tìm thấy người dùng',
      });
    }

    const data: {
      role?: string;
      emailVerifiedAt?: Date | null;
      deletedAt?: Date | null;
    } = {};
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.email_verified !== undefined) {
      data.emailVerifiedAt = dto.email_verified ? (before.emailVerifiedAt ?? new Date()) : null;
    }
    if (dto.soft_delete !== undefined) {
      data.deletedAt = dto.soft_delete ? new Date() : null;
    }

    await this.prisma.user.update({ where: { id: userId }, data });

    await this.writeAudit(adminId, 'admin.user.update', 'user', userId, {
      changes: dto,
      before: {
        role: before.role,
        email_verified: Boolean(before.emailVerifiedAt),
        deleted: Boolean(before.deletedAt),
      },
      ip: context.ip,
      ua: context.ua,
    });

    return this.getUser(userId);
  }

  async overrideSubscription(
    adminId: string,
    userId: string,
    dto: OverrideSubscriptionDto,
    context: { ip?: string; ua?: string } = {},
  ): Promise<AdminUserDetail> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Không tìm thấy người dùng',
      });
    }

    const expiresAt = dto.expires_at ? new Date(dto.expires_at) : null;
    if (dto.expires_at && Number.isNaN(expiresAt!.getTime())) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'expires_at không phải ngày hợp lệ',
      });
    }

    // Section 7 — keep history. Mark the current active sub as cancelled, insert a new active row.
    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.updateMany({
        where: { userId, status: 'active' },
        data: { status: 'cancelled' },
      });
      await tx.subscription.create({
        data: {
          id: uuidv7(),
          userId,
          plan: dto.plan,
          status: dto.status ?? 'active',
          startedAt: new Date(),
          expiresAt,
          metadataJson: {
            ...(dto.metadata ?? {}),
            admin_override: true,
            overridden_by: adminId,
          },
        },
      });
    });

    await this.writeAudit(adminId, 'admin.subscription.override', 'user', userId, {
      plan: dto.plan,
      status: dto.status ?? 'active',
      expires_at: dto.expires_at ?? null,
      metadata: dto.metadata ?? null,
      ip: context.ip,
      ua: context.ua,
    });

    return this.getUser(userId);
  }

  async overrideQuota(
    adminId: string,
    userId: string,
    dto: OverrideQuotaDto,
    context: { ip?: string; ua?: string } = {},
  ): Promise<AdminUserDetail> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Không tìm thấy người dùng',
      });
    }

    const existing = await this.prisma.quota.findUnique({
      where: {
        userId_resource_period: {
          userId,
          resource: dto.resource,
          period: dto.period,
        },
      },
    });

    if (existing) {
      await this.prisma.quota.update({
        where: { id: existing.id },
        data: {
          limitValue: dto.limit_value,
          used: dto.reset_used ? 0 : existing.used,
        },
      });
    } else {
      await this.prisma.quota.create({
        data: {
          id: uuidv7(),
          userId,
          resource: dto.resource,
          period: dto.period,
          limitValue: dto.limit_value,
          used: 0,
        },
      });
    }

    await this.writeAudit(adminId, 'admin.quota.override', 'user', userId, {
      resource: dto.resource,
      period: dto.period,
      limit_value: dto.limit_value,
      reset_used: Boolean(dto.reset_used),
      ip: context.ip,
      ua: context.ua,
    });

    return this.getUser(userId);
  }

  /** Dashboard counts — light, no aggregations expensive enough to need caching yet. */
  async getStats(): Promise<{
    users: { total: number; active_last_30d: number; deleted: number };
    plans: Record<string, number>;
    articles: { total: number; last_30d: number };
    publish_jobs: { total: number; succeeded: number; failed: number; pending: number };
  }> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      deletedUsers,
      activeRecent,
      activeSubs,
      totalArticles,
      recentArticles,
      jobsByStatus,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { NOT: { deletedAt: null } } }),
      this.prisma.article
        .groupBy({
          by: ['userId'],
          where: { createdAt: { gte: thirtyDaysAgo } },
          _count: true,
        })
        .then((r) => r.length),
      this.prisma.subscription.findMany({
        where: { status: 'active' },
        select: { plan: true, userId: true },
      }),
      this.prisma.article.count({ where: { deletedAt: null } }),
      this.prisma.article.count({
        where: { deletedAt: null, createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.publishJob.groupBy({ by: ['status'], _count: true }),
    ]);

    // De-duplicate active subs by userId (latest plan only).
    const planByUser = new Map<string, string>();
    for (const s of activeSubs) planByUser.set(s.userId, s.plan);
    const plans: Record<string, number> = {};
    for (const plan of planByUser.values()) {
      plans[plan] = (plans[plan] ?? 0) + 1;
    }
    // Users without an active sub fall into trial.
    plans['trial'] = (plans['trial'] ?? 0) + Math.max(0, totalUsers - planByUser.size);

    const jobByStatus = (s: string) => jobsByStatus.find((j) => j.status === s)?._count ?? 0;

    return {
      users: { total: totalUsers, active_last_30d: activeRecent, deleted: deletedUsers },
      plans,
      articles: { total: totalArticles, last_30d: recentArticles },
      publish_jobs: {
        total: jobsByStatus.reduce((sum, j) => sum + j._count, 0),
        succeeded: jobByStatus('succeeded'),
        failed: jobByStatus('failed'),
        pending: jobByStatus('pending') + jobByStatus('processing') + jobByStatus('queued'),
      },
    };
  }

  // ----- helpers -----

  private resolvePlan(sub: { plan: string; expiresAt: Date | null } | undefined): PlanTier {
    if (!sub) return 'trial';
    if (sub.expiresAt && sub.expiresAt < new Date()) return 'trial';
    return sub.plan as PlanTier;
  }

  private encodeCursor(createdAt: Date): string {
    return Buffer.from(createdAt.toISOString()).toString('base64url');
  }

  private decodeCursor(cursor: string): { createdAt: Date } | null {
    try {
      const d = new Date(Buffer.from(cursor, 'base64url').toString('utf8'));
      return Number.isNaN(d.getTime()) ? null : { createdAt: d };
    } catch {
      return null;
    }
  }

  private async writeAudit(
    actorId: string,
    action: string,
    resourceType: string | null,
    resourceId: string | null,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          id: uuidv7(),
          userId: actorId,
          action,
          resourceType,
          resourceId,
          ipAddress: (metadata.ip as string | undefined) ?? null,
          userAgent: (metadata.ua as string | undefined) ?? null,
          metadataJson: metadata as object,
        },
      });
    } catch (err) {
      this.logger.warn(`audit log write failed for ${action}: ${(err as Error).message}`);
    }
  }
}
