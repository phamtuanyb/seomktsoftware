import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import Redis, { type Redis as RedisClient } from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';
export const REDIS_PUBLISHER = 'REDIS_PUBLISHER';
export const REDIS_SUBSCRIBER = 'REDIS_SUBSCRIBER';

/**
 * Wraps a primary ioredis connection. EventBusService uses dedicated
 * pub/sub connections (Redis requires that, see Section 12).
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly client: RedisClient,
    @Inject(REDIS_PUBLISHER) private readonly publisher: RedisClient,
    @Inject(REDIS_SUBSCRIBER) private readonly subscriber: RedisClient,
  ) {}

  getClient(): RedisClient {
    return this.client;
  }

  getPublisher(): RedisClient {
    return this.publisher;
  }

  getSubscriber(): RedisClient {
    return this.subscriber;
  }

  async ping(): Promise<boolean> {
    try {
      const pong = await this.client.ping();
      return pong === 'PONG';
    } catch (err) {
      this.logger.error('Redis ping failed', err);
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([this.client.quit(), this.publisher.quit(), this.subscriber.quit()]);
  }
}

export function createRedisClient(config: ConfigService): RedisClient {
  const url = config.get<string>('redis.url') ?? 'redis://localhost:6379';
  return new Redis(url, {
    maxRetriesPerRequest: null, // BullMQ requires null
    enableReadyCheck: true,
    lazyConnect: false,
  });
}
