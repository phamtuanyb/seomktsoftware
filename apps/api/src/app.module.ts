import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TerminusModule } from '@nestjs/terminus';
import { ThrottlerGuard, ThrottlerModule, type ThrottlerOptions } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { CommonModule } from './common/common.module';
import {
  HttpExceptionFilter,
  LoggingInterceptor,
  PrismaExceptionFilter,
  TransformResponseInterceptor,
} from './common';
import { appConfig, databaseConfig, redisConfig, jwtConfig, aiConfig } from './config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { BillingModule } from './modules/billing/billing.module';
import { KeywordsModule } from './modules/keywords/keywords.module';
import { ContentModule } from './modules/content/content.module';
import { BrandVoicesModule } from './modules/brand-voices/brand-voices.module';
import { ImagesModule } from './modules/images/images.module';
import { AuditModule } from './modules/audit/audit.module';
import { PublisherModule } from './modules/publisher/publisher.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { PluginsModule } from './modules/plugins/plugins.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig, databaseConfig, redisConfig, jwtConfig, aiConfig],
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        pinoHttp: {
          level: cfg.get<string>('app.logLevel') ?? 'debug',
          transport:
            cfg.get<string>('app.env') === 'production'
              ? undefined
              : { target: 'pino-pretty', options: { colorize: true, singleLine: true } },
          autoLogging: true,
          customProps: (req) => {
            const u = (req as unknown as { user?: { id?: string } }).user;
            return u?.id ? { user_id: u.id } : {};
          },
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: () =>
        ({
          throttlers: [{ name: 'default', ttl: 60_000, limit: 60 }],
        }) as { throttlers: ThrottlerOptions[] },
    }),
    ScheduleModule.forRoot(),
    TerminusModule,
    CommonModule,
    AuthModule,
    UsersModule,
    BillingModule,
    KeywordsModule,
    ContentModule,
    BrandVoicesModule,
    ImagesModule,
    AuditModule,
    PublisherModule,
    WebhooksModule,
    PluginsModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformResponseInterceptor },
  ],
})
export class AppModule {}
