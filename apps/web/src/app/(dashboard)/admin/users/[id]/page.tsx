'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { adminApi, type AdminUserDetail } from '@/lib/api/admin';

const PLAN_OPTIONS = ['trial', 'starter', 'pro', 'agency', 'lifetime'] as const;
const QUOTA_RESOURCES = ['articles', 'keywords', 'sites', 'brand_voices', 'images'] as const;
const PERIODS = ['monthly', 'lifetime'] as const;

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // sub override
  const [subPlan, setSubPlan] = useState<(typeof PLAN_OPTIONS)[number]>('pro');
  const [subExpires, setSubExpires] = useState('');

  // quota override
  const [quotaResource, setQuotaResource] = useState<(typeof QUOTA_RESOURCES)[number]>('articles');
  const [quotaPeriod, setQuotaPeriod] = useState<(typeof PERIODS)[number]>('monthly');
  const [quotaLimit, setQuotaLimit] = useState('-1');
  const [quotaReset, setQuotaReset] = useState(false);

  useEffect(() => {
    if (!params?.id) return;
    refresh(params.id);
  }, [params?.id]);

  function refresh(id: string) {
    setLoading(true);
    adminApi
      .getUser(id)
      .then(setUser)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }

  async function wrap<T>(fn: () => Promise<T>, ok: string) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await fn();
      setSuccess(ok);
      if (params?.id) refresh(params.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) {
    return (
      <div>
        <p className="text-sm text-destructive">{error ?? 'Không tìm thấy user.'}</p>
        <Button variant="outline" onClick={() => router.push('/admin/users')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Về danh sách
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/users')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại
        </Button>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{user.email}</h1>
        <p className="text-sm text-muted-foreground">
          {user.name ?? '(chưa có tên)'} · role {user.role} · plan {user.plan}
          {user.deleted_at && <span className="ml-2 text-rose-700">— đã xoá</span>}
          {!user.email_verified && (
            <span className="ml-2 text-amber-700">— chưa xác thực email</span>
          )}
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-700">{success}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Quản trị tài khoản</CardTitle>
          <CardDescription>Đổi role, xác thực email thủ công, soft-delete.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              wrap(
                () =>
                  adminApi.updateUser(user.id, { role: user.role === 'admin' ? 'user' : 'admin' }),
                `Đã đổi role thành ${user.role === 'admin' ? 'user' : 'admin'}`,
              )
            }
          >
            {user.role === 'admin' ? 'Demote → user' : 'Promote → admin'}
          </Button>
          {!user.email_verified && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                wrap(
                  () => adminApi.updateUser(user.id, { email_verified: true }),
                  'Đã đánh dấu email verified',
                )
              }
            >
              Force email verified
            </Button>
          )}
          {!user.deleted_at ? (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                if (!window.confirm('Soft-delete user này?')) return;
                void wrap(
                  () => adminApi.updateUser(user.id, { soft_delete: true }),
                  'Đã soft-delete',
                );
              }}
            >
              Soft-delete
            </Button>
          ) : (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                wrap(() => adminApi.updateUser(user.id, { soft_delete: false }), 'Đã khôi phục')
              }
            >
              Khôi phục
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Override subscription</CardTitle>
          <CardDescription>
            Tạo bản ghi mới + huỷ bản active hiện tại. Ghi audit log.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>Plan mới</Label>
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={subPlan}
                onChange={(e) => setSubPlan(e.target.value as typeof subPlan)}
              >
                {PLAN_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Hết hạn (tuỳ chọn)</Label>
              <Input
                type="date"
                value={subExpires}
                onChange={(e) => setSubExpires(e.target.value)}
              />
            </div>
            <Button
              disabled={busy}
              onClick={() =>
                wrap(
                  () =>
                    adminApi.overrideSubscription(user.id, {
                      plan: subPlan,
                      status: 'active',
                      expires_at: subExpires ? new Date(subExpires).toISOString() : undefined,
                    }),
                  `Đã chuyển sang plan ${subPlan}`,
                )
              }
            >
              Áp dụng
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Override quota</CardTitle>
          <CardDescription>-1 = unlimited. Tick "reset used" để zero counter.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>Resource</Label>
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={quotaResource}
                onChange={(e) => setQuotaResource(e.target.value as typeof quotaResource)}
              >
                {QUOTA_RESOURCES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Period</Label>
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={quotaPeriod}
                onChange={(e) => setQuotaPeriod(e.target.value as typeof quotaPeriod)}
              >
                {PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Limit (-1 = ∞)</Label>
              <Input
                type="number"
                className="w-32"
                value={quotaLimit}
                onChange={(e) => setQuotaLimit(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={quotaReset}
                onChange={(e) => setQuotaReset(e.target.checked)}
              />
              Reset used
            </label>
            <Button
              disabled={busy}
              onClick={() =>
                wrap(
                  () =>
                    adminApi.overrideQuota(user.id, {
                      resource: quotaResource,
                      period: quotaPeriod,
                      limit_value: Number(quotaLimit),
                      reset_used: quotaReset,
                    }),
                  `Đã cập nhật quota ${quotaResource}/${quotaPeriod}`,
                )
              }
            >
              Áp dụng
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Subscriptions</CardTitle>
            <CardDescription>Lịch sử subscription (mới nhất trên cùng).</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-md border text-sm">
              {user.subscriptions.map((s) => (
                <li key={s.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium capitalize">{s.plan}</span>
                    <span
                      className={
                        s.status === 'active'
                          ? 'rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800'
                          : 'rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground'
                      }
                    >
                      {s.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(s.started_at).toLocaleString()} →{' '}
                    {s.expires_at ? new Date(s.expires_at).toLocaleString() : '∞'}
                  </p>
                </li>
              ))}
              {user.subscriptions.length === 0 && (
                <li className="p-3 text-sm text-muted-foreground">Chưa có subscription.</li>
              )}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quotas</CardTitle>
            <CardDescription>Hạn mức hiện tại.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-md border text-sm">
              {user.quotas.map((q) => {
                const unlimited = q.limit_value === -1;
                const pct = unlimited
                  ? 0
                  : Math.min(100, (q.used / Math.max(1, q.limit_value)) * 100);
                return (
                  <li key={`${q.resource}-${q.period}`} className="p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {q.resource} · <span className="text-muted-foreground">{q.period}</span>
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {q.used}/{unlimited ? '∞' : q.limit_value}
                      </span>
                    </div>
                    {!unlimited && (
                      <div className="mt-2 h-1.5 w-full rounded bg-muted">
                        <div className="h-full rounded bg-brand" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </li>
                );
              })}
              {user.quotas.length === 0 && (
                <li className="p-3 text-sm text-muted-foreground">Chưa có quota.</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Audit log (20 sự kiện gần nhất)</CardTitle>
          <CardDescription>
            Hành động liên quan tới user này (admin override, login...).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user.recent_audit_logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có sự kiện nào.</p>
          ) : (
            <ul className="divide-y rounded-md border text-sm">
              {user.recent_audit_logs.map((a, i) => (
                <li key={i} className="p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs">{a.action}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleString()}
                    </span>
                  </div>
                  {a.resource_type && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {a.resource_type}:{a.resource_id ?? '—'}
                    </p>
                  )}
                  {a.metadata_json && (
                    <pre className="mt-2 overflow-x-auto rounded bg-muted/40 p-2 text-xs">
                      {JSON.stringify(a.metadata_json, null, 2)}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
