'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, Loader2, Plus, RefreshCw, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  WEBHOOK_EVENTS,
  webhooksApi,
  type WebhookDelivery,
  type WebhookEvent,
  type WebhookListItem,
} from '@/lib/api/webhooks';

export default function WebhooksPage() {
  const [items, setItems] = useState<WebhookListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // create form
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [events, setEvents] = useState<WebhookEvent[]>(['article.published']);
  const [creating, setCreating] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  // expanded webhook (for deliveries view)
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await webhooksApi.list();
      setItems(rows);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function loadDeliveries(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setDeliveriesLoading(true);
    try {
      const rows = await webhooksApi.deliveries(id);
      setDeliveries(rows);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeliveriesLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setCreatedSecret(null);
    setCreating(true);
    try {
      if (events.length === 0) {
        throw new Error('Chọn ít nhất 1 event.');
      }
      const created = await webhooksApi.create({
        url: url.trim(),
        events,
        secret: secret.trim() || undefined,
      });
      if (created.secret) setCreatedSecret(created.secret);
      setSuccess(`Đã tạo webhook ${created.id.slice(0, 8)}...`);
      setUrl('');
      setSecret('');
      setEvents(['article.published']);
      void refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function handleTest(id: string) {
    setBusyId(id);
    setError(null);
    setSuccess(null);
    try {
      const res = await webhooksApi.test(id);
      setSuccess(
        `Đã enqueue test delivery ${res.delivery_id.slice(0, 8)}... — kiểm tra log để xem kết quả.`,
      );
      if (expandedId === id) {
        const rows = await webhooksApi.deliveries(id);
        setDeliveries(rows);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggle(wh: WebhookListItem) {
    setBusyId(wh.id);
    try {
      await webhooksApi.update(wh.id, { is_active: !wh.is_active });
      void refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Xoá webhook này? Mọi delivery cũ sẽ bị xoá theo.')) return;
    setBusyId(id);
    try {
      await webhooksApi.remove(id);
      if (expandedId === id) setExpandedId(null);
      void refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleRotateSecret(id: string) {
    if (!window.confirm('Tạo secret mới? Secret cũ ngưng hoạt động ngay.')) return;
    setBusyId(id);
    setCreatedSecret(null);
    try {
      const newSecret = `whsec_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      const updated = await webhooksApi.update(id, { secret: newSecret });
      if (updated.secret) setCreatedSecret(updated.secret);
      setSuccess('Đã rotate secret. Lưu ngay — sẽ không hiện lại.');
      void refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  function toggleEvent(ev: WebhookEvent) {
    setEvents((prev) => (prev.includes(ev) ? prev.filter((x) => x !== ev) : [...prev, ev]));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Webhook outgoing</h1>
        <p className="text-sm text-muted-foreground">
          Section 6 — đăng ký URL nhận event. Payload ký HMAC-SHA256, header{' '}
          <code className="rounded bg-muted px-1 text-xs">X-MKT-Signature</code>. Retry 3 lần.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-700">{success}</p>}

      {createdSecret && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-900">Secret mới</CardTitle>
            <CardDescription className="text-amber-900">
              Lưu lại ngay — không hiển thị lần nào nữa.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-white px-3 py-2 font-mono text-sm">
              {createdSecret}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(createdSecret);
                setSuccess('Đã copy secret.');
              }}
            >
              <Copy className="mr-1 h-4 w-4" /> Copy
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCreatedSecret(null)}>
              Đóng
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tạo webhook mới</CardTitle>
          <CardDescription>
            URL bắt buộc dùng https. Để trống secret thì server tự sinh{' '}
            <code className="rounded bg-muted px-1 text-xs">whsec_…</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="url">Endpoint URL</Label>
              <Input
                id="url"
                type="url"
                required
                placeholder="https://n8n.example.com/webhook/abcd1234"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secret">Secret (tuỳ chọn)</Label>
              <Input
                id="secret"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Để trống để server tự sinh"
                minLength={8}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>Events subscribed</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {WEBHOOK_EVENTS.map((ev) => (
                  <label
                    key={ev}
                    className="flex items-center gap-2 rounded border p-2 text-sm hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      checked={events.includes(ev)}
                      onChange={() => toggleEvent(ev)}
                    />
                    <code className="text-xs">{ev}</code>
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" disabled={creating}>
              {creating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Tạo webhook
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{loading ? 'Đang tải...' : `${items.length} webhook`}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có webhook nào.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {items.map((wh) => (
                <li key={wh.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="break-all font-mono text-sm">{wh.url}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {wh.events.map((ev) => (
                          <code key={ev} className="rounded bg-muted px-1.5 py-0.5 text-xs">
                            {ev}
                          </code>
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Tạo {new Date(wh.created_at).toLocaleString()} ·{' '}
                        {wh.is_active ? (
                          <span className="text-emerald-700">Đang bật</span>
                        ) : (
                          <span className="text-amber-700">Tạm tắt</span>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === wh.id}
                        onClick={() => handleTest(wh.id)}
                      >
                        <Send className="mr-1 h-4 w-4" /> Test
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === wh.id}
                        onClick={() => handleToggle(wh)}
                      >
                        {wh.is_active ? 'Tắt' : 'Bật'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === wh.id}
                        onClick={() => handleRotateSecret(wh.id)}
                      >
                        <RefreshCw className="mr-1 h-4 w-4" /> Rotate secret
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busyId === wh.id}
                        onClick={() => loadDeliveries(wh.id)}
                      >
                        {expandedId === wh.id ? 'Ẩn deliveries' : 'Xem deliveries'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busyId === wh.id}
                        onClick={() => handleDelete(wh.id)}
                        aria-label="Xoá"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {expandedId === wh.id && (
                    <div className="border-t bg-muted/20 p-3">
                      {deliveriesLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : deliveries.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Chưa có delivery nào — bấm Test để thử.
                        </p>
                      ) : (
                        <ul className="space-y-2 text-xs">
                          {deliveries.map((d) => (
                            <li key={d.id} className="rounded border bg-background p-2">
                              <div className="flex items-center justify-between">
                                <code className="font-medium">{d.event}</code>
                                <span
                                  className={
                                    d.delivered_at
                                      ? 'rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800'
                                      : d.response_status && d.response_status >= 400
                                        ? 'rounded bg-rose-100 px-1.5 py-0.5 text-rose-800'
                                        : 'rounded bg-amber-100 px-1.5 py-0.5 text-amber-800'
                                  }
                                >
                                  {d.delivered_at
                                    ? `OK ${d.response_status}`
                                    : d.response_status === null || d.response_status === 0
                                      ? 'pending / timeout'
                                      : `HTTP ${d.response_status}`}
                                </span>
                              </div>
                              <p className="mt-1 text-muted-foreground">
                                {new Date(d.created_at).toLocaleString()} · attempt{' '}
                                {d.attempt_count}
                              </p>
                              {d.response_body && (
                                <pre className="mt-1 max-h-32 overflow-x-auto rounded bg-muted/40 p-2">
                                  {d.response_body.slice(0, 500)}
                                </pre>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
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
