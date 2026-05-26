import { createHmac, randomBytes } from 'node:crypto';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import { ErrorCode } from '@mkt-seo/shared';
import { PrismaService } from '../../../common/services/prisma.service';
import {
  type CreateWebhookDto,
  type UpdateWebhookDto,
  type WebhookEvent,
} from '../dto/webhook.dto';
import { WebhookDeliveryQueue } from '../workers/webhook-delivery.queue';

export interface WebhookListItem {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WebhookDetail extends WebhookListItem {
  /** Returned ONCE on create — never re-shown so secrets stay opaque. */
  secret?: string;
  /** Indicates secret exists but is not exposed. */
  has_secret: boolean;
}

export interface WebhookDeliveryRow {
  id: string;
  webhook_id: string;
  event: string;
  payload_json: unknown;
  response_status: number | null;
  response_body: string | null;
  attempt_count: number;
  delivered_at: string | null;
  created_at: string;
}

/**
 * Section 6 + Section 17 — outgoing webhooks.
 *
 * - CRUD is multi-tenant: every read filters by userId.
 * - HMAC-SHA256 signature (header `X-MKT-Signature: sha256=<hex>`) lets
 *   consumers verify payload integrity per Section 17.
 * - Delivery is async via BullMQ so the request that emitted the event
 *   never blocks on the downstream HTTP call.
 */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: WebhookDeliveryQueue,
  ) {}

  async list(userId: string): Promise<WebhookListItem[]> {
    const rows = await this.prisma.webhook.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toListItem(r));
  }

  async create(userId: string, dto: CreateWebhookDto): Promise<WebhookDetail> {
    const secret = dto.secret ?? this.generateSecret();
    const created = await this.prisma.webhook.create({
      data: {
        id: uuidv7(),
        userId,
        url: dto.url,
        events: dto.events,
        secret,
        isActive: true,
      },
    });
    return {
      ...this.toListItem(created),
      // Only expose the secret on the create response — rotates require PATCH.
      secret,
      has_secret: true,
    };
  }

  async get(userId: string, id: string): Promise<WebhookDetail> {
    const row = await this.prisma.webhook.findFirst({ where: { id, userId } });
    if (!row) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Không tìm thấy webhook',
      });
    }
    return { ...this.toListItem(row), has_secret: Boolean(row.secret) };
  }

  async update(userId: string, id: string, dto: UpdateWebhookDto): Promise<WebhookDetail> {
    await this.get(userId, id);
    const updated = await this.prisma.webhook.update({
      where: { id },
      data: {
        url: dto.url,
        events: dto.events,
        secret: dto.secret,
        isActive: dto.is_active,
      },
    });
    return {
      ...this.toListItem(updated),
      // Return the rotated secret once if the caller updated it.
      secret: dto.secret,
      has_secret: Boolean(updated.secret),
    };
  }

  async remove(userId: string, id: string): Promise<{ id: string }> {
    await this.get(userId, id);
    await this.prisma.webhook.delete({ where: { id } });
    return { id };
  }

  async listDeliveries(
    userId: string,
    webhookId: string,
    limit = 50,
  ): Promise<WebhookDeliveryRow[]> {
    await this.get(userId, webhookId); // ownership check
    const rows = await this.prisma.webhookDelivery.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
    return rows.map((r) => ({
      id: r.id,
      webhook_id: r.webhookId,
      event: r.event,
      payload_json: r.payloadJson,
      response_status: r.responseStatus,
      response_body: r.responseBody,
      attempt_count: r.attemptCount,
      delivered_at: r.deliveredAt ? r.deliveredAt.toISOString() : null,
      created_at: r.createdAt.toISOString(),
    }));
  }

  /**
   * POST /webhooks/:id/test — enqueue a synthetic event so the user can
   * verify their endpoint without waiting for real activity.
   */
  async sendTest(userId: string, id: string): Promise<{ delivery_id: string }> {
    const webhook = await this.prisma.webhook.findFirst({ where: { id, userId } });
    if (!webhook) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Không tìm thấy webhook',
      });
    }
    if (!webhook.isActive) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Webhook đang bị tắt — bật lại trước khi test.',
      });
    }
    const deliveryId = await this.enqueueDelivery(webhook, 'webhook.test', {
      message: 'This is a test delivery from MKT SEO AI.',
      timestamp: new Date().toISOString(),
    });
    return { delivery_id: deliveryId };
  }

  /**
   * Dispatcher entry point — called from the in-process event listeners.
   * Looks up every webhook subscribed to `event`, creates a delivery row,
   * and enqueues a BullMQ job. Errors don't propagate — webhook failures
   * shouldn't ever break the originating business action.
   */
  async dispatchEvent(event: string, payload: unknown): Promise<void> {
    let webhooks;
    try {
      webhooks = await this.prisma.webhook.findMany({
        where: { isActive: true, events: { has: event } },
      });
    } catch (err) {
      this.logger.error(`dispatch lookup failed for ${event}: ${(err as Error).message}`);
      return;
    }
    if (webhooks.length === 0) return;

    await Promise.all(
      webhooks.map(async (wh) => {
        try {
          await this.enqueueDelivery(wh, event, payload);
        } catch (err) {
          this.logger.warn(
            `failed to enqueue delivery for webhook ${wh.id} / ${event}: ${(err as Error).message}`,
          );
        }
      }),
    );
  }

  // ----- helpers -----

  /** Section 17 — HMAC-SHA256 over the raw JSON body, lowercase hex. */
  static signPayload(secret: string, payload: string): string {
    return createHmac('sha256', secret).update(payload).digest('hex');
  }

  /** Public test hook so the worker can sign without grabbing the service. */
  signPayload(secret: string, payload: string): string {
    return WebhooksService.signPayload(secret, payload);
  }

  private generateSecret(): string {
    return `whsec_${randomBytes(24).toString('hex')}`;
  }

  private async enqueueDelivery(
    webhook: { id: string },
    event: string,
    payload: unknown,
  ): Promise<string> {
    const deliveryId = uuidv7();
    await this.prisma.webhookDelivery.create({
      data: {
        id: deliveryId,
        webhookId: webhook.id,
        event,
        payloadJson: (payload as object | null) ?? {},
        attemptCount: 0,
      },
    });
    await this.queue.enqueue({ delivery_id: deliveryId });
    return deliveryId;
  }

  private toListItem(row: {
    id: string;
    url: string;
    events: string[];
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): WebhookListItem {
    return {
      id: row.id,
      url: row.url,
      events: row.events,
      is_active: row.isActive,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    };
  }
}

export type WebhookEventName = WebhookEvent;
