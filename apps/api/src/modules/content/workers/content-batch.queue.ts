import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { Redis as RedisClient } from 'ioredis';
import { REDIS_PUBLISHER } from '../../../common/services/redis.service';

export const CONTENT_BATCH_QUEUE_NAME = 'content-batch';

export interface ContentBatchJobPayload {
  batch_job_id: string;
  user_id: string;
}

@Injectable()
export class ContentBatchQueue implements OnModuleDestroy {
  private readonly queue: Queue<ContentBatchJobPayload>;

  constructor(@Inject(REDIS_PUBLISHER) connection: RedisClient) {
    this.queue = new Queue<ContentBatchJobPayload>(CONTENT_BATCH_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { age: 7 * 24 * 60 * 60, count: 500 },
        removeOnFail: { age: 30 * 24 * 60 * 60 },
      },
    });
  }

  async enqueue(payload: ContentBatchJobPayload): Promise<string> {
    const job = await this.queue.add('run', payload, { jobId: payload.batch_job_id });
    return job.id ?? payload.batch_job_id;
  }

  async cancel(batchJobId: string): Promise<boolean> {
    const job = await this.queue.getJob(batchJobId);
    if (!job) return false;
    try {
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
