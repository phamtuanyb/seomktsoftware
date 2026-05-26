// Sprint 10.5 — Edge runtime (middleware) Sentry init. Same DSN.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN?.trim();

if (dsn && !dsn.startsWith('sentry-placeholder')) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  });
}
