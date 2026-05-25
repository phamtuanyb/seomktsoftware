import type { ApiResponseBody } from '@mkt-seo/shared';

/**
 * Browser-side API client.
 *
 * - Same-origin: all calls go through `/api/proxy/*` which Next.js rewrites
 *   to the NestJS backend. That keeps the access token in an httpOnly cookie
 *   and avoids CORS.
 * - Server components hit `apiUrl` directly via `fetch` with the cookie
 *   forwarded by Next.
 */
const SAME_ORIGIN_PREFIX = '/api/proxy/v1';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ApiClientOptions {
  baseUrl?: string;
  /** Forwarded automatically in the browser, set explicitly from server components. */
  headers?: Record<string, string>;
}

async function unwrap<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as ApiResponseBody<T> | null;
  if (!res.ok || !body || body.success === false) {
    const err = body && body.success === false ? body.error : undefined;
    throw new ApiError(
      res.status,
      err?.code ?? 'UNKNOWN',
      err?.message ?? `Request failed: ${res.status}`,
      err?.details,
    );
  }
  return body.data;
}

export function createApi(opts: ApiClientOptions = {}) {
  const base = opts.baseUrl ?? SAME_ORIGIN_PREFIX;
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers ?? {}),
  };

  async function call<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
    const { json, headers, ...rest } = init;
    const res = await fetch(`${base}${path}`, {
      ...rest,
      headers: {
        ...defaultHeaders,
        ...(headers as Record<string, string> | undefined),
      },
      body: json !== undefined ? JSON.stringify(json) : init.body,
      credentials: 'include',
    });
    return unwrap<T>(res);
  }

  return {
    get: <T>(path: string, init?: RequestInit) => call<T>(path, { ...init, method: 'GET' }),
    post: <T>(path: string, json?: unknown, init?: RequestInit) =>
      call<T>(path, { ...init, method: 'POST', json }),
    patch: <T>(path: string, json?: unknown, init?: RequestInit) =>
      call<T>(path, { ...init, method: 'PATCH', json }),
    delete: <T>(path: string, init?: RequestInit) => call<T>(path, { ...init, method: 'DELETE' }),
  };
}

export const api = createApi();
