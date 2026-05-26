'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { adminApi, type AdminUserListItem } from '@/lib/api/admin';

type Role = '' | 'user' | 'admin';
type Plan = '' | 'trial' | 'starter' | 'pro' | 'agency' | 'lifetime';

export default function AdminUsersPage() {
  const [items, setItems] = useState<AdminUserListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [q, setQ] = useState('');
  const [role, setRole] = useState<Role>('');
  const [plan, setPlan] = useState<Plan>('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'fresh' | 'more') => {
      if (mode === 'fresh') setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const res = await adminApi.listUsers({
          limit: 25,
          q: q.trim() || undefined,
          role: role || undefined,
          plan: plan || undefined,
          cursor: mode === 'more' && cursor ? cursor : undefined,
        });
        if (mode === 'fresh') setItems(res.items);
        else setItems((prev) => [...prev, ...res.items]);
        setCursor(res.cursor);
        setHasMore(res.has_more);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [q, role, plan, cursor],
  );

  useEffect(() => {
    void load('fresh');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, plan]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quản lý người dùng</h1>
          <p className="text-sm text-muted-foreground">
            Tìm theo email / tên, lọc theo role + plan. Click để xem chi tiết & override.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin">← Dashboard</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bộ lọc</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setCursor(null);
              void load('fresh');
            }}
            className="flex flex-wrap gap-3"
          >
            <Input
              placeholder="Email hoặc tên..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="max-w-xs"
            />
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={role}
              onChange={(e) => {
                setCursor(null);
                setRole(e.target.value as Role);
              }}
            >
              <option value="">Mọi role</option>
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={plan}
              onChange={(e) => {
                setCursor(null);
                setPlan(e.target.value as Plan);
              }}
            >
              <option value="">Mọi plan</option>
              <option value="trial">trial</option>
              <option value="starter">starter</option>
              <option value="pro">pro</option>
              <option value="agency">agency</option>
              <option value="lifetime">lifetime</option>
            </select>
            <Button type="submit" variant="outline">
              <Search className="mr-2 h-4 w-4" /> Tìm
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{loading ? 'Đang tải...' : `${items.length} người dùng`}</CardTitle>
          <CardDescription>
            Click email/tên để mở chi tiết. Số liệu là theo từng resource đã sinh.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Không tìm thấy người dùng nào.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 text-left">Email / tên</th>
                    <th className="py-2 text-left">Role</th>
                    <th className="py-2 text-left">Plan</th>
                    <th className="py-2 text-right">Bài</th>
                    <th className="py-2 text-right">KW</th>
                    <th className="py-2 text-right">Site</th>
                    <th className="py-2 text-right">BV</th>
                    <th className="py-2 text-right">Ảnh</th>
                    <th className="py-2 text-left">Tạo</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((u) => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="py-2">
                        <Link href={`/admin/users/${u.id}`} className="font-medium hover:underline">
                          {u.email}
                        </Link>
                        {u.name && <div className="text-xs text-muted-foreground">{u.name}</div>}
                        {u.deleted_at && (
                          <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 text-xs text-rose-800">
                            đã xoá
                          </span>
                        )}
                        {!u.email_verified && (
                          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                            chưa xác thực
                          </span>
                        )}
                      </td>
                      <td className="py-2">
                        <span
                          className={
                            u.role === 'admin'
                              ? 'rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800'
                              : 'rounded bg-muted px-1.5 py-0.5 text-xs'
                          }
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-2 capitalize">{u.plan}</td>
                      <td className="py-2 text-right tabular-nums">{u.stats.articles}</td>
                      <td className="py-2 text-right tabular-nums">{u.stats.keywords}</td>
                      <td className="py-2 text-right tabular-nums">{u.stats.sites}</td>
                      <td className="py-2 text-right tabular-nums">{u.stats.brand_voices}</td>
                      <td className="py-2 text-right tabular-nums">{u.stats.images}</td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

          {hasMore && (
            <div className="mt-4">
              <Button variant="outline" onClick={() => void load('more')} disabled={loadingMore}>
                {loadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang tải...
                  </>
                ) : (
                  'Tải thêm'
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
