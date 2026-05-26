'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usersApi, type UserProfile } from '@/lib/api/users';

interface Prefs {
  theme?: 'light' | 'dark' | 'system';
  language?: 'vi' | 'en';
  default_brand_voice_id?: string;
  default_model?: 'claude-sonnet-4' | 'claude-haiku' | 'gpt-4o';
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [prefs, setPrefs] = useState<Prefs>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    usersApi
      .me()
      .then((p) => {
        setProfile(p);
        setName(p.name ?? '');
        setPhone(p.phone ?? '');
        setAvatarUrl(p.avatar_url ?? '');
        setPrefs((p.preferences_json as Prefs) ?? {});
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await usersApi.update({
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
        avatar_url: avatarUrl.trim() || undefined,
        preferences_json: prefs as Record<string, unknown>,
      });
      setProfile(updated);
      setSuccess('Đã lưu cài đặt.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cài đặt tài khoản</h1>
        <p className="text-sm text-muted-foreground">
          Section 6 — profile, preferences. Email + mật khẩu đổi qua /auth (chưa làm UI).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tài khoản</CardTitle>
          <CardDescription>
            {profile?.email} · plan {profile?.plan} ·{' '}
            {profile?.email_verified ? 'email đã xác thực' : 'chưa xác thực email'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Tên hiển thị</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={255}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Số điện thoại</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0901 234 567"
                  maxLength={20}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="avatar">Avatar URL</Label>
              <Input
                id="avatar"
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="theme">Giao diện</Label>
                <select
                  id="theme"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={prefs.theme ?? 'system'}
                  onChange={(e) => setPrefs({ ...prefs, theme: e.target.value as Prefs['theme'] })}
                >
                  <option value="system">Theo hệ thống</option>
                  <option value="light">Sáng</option>
                  <option value="dark">Tối</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lang">Ngôn ngữ</Label>
                <select
                  id="lang"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={prefs.language ?? 'vi'}
                  onChange={(e) =>
                    setPrefs({ ...prefs, language: e.target.value as Prefs['language'] })
                  }
                >
                  <option value="vi">Tiếng Việt</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">LLM mặc định</Label>
                <select
                  id="model"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={prefs.default_model ?? 'claude-sonnet-4'}
                  onChange={(e) =>
                    setPrefs({
                      ...prefs,
                      default_model: e.target.value as Prefs['default_model'],
                    })
                  }
                >
                  <option value="claude-sonnet-4">Claude Sonnet 4</option>
                  <option value="claude-haiku">Claude Haiku</option>
                  <option value="gpt-4o">GPT-4o</option>
                </select>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && <p className="text-sm text-green-700">{success}</p>}

            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang lưu...
                </>
              ) : (
                'Lưu thay đổi'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quota</CardTitle>
          <CardDescription>Section 10 — quota hiện tại theo plan {profile?.plan}.</CardDescription>
        </CardHeader>
        <CardContent>
          {profile && profile.quotas.length > 0 ? (
            <ul className="divide-y rounded-md border text-sm">
              {profile.quotas.map((q) => {
                const unlimited = q.limit_value === -1;
                const pct = unlimited
                  ? 0
                  : Math.min(100, (q.used / Math.max(1, q.limit_value)) * 100);
                return (
                  <li key={`${q.resource}-${q.period}`} className="p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{q.resource}</span>
                      <span className="text-muted-foreground">
                        {q.used}/{unlimited ? '∞' : q.limit_value} · {q.period}
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
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa có quota.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
