import { Injectable } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';
import { PrismaService } from '../../../common/services/prisma.service';
import { WebhooksService } from './webhooks.service';

/**
 * Section 6 — single delivery attempt. Sets timeout per call so a hanging
 * consumer can't pin a worker thread forever. 5xx returns are thrown so
 * BullMQ retries with its configured backoff; 4xx returns are stored but
 * NOT retried (the consumer told us our payload is wrong).
 */
@Injectable()
export class WebhookDeliveryRunner {
  private static readonly TIMEOUT_MS = 10_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly webhooks: WebhooksService,
  ) {}

  async run(deliveryId: string, attemptsMade: number): Promise<void> {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { webhook: true },
    });
    if (!delivery) {
      // Nothing to retry — record was deleted between enqueue and dispatch.
      throw new UnrecoverableError(`Delivery ${deliveryId} not found`);
    }
    const webhook = delivery.webhook;
    if (!webhook.isActive) {
      await this.prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          attemptCount: attemptsMade + 1,
          responseStatus: 0,
          responseBody: 'webhook disabled',
        },
      });
      throw new UnrecoverableError('Webhook is disabled');
    }

    const body = JSON.stringify({
      event: delivery.event,
      delivery_id: delivery.id,
      created_at: delivery.createdAt.toISOString(),
      data: delivery.payloadJson,
    });
    const signature = webhook.secret ? this.webhooks.signPayload(webhook.secret, body) : null;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), WebhookDeliveryRunner.TIMEOUT_MS);
    let status = 0;
    let responseBody = '';
    try {
      const res = await fetch(webhook.url, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'MKT-SEO-AI Webhook/1.0',
          'X-MKT-Event': delivery.event,
          'X-MKT-Delivery': delivery.id,
          ...(signature ? { 'X-MKT-Signature': `sha256=${signature}` } : {}),
        },
        body,
      });
      status = res.status;
      // Truncate response so a megabyte-sized HTML error page doesn't blow up the DB.
      responseBody = (await res.text()).slice(0, 2000);
    } catch (err) {
      status = 0;
      responseBody = (err as Error).message;
    } finally {
      clearTimeout(timer);
    }

    const succeeded = status >= 200 && status < 300;
    const isClientError = status >= 400 && status < 500;

    await this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        attemptCount: attemptsMade + 1,
        responseStatus: status,
        responseBody,
        deliveredAt: succeeded ? new Date() : null,
      },
    });

    if (!succeeded) {
      const err = new Error(`HTTP ${status}: ${responseBody.slice(0, 200)}`);
      if (isClientError) {
        // 4xx — consumer says payload is bad. Retrying won't fix that.
        throw new UnrecoverableError(err.message);
      }
      throw err;
    }
  }
}
