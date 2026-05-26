import * as Sentry from '@sentry/node';

/**
 * Sprint 10.5 — Sentry init. Opt-in: when SENTRY_DSN is missing or a
 * placeholder, the SDK is never initialized so dev/CI run cost-free.
 *
 * NestJS catches exceptions through HttpExceptionFilter — we call
 * Sentry.captureException there instead of relying on the default
 * domain-based instrumentation, which is brittle with Express middleware.
 */
let initialized = false;

export function initSentry(): boolean {
  if (initialized) return true;
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn || dsn.startsWith('sentry-placeholder') || dsn === 'your_sentry_dsn_here') {
    return false;
  }
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.SENTRY_RELEASE,
    // Section 14 — keep sample rates low; PRs can dial up via env if needed.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    profilesSampleRate: 0,
    // Don't ship PII; we already log user_id via pino so traces can be
    // correlated without sending emails/IPs to Sentry.
    sendDefaultPii: false,
    integrations: [],
    beforeSend(event) {
      // Drop 4xx — those are user errors, not bugs.
      const status = (event.contexts?.response as { status_code?: number } | undefined)
        ?.status_code;
      if (status && status >= 400 && status < 500) return null;
      return event;
    },
  });
  initialized = true;
  return true;
}

export function isSentryEnabled(): boolean {
  return initialized;
}

export function captureException(
  err: unknown,
  ctx?: { userId?: string; path?: string; status?: number },
): void {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    if (ctx?.userId) scope.setUser({ id: ctx.userId });
    if (ctx?.path) scope.setTag('http.path', ctx.path);
    if (ctx?.status) scope.setTag('http.status', String(ctx.status));
    Sentry.captureException(err);
  });
}

export { Sentry };
