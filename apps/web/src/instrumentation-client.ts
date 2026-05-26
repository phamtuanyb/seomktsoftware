// Next.js 15 — browser-side instrumentation entry. Loaded automatically by
// the framework when present. Lazy-imports Sentry only if DSN is configured.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
if (dsn && !dsn.startsWith('sentry-placeholder')) {
  void import('../sentry.client.config');
}
