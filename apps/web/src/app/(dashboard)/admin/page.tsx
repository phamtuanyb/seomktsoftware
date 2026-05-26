'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { adminApi, type AdminStats } from '@/lib/api/admin';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .stats()
      .then(setStats)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

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
