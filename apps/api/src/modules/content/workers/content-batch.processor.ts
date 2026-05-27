import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Worker } from 'bullmq';
import type { Redis as RedisClient } from 'ioredis';
import { ModuleRef } from '@nestjs/core';
import { REDIS_PUBLISHER } from '../../../common/services/redis.service';
import { CONTENT_BATCH_QUEUE_NAME, type ContentBatchJobPayload } from './content-batch.queue';
import type { ContentBatchRunnerService } from '../services/content-batch-runner.service';

@Injectable()
export class ContentBatchProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ContentBatchProcessor.name);
  private worker: Worker<ContentBatchJobPayload> | null = null;

  constructor(
    @Inject(REDIS_PUBLISHER) private readonly connection: RedisClient,
    private readonly moduleRef: ModuleRef,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<ContentBatchJobPayload>(
      CONTENT_BATCH_QUEUE_NAME,
      async (job) => {
        const runner = this.moduleRef.get<ContentBatchRunnerService>('ContentBatchRunnerService', {
          strict: false,
        });
        await runner.run(job.data.batch_job_id);
      },
      { connection: this.connection, concurrency: 1 },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`content batch ${job?.data.batch_job_id} crashed: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
