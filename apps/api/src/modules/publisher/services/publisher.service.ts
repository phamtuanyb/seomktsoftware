import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import { ErrorCode } from '@mkt-seo/shared';
import { PrismaService } from '../../../common/services/prisma.service';
import { RedisService } from '../../../common/services/redis.service';
import { EventBusService } from '../../../common/services/event-bus.service';
import { SitesService } from './sites.service';
import { PublishQueue } from '../workers/publish.queue';
import type {
  PublishArticle,
  PublishOptions,
  PublishStatus,
  SeoPluginName,
} from '../adapters/publisher.interface';
import type { BulkPublishDto, PublishWordpressDto } from '../dto/publish.dto';

export interface PublishJobSummary {
  id: string;
  article_id: string;
  site_id: string;
  status: string;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  wp_post_id: number | null;
  published_url: string | null;
  retry_count: number;
  error_message: string | null;
  error_code: string | null;
  created_at: string;
}

interface RunJobContext {
  publish_job_id: string;
  user_id: string;
}

/**
 * Section 8 TN8 — Publisher orchestrator.
 *
 * 1. enqueueOne / enqueueBulk persists a publish_job row in 'pending'
 *    then pushes onto BullMQ. Scheduling (status='future') uses BullMQ's
 *    delay so the worker doesn't fire before scheduled_at.
 * 2. Bulk rate limit (Section 8 TN8): 10 bài/site/giờ, random delay 2-15s
 *    between consecutive publishes to a single site. Counter lives in
 *    Redis with 1h TTL.
 * 3. runJob (called by PublishProcessor / inline test path):
 *    a. Mark 'processing', stamp started_at.
 *    b. Build PublishArticle from the article row.
 *    c. Call adapter.publish().
 *    d. On success: mark 'completed', persist wp_post_id +
 *       published_url, emit article.published.
 *    e. On throw: mark 'failed' on the final attempt, emit publish.failed.
 *       BullMQ retries with exponential backoff (2s/4s/8s).
 */
