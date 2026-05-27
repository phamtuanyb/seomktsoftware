'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { adminApi, type AdminStats, type AiProviderName, type AiSettings } from '@/lib/api/admin';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [aiSettings, setAiSettings] = useState<AiSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingAi, setSavingAi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiSuccess, setAiSuccess] = useState<string | null>(null);
  const [defaultProvider, setDefaultProvider] = useState<AiProviderName>('claude');
  const [claudeKey, setClaudeKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');

  useEffect(() => {
    Promise.all([adminApi.stats(), adminApi.getAiSettings()])
      .then(([statsRes, aiRes]) => {
        setStats(statsRes);
        setAiSettings(aiRes);
        setDefaultProvider(aiRes.default_provider);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  async function saveAiSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingAi(true);
    setError(null);
    setAiSuccess(null);
    try {
      const updated = await adminApi.updateAiSettings({
        default_provider: defaultProvider,
        claude_api_key: claudeKey.trim() || undefined,
        openai_api_key: openaiKey.trim() || undefined,
        gemini_api_key: geminiKey.trim() || undefined,
      });
      setAiSettings(updated);
      setClaudeKey('');
      setOpenaiKey('');
      setGeminiKey('');
      setAiSuccess('Đã lưu cấu hình AI cho TN viết bài.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingAi(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }
  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Section 9 (RBAC) + Section 16 (audit). Chỉ user role=admin truy cập được.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/users">
            Quản lý người dùng <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Người dùng"
          value={stats.users.total}
          sub={`${stats.users.deleted} đã xoá`}
        />
        <StatCard
          title="Hoạt động (30 ngày)"
          value={stats.users.active_last_30d}
          sub="user đã tạo bài viết"
        />
        <StatCard
          title="Bài viết"
          value={stats.articles.total}
          sub={`+${stats.articles.last_30d} trong 30 ngày`}
        />
        <StatCard
          title="Publish jobs"
          value={stats.publish_jobs.total}
          sub={`${stats.publish_jobs.succeeded} ok · ${stats.publish_jobs.failed} fail · ${stats.publish_jobs.pending} pending`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cấu hình AI viết bài</CardTitle>
          <CardDescription>
            Chọn provider mặc định cho TN outline/viết bài. API key được mã hoá trong database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveAiSettings} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <label htmlFor="ai-provider" className="text-sm font-medium">
                  Provider mặc định
                </label>
                <select
                  id="ai-provider"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={defaultProvider}
                  onChange={(e) => setDefaultProvider(e.target.value as AiProviderName)}
                >
                  <option value="claude">Claude</option>
                  <option value="openai">OpenAI</option>
                  <option value="gemini">Gemini</option>
                </select>
              </div>
              <ProviderStatus label="Claude" status={aiSettings?.providers.claude} />
              <ProviderStatus label="OpenAI" status={aiSettings?.providers.openai} />
              <ProviderStatus label="Gemini" status={aiSettings?.providers.gemini} />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <SecretInput label="Claude API key" value={claudeKey} onChange={setClaudeKey} />
              <SecretInput label="OpenAI API key" value={openaiKey} onChange={setOpenaiKey} />
              <SecretInput label="Gemini API key" value={geminiKey} onChange={setGeminiKey} />
            </div>

            {aiSuccess && <p className="text-sm text-emerald-700">{aiSuccess}</p>}
            <Button type="submit" disabled={savingAi}>
              {savingAi ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang lưu...
                </>
              ) : (
                'Lưu cấu hình AI'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Phân bố plan</CardTitle>
          <CardDescription>Active subscription / số user. Section 10.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y rounded-md border text-sm">
            {Object.entries(stats.plans)
              .sort((a, b) => b[1] - a[1])
              .map(([plan, count]) => {
                const pct = stats.users.total > 0 ? (count / stats.users.total) * 100 : 0;
                return (
                  <li key={plan} className="flex items-center gap-4 p-3">
                    <span className="w-24 font-medium capitalize">{plan}</span>
                    <div className="flex-1">
                      <div className="h-2 w-full rounded bg-muted">
                        <div className="h-full rounded bg-brand" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <span className="w-20 text-right tabular-nums text-muted-foreground">
                      {count} · {pct.toFixed(1)}%
                    </span>
                  </li>
                );
              })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function SecretInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <Input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Dán key mới, để trống nếu giữ nguyên"
        autoComplete="off"
      />
    </div>
  );
}

function ProviderStatus({
  label,
  status,
}: {
  label: string;
  status?: { configured: boolean; source: 'admin' | 'env' | 'missing' };
}) {
  return (
    <div className="rounded-md border p-3 text-sm">
      <p className="font-medium">{label}</p>
      <p className={status?.configured ? 'text-emerald-700' : 'text-amber-700'}>
        {status?.configured ? `Đã cấu hình (${status.source})` : 'Chưa có key'}
      </p>
    </div>
  );
}

function StatCard({ title, value, sub }: { title: string; value: number; sub: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}
