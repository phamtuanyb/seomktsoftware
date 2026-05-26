import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { Redis as RedisClient } from 'ioredis';
import { REDIS_PUBLISHER } from '../../../common/services/redis.service';

export const WEBHOOK_QUEUE_NAME = 'webhook-delivery';

export interface WebhookDeliveryJob {
  delivery_id: string;
}

/**
 * Section 6 — outgoing webhook delivery queue. Retries follow the same
 * 3-attempt exponential-backoff pattern as TN8 publish jobs so the
 * downstream automation can absorb short network blips.
 */
@Injectable()
export class WebhookDeliveryQueue implements OnModuleDestroy {
  private readonly queue: Queue<WebhookDeliveryJob>;

  constructor(@Inject(REDIS_PUBLISHER) connection: RedisClient) {
    this.queue = new Queue<WebhookDeliveryJob>(WEBHOOK_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
        removeOnFail: { age: 7 * 24 * 60 * 60 },
      },
    });
  }

  async enqueue(payload: WebhookDeliveryJob): Promise<string> {
    const job = await this.queue.add('deliver', payload, { jobId: payload.delivery_id });
    return job.id ?? payload.delivery_id;
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
