import { cookies } from 'next/headers';

export const ACCESS_COOKIE = 'mkt_access';
export const REFRESH_COOKIE = 'mkt_refresh';

const PUBLIC_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? '';
const SECURE_COOKIES = PUBLIC_URL.startsWith('https://');

export interface CookieTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

/**
 * Server-only helpers — only call from route handlers (`app/api/**`) or server
 * components. The browser cannot read these cookies (httpOnly + SameSite=lax).
 */
export async function setAuthCookies(tokens: CookieTokens): Promise<void> {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, tokens.access_token, {
    httpOnly: true,
    secure: SECURE_COOKIES,
    sameSite: 'lax',
    path: '/',
    maxAge: tokens.expires_in,
  });
  jar.set(REFRESH_COOKIE, tokens.refresh_token, {
    httpOnly: true,
    secure: SECURE_COOKIES,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // 30 days, matches Section 9 default
  });
}

export async function clearAuthCookies(): Promise<void> {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

export async function readAccessToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(ACCESS_COOKIE)?.value ?? null;
}

export async function readRefreshToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(REFRESH_COOKIE)?.value ?? null;
}
