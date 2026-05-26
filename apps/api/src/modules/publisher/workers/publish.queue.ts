import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { Redis as RedisClient } from 'ioredis';
import { Inject } from '@nestjs/common';
import { REDIS_PUBLISHER } from '../../../common/services/redis.service';

export const PUBLISH_QUEUE_NAME = 'publish';

export interface PublishJobPayload {
  publish_job_id: string;
  user_id: string;
}

/**
 * Wraps the BullMQ Queue instance. Section 8 TN8 ships retry/backoff on
 * the Worker side; here we only enqueue (`add`) with an optional delay
 * for scheduled posts and respect Section 8 TN8 acceptance "Schedule sai
 * số <30s".
 */
@Injectable()
export class PublishQueue implements OnModuleDestroy {
  private readonly queue: Queue<PublishJobPayload>;

  constructor(@Inject(REDIS_PUBLISHER) connection: RedisClient) {
    this.queue = new Queue<PublishJobPayload>(PUBLISH_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        // Section 8 TN8: "retry 3 lần (exponential backoff 2s/4s/8s)".
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 7 * 24 * 60 * 60, count: 1000 },
        removeOnFail: { age: 30 * 24 * 60 * 60 },
      },
    });
  }

  async enqueue(payload: PublishJobPayload, delayMs = 0): Promise<string> {
    const job = await this.queue.add('publish', payload, {
      delay: delayMs > 0 ? delayMs : undefined,
      jobId: payload.publish_job_id,
    });
    return job.id ?? payload.publish_job_id;
  }

  async cancel(publishJobId: string): Promise<boolean> {
    const job = await this.queue.getJob(publishJobId);
    if (!job) return false;
    await job.remove();
    return true;
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
