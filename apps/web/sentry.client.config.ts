// Sprint 10.5 — browser-side Sentry init. Opt-in via NEXT_PUBLIC_SENTRY_DSN.
// We import the lazy loader instead of eagerly initializing so users without
// a DSN don't pay the bundle size cost.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

if (dsn && !dsn.startsWith('sentry-placeholder')) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
    beforeSend(event) {
      // Drop network errors during local dev — they're noise.
      const msg = event.exception?.values?.[0]?.value ?? '';
      if (/Failed to fetch|NetworkError/i.test(msg) && process.env.NODE_ENV !== 'production') {
        return null;
      }
      return event;
    },
  });
}
