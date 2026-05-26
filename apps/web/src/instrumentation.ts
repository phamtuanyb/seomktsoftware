// Next.js 15 entry-point for server-side instrumentation. Loaded once on
// server boot. Forwards to the right Sentry config based on runtime.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}
