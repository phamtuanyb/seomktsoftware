/**
 * Server-only — talks to the backend API directly (no CORS, no proxy).
 * Used by Next route handlers under app/api/auth/*.
 */

const BACKEND = process.env.API_INTERNAL_URL ?? 'http://localhost:3005';

export async function backendFetch(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<Response> {
  const { json, headers, ...rest } = init;
  return fetch(`${BACKEND}/api${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(headers as Record<string, string> | undefined),
    },
    body: json !== undefined ? JSON.stringify(json) : init.body,
    // Server-side fetch — disable Next's data cache so login/logout always hit the API.
    cache: 'no-store',
  });
}
