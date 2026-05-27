import { NextResponse, type NextRequest } from 'next/server';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './lib/auth/session';

const AUTH_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password'];
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/admin',
  '/articles',
  '/pipeline',
  '/onboarding',
  '/keywords',
  '/content',
  '/brand-voices',
  '/images',
  '/audit',
  '/publisher',
  '/webhooks',
  '/sites',
  '/settings',
];

/**
 * Auth gating — redirects unauthenticated users away from the dashboard, and
 * authenticated users away from /login etc. Tokens never reach this code in
 * cleartext (httpOnly cookie); presence is enough for the gate.
 */
export function middleware(req: NextRequest): NextResponse {
  const url = req.nextUrl;
  const hasAccess = Boolean(req.cookies.get(ACCESS_COOKIE));
  const hasRefresh = Boolean(req.cookies.get(REFRESH_COOKIE));
  const isAuthenticated = hasAccess || hasRefresh;

  if (PROTECTED_PREFIXES.some((p) => url.pathname.startsWith(p)) && !isAuthenticated) {
    const login = url.clone();
    login.pathname = '/login';
    login.searchParams.set('next', url.pathname);
    return NextResponse.redirect(login);
  }

  if (AUTH_ROUTES.includes(url.pathname) && isAuthenticated) {
    const dash = url.clone();
    dash.pathname = '/dashboard';
    dash.search = '';
    return NextResponse.redirect(dash);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/|api/|favicon.ico|robots.txt|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)'],
};
