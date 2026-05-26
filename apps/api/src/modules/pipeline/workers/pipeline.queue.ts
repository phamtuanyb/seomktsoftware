import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { Redis as RedisClient } from 'ioredis';
import { REDIS_PUBLISHER } from '../../../common/services/redis.service';

export const PIPELINE_QUEUE_NAME = 'pipeline';

export interface PipelineJobPayload {
  run_id: string;
  user_id: string;
}

/**
 * Sprint 15 — Section 3 end-to-end orchestrator queue.
 *
 * No internal retry on the BullMQ side: each step inside the runner is
 * idempotent only at the chunk level (e.g. publishing the same article
 * twice is bad), so we surface failures to the user instead of silently
 * retrying.
 */
@Injectable()
export class PipelineQueue implements OnModuleDestroy {
  private readonly queue: Queue<PipelineJobPayload>;

  constructor(@Inject(REDIS_PUBLISHER) connection: RedisClient) {
    this.queue = new Queue<PipelineJobPayload>(PIPELINE_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { age: 7 * 24 * 60 * 60, count: 500 },
        removeOnFail: { age: 30 * 24 * 60 * 60 },
      },
    });
  }

  async enqueue(payload: PipelineJobPayload): Promise<string> {
    const job = await this.queue.add('run', payload, { jobId: payload.run_id });
    return job.id ?? payload.run_id;
  }

  async cancel(runId: string): Promise<boolean> {
    const job = await this.queue.getJob(runId);
    if (!job) return false;
    try {
      // BullMQ refuses to remove a job in `active` state. That's fine for
      // our use case — we still mark the row cancelled and the runner
      // sees the new status before it persists the next step.
      await job.remove();
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
