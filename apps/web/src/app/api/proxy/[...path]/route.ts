import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/auth/backend';
import {
  readAccessToken,
  readRefreshToken,
  setAuthCookies,
  clearAuthCookies,
} from '@/lib/auth/session';

/**
 * Catch-all proxy that forwards browser requests to the backend at /api/v1/...
 * Attaches the access token from the httpOnly cookie. If the access token has
 * expired (401), transparently refresh + retry once.
 */

type RouteContext = { params: Promise<{ path: string[] }> };

async function forward(req: Request, ctx: RouteContext, method: string): Promise<Response> {
  const { path } = await ctx.params;
  const target = `/${path.join('/')}${new URL(req.url).search}`;
  const body = method === 'GET' || method === 'DELETE' ? undefined : await req.text();
  return callWithAccessToken(req, target, method, body);
}

async function callWithAccessToken(
  req: Request,
  target: string,
  method: string,
  body: string | undefined,
): Promise<Response> {
  let access = await readAccessToken();
  let res = await backendFetch(target, {
    method,
    headers: buildHeaders(req, access),
    body,
  });

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      access = refreshed;
      res = await backendFetch(target, {
        method,
        headers: buildHeaders(req, access),
        body,
      });
    }
  }
  return passthrough(res);
}

function buildHeaders(req: Request, access: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': req.headers.get('content-type') ?? 'application/json',
  };
  const accept = req.headers.get('accept');
  if (accept) headers.Accept = accept;
  if (access) headers['Authorization'] = `Bearer ${access}`;
  const apiKey = req.headers.get('x-api-key');
  if (apiKey) headers['X-API-Key'] = apiKey;
  return headers;
}

async function tryRefresh(): Promise<string | null> {
  const refresh = await readRefreshToken();
  if (!refresh) return null;
  const res = await backendFetch('/v1/auth/refresh', {
    method: 'POST',
    json: { refresh_token: refresh },
  });
  if (!res.ok) {
    await clearAuthCookies();
    return null;
  }
  const data = await res.json();
  const tokens = data?.data?.tokens;
  if (!tokens) {
    await clearAuthCookies();
    return null;
  }
  await setAuthCookies(tokens);
  return tokens.access_token;
}

async function passthrough(res: Response): Promise<Response> {
  const contentType = res.headers.get('content-type') ?? 'application/json';
  if (contentType.includes('text/event-stream')) {
    return new Response(res.body, {
      status: res.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': res.headers.get('cache-control') ?? 'no-cache',
        'X-Accel-Buffering': res.headers.get('x-accel-buffering') ?? 'no',
      },
    });
  }

  const buf = await res.arrayBuffer();
  return new NextResponse(buf, {
    status: res.status,
    headers: { 'Content-Type': contentType },
  });
}

export async function GET(req: Request, ctx: RouteContext) {
  return forward(req, ctx, 'GET');
}
export async function POST(req: Request, ctx: RouteContext) {
  return forward(req, ctx, 'POST');
}
export async function PATCH(req: Request, ctx: RouteContext) {
  return forward(req, ctx, 'PATCH');
}
export async function DELETE(req: Request, ctx: RouteContext) {
  return forward(req, ctx, 'DELETE');
}
