import { Injectable, Logger } from '@nestjs/common';
import type { PrismaService } from './prisma.service';
import type { EventBusService } from './event-bus.service';
import { type QuotaResource } from '@mkt-seo/shared';

export interface QuotaCheckResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  used: number;
  unlimited: boolean;
}

/**
 * Section 10 — quota tracking. Limits stored as `limit_value` in the `quotas` table.
 * Convention: -1 means unlimited.
 *
 * Each resource × period row is guaranteed unique by the DB (idx). Consumers must
 * call `checkQuota` before performing the action; `consumeQuota` only after success.
 */
@Injectable()
export class QuotaService {
  private readonly logger = new Logger(QuotaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async checkQuota(userId: string, resource: QuotaResource, amount = 1): Promise<QuotaCheckResult> {
    const rows = await this.prisma.quota.findMany({
      where: { userId, resource },
    });
    // Sum monthly + lifetime rows — if any row is unlimited or has room, allow.
    let totalLimit = 0;
    let totalUsed = 0;
    let unlimited = false;
    for (const row of rows) {
      if (row.limitValue === -1) {
        unlimited = true;
      } else {
        totalLimit += row.limitValue;
        totalUsed += row.used;
      }
    }
    if (unlimited) {
      return { allowed: true, remaining: Number.MAX_SAFE_INTEGER, limit: -1, used: 0, unlimited };
    }
    const remaining = totalLimit - totalUsed;
    return {
      allowed: remaining >= amount,
      remaining,
      limit: totalLimit,
      used: totalUsed,
      unlimited: false,
    };
  }

  /**
   * Increments the `used` counter on the first matching quota row. Emits
   * `quota.warning` when usage crosses 80 %.
   */
  async consumeQuota(userId: string, resource: QuotaResource, amount = 1): Promise<void> {
    const row = await this.prisma.quota.findFirst({
      where: { userId, resource },
      orderBy: { period: 'asc' },
    });
    if (!row) {
      this.logger.warn(`No quota row for user=${userId} resource=${resource}; skipping consume`);
      return;
    }
    const updated = await this.prisma.quota.update({
      where: { id: row.id },
      data: { used: row.used + amount },
    });
    if (updated.limitValue !== -1 && updated.used / updated.limitValue >= 0.8) {
      await this.eventBus.emit('quota.warning', {
        user_id: userId,
        resource,
        used: updated.used,
        limit: updated.limitValue,
      });
    }
  }

  async resetMonthly(userId: string): Promise<void> {
    await this.prisma.quota.updateMany({
      where: { userId, period: 'monthly' },
      data: { used: 0 },
    });
  }
}
