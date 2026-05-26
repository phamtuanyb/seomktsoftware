'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  brandVoicesApi,
  type BrandVoiceListItem,
  type CreateBrandVoiceRequest,
} from '@/lib/api/content';

interface SampleArticleInput {
  title: string;
  content: string;
  url: string;
}

const MIN_CONTENT = 200;

function emptySamples(): SampleArticleInput[] {
  return [
    { title: '', content: '', url: '' },
    { title: '', content: '', url: '' },
    { title: '', content: '', url: '' },
  ];
}

export default function BrandVoicesPage() {
  const [items, setItems] = useState<BrandVoiceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [samples, setSamples] = useState<SampleArticleInput[]>(emptySamples());
  const [submitting, setSubmitting] = useState(false);
  const [retrainingId, setRetrainingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function refresh() {
    setLoading(true);
    brandVoicesApi
      .list()
      .then(setItems)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const cleaned = samples
        .map((s) => ({
          title: s.title.trim() || undefined,
          content: s.content.trim().length >= MIN_CONTENT ? s.content : undefined,
          url: s.url.trim() || undefined,
        }))
        .filter((s) => s.content || s.url);

      if (cleaned.length < 3) {
        throw new Error(
          `Cần ≥3 bài mẫu. Mỗi bài hoặc nhập content ≥${MIN_CONTENT} ký tự, hoặc paste URL để hệ thống fetch.`,
        );
      }
      const body: CreateBrandVoiceRequest = {
        name: name.trim(),
        description: description.trim() || undefined,
        sample_articles: cleaned,
      };
      const created = await brandVoicesApi.create(body);
      const tag =
        created.meta.algorithm === 'claude-sonnet-4' ? 'Claude Sonnet 4' : 'heuristic stub';
      setSuccess(`Đã tạo brand voice "${created.name}" (${tag}, ${created.sample_count} bài mẫu).`);
      setName('');
      setDescription('');
      setSamples(emptySamples());
      refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Xoá brand voice này?')) return;
    try {
      await brandVoicesApi.remove(id);
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleRetrain(id: string) {
    setRetrainingId(id);
    setError(null);
    setSuccess(null);
    try {
      const bv = await brandVoicesApi.retrain(id);
      const tag = bv.meta.algorithm === 'claude-sonnet-4' ? 'Claude Sonnet 4' : 'heuristic stub';
      setSuccess(`Đã re-train "${bv.name}" (${tag}).`);
      refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRetrainingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Brand Voice</h1>
        <p className="text-sm text-muted-foreground">
          Section 8 TN5 — học phong cách brand từ 3-20 bài mẫu. Hệ thống gọi Claude Sonnet 4 để
          trích Profile JSON; khi không có API key sẽ fallback heuristic deterministic.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách brand voice</CardTitle>
          <CardDescription>{items.length} brand voice đang hoạt động</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có brand voice nào.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {items.map((bv) => (
                <li key={bv.id} className="flex items-start justify-between p-3">
                  <div>
                    <p className="font-medium">
                      {bv.name}
                      {bv.is_default && (
                        <span className="ml-2 rounded bg-brand/10 px-2 py-0.5 text-xs text-brand">
                          mặc định
                        </span>
                      )}
                      <span
                        className={`ml-2 rounded px-2 py-0.5 text-xs ${
                          bv.algorithm === 'claude-sonnet-4'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                        title={
                          bv.algorithm === 'claude-sonnet-4'
                            ? 'Profile được trích bằng Claude Sonnet 4.'
                            : 'Stub heuristic — chưa có ANTHROPIC_API_KEY hợp lệ.'
                        }
                      >
                        {bv.algorithm === 'claude-sonnet-4' ? 'Claude Sonnet 4' : 'heuristic'}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {bv.sample_count} sample · trained {new Date(bv.trained_at).toLocaleString()}
                    </p>
                    {bv.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{bv.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRetrain(bv.id)}
                      disabled={retrainingId === bv.id}
                      aria-label="Re-train"
                      title="Re-train từ reference articles hiện tại"
                    >
                      {retrainingId === bv.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(bv.id)}
                      aria-label="Xoá"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tạo brand voice mới</CardTitle>
          <CardDescription>
            Nhập ít nhất 3 bài mẫu (mỗi bài ≥{MIN_CONTENT} ký tự HOẶC paste URL — hệ thống tự fetch
            qua Readability). Tốn 1 quota brand_voices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Tên brand voice</Label>
              <Input
                id="name"
                required
                minLength={2}
                maxLength={255}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Tech blog tone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Mô tả (tuỳ chọn)</Label>
              <Input
                id="desc"
                maxLength={1000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <Label>Bài mẫu (3+)</Label>
              {samples.map((s, i) => (
                <div key={i} className="space-y-2 rounded-md border bg-muted/30 p-3">
                  <Input
                    placeholder={`Bài mẫu ${i + 1} — tiêu đề (tuỳ chọn)`}
                    value={s.title}
                    onChange={(e) => {
                      const next = [...samples];
                      next[i] = { ...next[i]!, title: e.target.value };
                      setSamples(next);
                    }}
                  />
                  <Input
                    placeholder="URL bài viết (tuỳ chọn — hệ thống sẽ fetch nếu để trống content)"
                    type="url"
                    value={s.url}
                    onChange={(e) => {
                      const next = [...samples];
                      next[i] = { ...next[i]!, url: e.target.value };
                      setSamples(next);
                    }}
                  />
                  <Textarea
                    placeholder={`Hoặc paste nội dung bài ${i + 1} (≥${MIN_CONTENT} ký tự)`}
                    rows={6}
                    value={s.content}
                    onChange={(e) => {
                      const next = [...samples];
                      next[i] = { ...next[i]!, content: e.target.value };
                      setSamples(next);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    {s.url.trim()
                      ? 'Sẽ fetch URL nếu content trống.'
                      : `${s.content.length}/${MIN_CONTENT} ký tự tối thiểu`}
                  </p>
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={samples.length >= 20}
                onClick={() => setSamples([...samples, { title: '', content: '', url: '' }])}
              >
                <Plus className="mr-2 h-4 w-4" /> Thêm bài mẫu
              </Button>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && <p className="text-sm text-green-700">{success}</p>}

            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang train (Claude Sonnet 4)...
                </>
              ) : (
                'Tạo brand voice'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