@Injectable()
export class PublisherService {
  private readonly logger = new Logger(PublisherService.name);
  private static readonly RATE_LIMIT_PREFIX = 'publish:rl:site:';
  private static readonly RATE_LIMIT_HOURLY = 10;
  private static readonly RATE_LIMIT_TTL_SECONDS = 3600;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly eventBus: EventBusService,
    private readonly sites: SitesService,
    private readonly queue: PublishQueue,
  ) {}

  /** Single publish — returns the persisted job summary + BullMQ id. */
  async enqueueOne(dto: PublishWordpressDto, userId: string): Promise<PublishJobSummary> {
    // Validates ownership of both site + article (multi-tenant).
    const site = await this.sites.get(userId, dto.site_id);
    const article = await this.prisma.article.findFirst({
      where: { id: dto.article_id, userId, deletedAt: null },
    });
    if (!article) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Không tìm thấy bài viết',
      });
    }

    const status: PublishStatus = dto.status ?? 'publish';
    if (status === 'future' && !dto.scheduled_at) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'status="future" yêu cầu scheduled_at',
      });
    }

    await this.assertRateLimit(site.id);

    const scheduledAt = dto.scheduled_at ? new Date(dto.scheduled_at) : null;
    const publishJobId = uuidv7();
    const job = await this.prisma.publishJob.create({
      data: {
        id: publishJobId,
        userId,
        articleId: dto.article_id,
        siteId: site.id,
        status: 'pending',
        scheduledAt,
        payloadJson: {
          status,
          scheduled_at: dto.scheduled_at ?? null,
          categories: dto.categories ?? [],
          tags: dto.tags ?? [],
          featured_image_id: dto.featured_image_id ?? null,
        },
      },
    });

    const delayMs =
      scheduledAt && scheduledAt.getTime() > Date.now() ? scheduledAt.getTime() - Date.now() : 0;
    await this.queue.enqueue({ publish_job_id: publishJobId, user_id: userId }, delayMs);
    await this.bumpRateLimit(site.id);

    return this.toSummary(job);
  }

  /** Section 8 TN8 — Bulk publish with rate-limit + 2-15s random delay between jobs/site. */
  async enqueueBulk(dto: BulkPublishDto, userId: string): Promise<PublishJobSummary[]> {
    const results: PublishJobSummary[] = [];
    const perSiteCounter = new Map<string, number>();
    for (const item of dto.jobs) {
      // Random 2-15s delay AFTER the previous publish to the same site.
      const idx = (perSiteCounter.get(item.site_id) ?? 0) + 1;
      perSiteCounter.set(item.site_id, idx);

      const randomSpacingMs = 2000 + Math.floor(Math.random() * 13_000);
      const baseDelay = (idx - 1) * randomSpacingMs;
      const scheduledAt = item.scheduled_at ? new Date(item.scheduled_at) : null;
      const adjustedScheduledAt = scheduledAt ? scheduledAt : new Date(Date.now() + baseDelay);

      const summary = await this.enqueueOne(
        {
          ...item,
          status: item.status ?? 'publish',
          scheduled_at:
            item.status === 'future'
              ? item.scheduled_at
              : baseDelay > 0
                ? adjustedScheduledAt.toISOString()
                : undefined,
        },
        userId,
      );
      results.push(summary);
    }
    return results;
  }

  async list(
    userId: string,
    filters: { status?: string; site_id?: string } = {},
  ): Promise<PublishJobSummary[]> {
    const rows = await this.prisma.publishJob.findMany({
      where: {
        userId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.site_id ? { siteId: filters.site_id } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map(this.toSummary);
  }

  async get(userId: string, id: string): Promise<PublishJobSummary> {
    const row = await this.prisma.publishJob.findFirst({ where: { id, userId } });
    if (!row) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Không tìm thấy publish job',
      });
    }
    return this.toSummary(row);
  }

  async cancel(userId: string, id: string): Promise<PublishJobSummary> {
    const row = await this.prisma.publishJob.findFirst({ where: { id, userId } });
    if (!row) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Không tìm thấy publish job',
      });
    }
    if (row.status === 'processing' || row.status === 'completed') {
      throw new ForbiddenException({
        code: ErrorCode.RESOURCE_FORBIDDEN,
        message: `Không thể huỷ job đang ở trạng thái ${row.status}`,
      });
    }
    await this.queue.cancel(id);
    const updated = await this.prisma.publishJob.update({
      where: { id },
      data: { status: 'cancelled', completedAt: new Date() },
    });
    return this.toSummary(updated);
  }

  /** Entry point called by PublishProcessor for every BullMQ attempt. */
  async runJob(ctx: RunJobContext, attemptNumber: number): Promise<void> {
    const job = await this.prisma.publishJob.findFirst({ where: { id: ctx.publish_job_id } });
    if (!job) {
      this.logger.warn(`runJob: publish_job ${ctx.publish_job_id} disappeared — skipping`);
      return;
    }

    await this.prisma.publishJob.update({
      where: { id: job.id },
      data: {
        status: 'processing',
        startedAt: job.startedAt ?? new Date(),
        retryCount: attemptNumber,
      },
    });

    try {
      const { adapter, credentials, site } = await this.sites.loadForPublish(
        ctx.user_id,
        job.siteId,
      );
      const article = await this.prisma.article.findFirst({
        where: { id: job.articleId, userId: ctx.user_id, deletedAt: null },
      });
      if (!article) {
        throw new Error('Article không tồn tại');
      }

      // Resolve featured image: explicit dto.featured_image_id → article.featuredImageId → null.
      const payload = (job.payloadJson as Record<string, unknown>) ?? {};
      const featuredImageId =
        (typeof payload.featured_image_id === 'string' && payload.featured_image_id) ||
        article.featuredImageId ||
        null;
      let featuredImage: { url: string; alt: string | null } | null = null;
      if (featuredImageId) {
        const img = await this.prisma.image.findFirst({
          where: { id: featuredImageId, userId: ctx.user_id, deletedAt: null },
        });
        if (img) featuredImage = { url: img.url, alt: img.altText };
      }

      const publishArticle: PublishArticle = {
        title: article.title,
        content_html: article.content ?? '',
        excerpt: article.excerpt,
        meta_title: article.metaTitle,
        meta_description: article.metaDescription,
        target_keyword: article.targetKeyword,
        slug: article.slug,
        featured_image_url: featuredImage?.url,
        featured_image_alt: featuredImage?.alt ?? article.title,
      };

      const opts: PublishOptions = {
        status: (payload.status as PublishStatus | undefined) ?? 'publish',
        scheduled_at: typeof payload.scheduled_at === 'string' ? payload.scheduled_at : undefined,
        categories: Array.isArray(payload.categories) ? (payload.categories as string[]) : [],
        tags: Array.isArray(payload.tags) ? (payload.tags as string[]) : [],
        seo_plugin: (site.pluginSeoDetected as SeoPluginName | null) ?? 'none',
      };

      const result = await adapter.publish(publishArticle, credentials, opts);

      await this.prisma.publishJob.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          wpPostId: typeof result.remote_post_id === 'number' ? result.remote_post_id : null,
          publishedUrl: result.published_url ?? null,
          responseJson: result.raw ? (result.raw as object) : undefined,
        },
      });
      await this.prisma.site.update({
        where: { id: job.siteId },
        data: { lastPublishAt: new Date() },
      });
      await this.eventBus.emit('article.published', {
        article_id: job.articleId,
        publish_job_id: job.id,
        user_id: ctx.user_id,
        published_url: result.published_url,
      });
    } catch (err) {
      const message = (err as Error).message;
      const isFinalAttempt = attemptNumber + 1 >= 3;
      await this.prisma.publishJob.update({
        where: { id: job.id },
        data: {
          status: isFinalAttempt ? 'failed' : 'pending',
          errorMessage: message,
          errorCode: this.classifyError(message),
          retryCount: attemptNumber + 1,
          completedAt: isFinalAttempt ? new Date() : null,
        },
      });
      if (isFinalAttempt) {
        await this.eventBus.emit('publish.failed', {
          publish_job_id: job.id,
          user_id: ctx.user_id,
          article_id: job.articleId,
          error: message,
        });
      }
      throw err;
    }
  }

  // ----- helpers -----

  private async assertRateLimit(siteId: string): Promise<void> {
    const key = PublisherService.RATE_LIMIT_PREFIX + siteId;
    const current = parseInt((await this.redis.getClient().get(key)) ?? '0', 10);
    if (current >= PublisherService.RATE_LIMIT_HOURLY) {
      throw new ForbiddenException({
        code: ErrorCode.RATE_LIMITED,
        message: `Site đã đạt giới hạn ${PublisherService.RATE_LIMIT_HOURLY} publish/giờ`,
        details: { current, limit: PublisherService.RATE_LIMIT_HOURLY },
      });
    }
  }

  private async bumpRateLimit(siteId: string): Promise<void> {
    const key = PublisherService.RATE_LIMIT_PREFIX + siteId;
    const client = this.redis.getClient();
    const newCount = await client.incr(key);
    if (newCount === 1) {
      await client.expire(key, PublisherService.RATE_LIMIT_TTL_SECONDS);
    }
  }

  private classifyError(message: string): string {
    if (/401|unauthor/i.test(message)) return 'WP_AUTH_ERROR';
    if (/ECONN|ENOTFOUND|fetch failed|timeout/i.test(message)) return 'WP_CONNECTION_ERROR';
    return 'WP_PUBLISH_ERROR';
  }

  private toSummary(row: {
    id: string;
    articleId: string;
    siteId: string;
    status: string;
    scheduledAt: Date | null;
    startedAt: Date | null;
    completedAt: Date | null;
    wpPostId: number | null;
    publishedUrl: string | null;
    retryCount: number;
    errorMessage: string | null;
    errorCode: string | null;
    createdAt: Date;
  }): PublishJobSummary {
    return {
      id: row.id,
      article_id: row.articleId,
      site_id: row.siteId,
      status: row.status,
      scheduled_at: row.scheduledAt?.toISOString() ?? null,
      started_at: row.startedAt?.toISOString() ?? null,
      completed_at: row.completedAt?.toISOString() ?? null,
      wp_post_id: row.wpPostId,
      published_url: row.publishedUrl,
      retry_count: row.retryCount,
      error_message: row.errorMessage,
      error_code: row.errorCode,
      created_at: row.createdAt.toISOString(),
    };
  }
}
