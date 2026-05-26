// Sprint 10.5 — Node.js side Sentry init (route handlers, server components,
// middleware). Reuses the same SENTRY_DSN as the API but lives in the web
// process so server-rendered errors are captured.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN?.trim();

if (dsn && !dsn.startsWith('sentry-placeholder')) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    sendDefaultPii: false,
  });
}
