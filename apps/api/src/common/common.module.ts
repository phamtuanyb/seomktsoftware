import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaService } from './services/prisma.service';
import {
  REDIS_CLIENT,
  REDIS_PUBLISHER,
  REDIS_SUBSCRIBER,
  RedisService,
  createRedisClient,
} from './services/redis.service';
import { EventBusService } from './services/event-bus.service';
import { QuotaService } from './services/quota.service';

/**
 * Global infra services shared by every feature module:
 * Prisma, Redis (1 primary + 1 publisher + 1 subscriber), EventBus, Quota.
 */
@Global()
@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [
    PrismaService,
    {
      provide: REDIS_CLIENT,
      useFactory: (cfg: ConfigService) => createRedisClient(cfg),
      inject: [ConfigService],
    },
    {
      provide: REDIS_PUBLISHER,
      useFactory: (cfg: ConfigService) => createRedisClient(cfg),
      inject: [ConfigService],
    },
    {
      provide: REDIS_SUBSCRIBER,
      useFactory: (cfg: ConfigService) => createRedisClient(cfg),
      inject: [ConfigService],
    },
    RedisService,
    EventBusService,
    QuotaService,
  ],
  exports: [
    PrismaService,
    RedisService,
    REDIS_CLIENT,
    REDIS_PUBLISHER,
    REDIS_SUBSCRIBER,
    EventBusService,
    QuotaService,
  ],
})
export class CommonModule {}
