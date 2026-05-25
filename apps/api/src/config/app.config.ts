import { registerAs } from '@nestjs/config';

/** Section 13 — environment-driven app config. No hard-coded domains. */
export const appConfig = registerAs('app', () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3005', 10),
  appUrl: process.env.APP_URL ?? 'http://localhost:3006',
  apiUrl: process.env.API_URL ?? 'http://localhost:3005',
  publicAppName: process.env.PUBLIC_APP_NAME ?? 'MKT SEO AI',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3006')
    .split(',')
    .map((s) => s.trim()),
  logLevel: process.env.LOG_LEVEL ?? 'debug',
}));
