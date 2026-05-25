import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Redis as RedisClient } from 'ioredis';
import { REDIS_PUBLISHER, REDIS_SUBSCRIBER } from './redis.service';

/**
 * Section 2 principle 4 — Event-Driven. Modules emit named events; subscribers
 * either listen in-process (EventEmitter2 via @OnEvent decorator) or across
 * instances (Redis Pub/Sub). This service publishes to BOTH channels by default
 * so a single @OnEvent handler can fire whether the event came from the local
 * module or another node.
 *
 * Examples of events emitted:
 *   article.created, article.completed, article.published,
 *   publish.failed, brand_voice.trained, quota.warning, keywords.suggested
 */
@Injectable()
export class EventBusService implements OnModuleInit {
  private readonly logger = new Logger(EventBusService.name);
  private readonly channel = 'mkt-seo-events';

  constructor(
    private readonly emitter: EventEmitter2,
    @Inject(REDIS_PUBLISHER) private readonly publisher: RedisClient,
    @Inject(REDIS_SUBSCRIBER) private readonly subscriber: RedisClient,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.subscriber.subscribe(this.channel);
    this.subscriber.on('message', (chan, raw) => {
      if (chan !== this.channel) return;
      try {
        const { event, payload, origin } = JSON.parse(raw) as {
          event: string;
          payload: unknown;
          origin: string;
        };
        // Skip our own published messages — emitter has already fired locally.
        if (origin === process.pid.toString()) return;
        this.emitter.emit(event, payload);
      } catch (err) {
        this.logger.error('Failed to parse pub/sub message', err);
      }
    });
  }

  /** Emit an event locally AND fan out to other nodes via Redis. */
  async emit<T = unknown>(event: string, payload: T): Promise<void> {
    this.emitter.emit(event, payload);
    await this.publisher.publish(
      this.channel,
      JSON.stringify({ event, payload, origin: process.pid.toString() }),
    );
  }
}
