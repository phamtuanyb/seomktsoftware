import { redirect } from 'next/navigation';
import { readAccessToken } from '@/lib/auth/session';
import { backendFetch } from '@/lib/auth/backend';
import type { AuthUser, ApiResponseBody } from '@mkt-seo/shared';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

export const metadata = { title: 'Tổng quan — MKT SEO AI' };

async function fetchMe(): Promise<AuthUser | null> {
  const token = await readAccessToken();
  if (!token) return null;
  const res = await backendFetch('/v1/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as ApiResponseBody<AuthUser>;
  return body.success ? body.data : null;
}

/**
 * Sprint 10.5 — read full profile (includes preferences_json) to decide
 * whether to redirect to /onboarding. AuthUser doesn't carry prefs so we
 * hit /users/me separately. Cheap (single round-trip) and only on first
 * dashboard visit.
 */
async function fetchPrefs(): Promise<{ onboarded_at?: string } | null> {
  const token = await readAccessToken();
  if (!token) return null;
  const res = await backendFetch('/v1/users/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as ApiResponseBody<{
    preferences_json?: { onboarded_at?: string };
  }>;
  if (!body.success) return null;
  return body.data.preferences_json ?? {};
}

const SHORTCUTS = [
  { href: '/keywords', label: 'Nghiên cứu từ khóa', sprint: 'Sprint 3' },
  { href: '/content', label: 'Sinh nội dung AI', sprint: 'Sprint 4' },
  { href: '/brand-voices', label: 'Brand Voice', sprint: 'Sprint 4' },
  { href: '/publisher', label: 'Xuất bản WordPress', sprint: 'Sprint 6' },
];

export default async function DashboardPage() {
  const prefs = await fetchPrefs();
  if (prefs && !prefs.onboarded_at) {
    redirect('/onboarding');
  }
  const me = await fetchMe();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Xin chào, {me?.name ?? me?.email ?? 'bạn'}</h1>
        <p className="mt-1 text-muted-foreground">
          Gói hiện tại: <span className="font-medium uppercase">{me?.plan ?? 'trial'}</span>
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Bắt đầu pipeline SEO</CardTitle>
          <CardDescription>
            Mỗi bước được giao cho 1 sprint riêng. Theo dõi tiến độ phía dưới.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {SHORTCUTS.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="flex items-center justify-between rounded-md border p-4 transition hover:border-brand hover:shadow-sm"
              >
                <div>
                  <div className="font-medium">{s.label}</div>
                  <div className="text-xs text-muted-foreground">{s.sprint}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
