import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'node:path';

// Section 13 — load root .env before Nest boots so Prisma sees DATABASE_URL.
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Sprint 10.5 — init Sentry as early as possible so import-time crashes
// (config errors, missing migrations) reach the dashboard too.
import { initSentry, captureException as captureBootstrap } from './common/observability/sentry';
initSentry();

import { NestFactory, Reflector } from '@nestjs/core';
import {
  ClassSerializerInterceptor,
  RequestMethod,
  ValidationPipe,
  VersioningType,
  type INestApplication,
} from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const cfg = app.get(ConfigService);
  const logger = app.get(Logger);
  app.useLogger(logger);

  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  app.enableCors({
    origin: cfg.get<string[]>('app.corsOrigins') ?? ['http://localhost:3006'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Requested-With'],
  });

  // /health and /docs sit outside the /api prefix for monitoring tooling.
  // /version stays under /api on purpose — it is API metadata, not a probe.
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'docs', method: RequestMethod.GET },
      { path: 'docs-json', method: RequestMethod.GET },
      { path: 'health', method: RequestMethod.GET },
    ],
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  configureSwagger(app, cfg);

  app.enableShutdownHooks();

  const port = cfg.get<number>('app.port') ?? 3005;
  await app.listen(port, '0.0.0.0');
  logger.log(`API listening on http://localhost:${port} (Swagger /docs)`);
}

function configureSwagger(app: INestApplication, cfg: ConfigService): void {
  const config = new DocumentBuilder()
    .setTitle(cfg.get<string>('app.publicAppName') ?? 'MKT SEO AI')
    .setDescription('Section 6 — OpenAPI for the MKT SEO AI backend.')
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'api-key')
    .addServer(cfg.get<string>('app.apiUrl') ?? 'http://localhost:3005')
    .build();
  const doc = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, doc, {
    swaggerOptions: { persistAuthorization: true, displayRequestDuration: true },
    customSiteTitle: 'MKT SEO AI API',
  });
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[bootstrap] failed:', err);
  captureBootstrap(err);
  process.exit(1);
});
