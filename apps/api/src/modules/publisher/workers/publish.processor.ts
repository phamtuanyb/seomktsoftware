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
import { PUBLISH_QUEUE_NAME, type PublishJobPayload } from './publish.queue';
import type { PublisherService } from '../services/publisher.service';

/**
 * Section 8 TN8 — BullMQ worker that processes queued publish jobs.
 *
 * The actual work (load article + site, call adapter, persist result)
 * lives in PublisherService.runJob so it stays testable without spinning
 * up a real Worker. This file just wires the Worker → service.
 *
 * Why `ModuleRef.get`: PublishProcessor + PublisherService form a cycle
 * (service.enqueue calls queue → worker calls service). Lazy resolve
 * avoids the import-time dependency.
 */
@Injectable()
export class PublishProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PublishProcessor.name);
  private worker: Worker<PublishJobPayload> | null = null;

  constructor(
    @Inject(REDIS_PUBLISHER) private readonly connection: RedisClient,
    private readonly moduleRef: ModuleRef,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<PublishJobPayload>(
      PUBLISH_QUEUE_NAME,
      async (job) => {
        const service = this.moduleRef.get<PublisherService>('PublisherService', {
          strict: false,
        });
        await service.runJob(job.data, job.attemptsMade);
      },
      {
        connection: this.connection,
        // 5 concurrent publishes per worker — keeps BullMQ from
        // overwhelming Cloudflare R2 / a single WP site.
        concurrency: 5,
      },
    );

    this.worker.on('completed', (job) =>
      this.logger.log(`publish job ${job.id} completed in ${Date.now() - job.timestamp}ms`),
    );
    this.worker.on('failed', (job, err) => {
      const attempts = job?.attemptsMade ?? 0;
      this.logger.warn(
        `publish job ${job?.id} failed (attempt ${attempts}/${job?.opts.attempts ?? 3}): ${err.message}`,
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  /** Exposed for tests that want to skip the BullMQ round-trip. */
  static readonly UnrecoverableError = UnrecoverableError;
}
