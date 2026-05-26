import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Worker, UnrecoverableError } from 'bullmq';
import type { Redis as RedisClient } from 'ioredis';
import { ModuleRef } from '@nestjs/core';
import { REDIS_PUBLISHER } from '../../../common/services/redis.service';
import { WEBHOOK_QUEUE_NAME, type WebhookDeliveryJob } from './webhook-delivery.queue';
import type { WebhookDeliveryRunner } from '../services/webhook-delivery-runner.service';

/**
 * Section 6 — BullMQ worker that actually does the outbound POST.
 *
 * Like the publisher worker, business logic lives in the runner service so
 * tests can drive it without spinning up the Worker.
 */
@Injectable()
export class WebhookDeliveryProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebhookDeliveryProcessor.name);
  private worker: Worker<WebhookDeliveryJob> | null = null;

  constructor(
    @Inject(REDIS_PUBLISHER) private readonly connection: RedisClient,
    private readonly moduleRef: ModuleRef,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<WebhookDeliveryJob>(
      WEBHOOK_QUEUE_NAME,
      async (job) => {
        const runner = this.moduleRef.get<WebhookDeliveryRunner>('WebhookDeliveryRunner', {
          strict: false,
        });
        await runner.run(job.data.delivery_id, job.attemptsMade);
      },
      {
        connection: this.connection,
        concurrency: 10,
      },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.warn(
        `webhook delivery ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts.attempts}): ${err.message}`,
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  static readonly UnrecoverableError = UnrecoverableError;
}
