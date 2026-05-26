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
import { PIPELINE_QUEUE_NAME, type PipelineJobPayload } from './pipeline.queue';
import type { PipelineRunnerService } from '../services/pipeline-runner.service';

/**
 * Sprint 15 — BullMQ worker driving the pipeline runner.
 *
 * Concurrency is 2: each run can spend ~minute(s) of LLM time, and the
 * downstream services already have their own concurrency caps, so we
 * intentionally don't over-subscribe here.
 */
@Injectable()
export class PipelineProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PipelineProcessor.name);
  private worker: Worker<PipelineJobPayload> | null = null;

  constructor(
    @Inject(REDIS_PUBLISHER) private readonly connection: RedisClient,
    private readonly moduleRef: ModuleRef,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<PipelineJobPayload>(
      PIPELINE_QUEUE_NAME,
      async (job) => {
        const runner = this.moduleRef.get<PipelineRunnerService>('PipelineRunnerService', {
          strict: false,
        });
        await runner.run(job.data.run_id);
      },
      {
        connection: this.connection,
        concurrency: 2,
      },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`pipeline run ${job?.data.run_id} crashed: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
