'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
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
}

export default function BrandVoicesPage() {
  const [items, setItems] = useState<BrandVoiceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [samples, setSamples] = useState<SampleArticleInput[]>([
    { title: '', content: '' },
    { title: '', content: '' },
    { title: '', content: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
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
      const body: CreateBrandVoiceRequest = {
        name: name.trim(),
        description: description.trim() || undefined,
        sample_articles: samples
          .filter((s) => s.content.trim().length >= 500)
          .map((s) => ({ title: s.title.trim() || undefined, content: s.content })),
      };
      if (body.sample_articles.length < 3) {
        throw new Error('Cần ≥3 bài mẫu, mỗi bài ≥500 ký tự.');
      }
      const created = await brandVoicesApi.create(body);
      setSuccess(`Đã tạo brand voice "${created.name}". Sample: ${created.sample_count}.`);
      setName('');
      setDescription('');
      setSamples([
        { title: '', content: '' },
        { title: '', content: '' },
        { title: '', content: '' },
      ]);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Brand Voice</h1>
        <p className="text-sm text-muted-foreground">
          Section 8 TN5 — học phong cách brand từ 3-20 bài mẫu. Sprint 5.6 dùng heuristic profile;
          Claude profile extractor lên ở sprint sau.
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
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {bv.sample_count} sample · trained {new Date(bv.trained_at).toLocaleString()}
                    </p>
                    {bv.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{bv.description}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(bv.id)}
                    aria-label="Xoá"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
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
            Nhập ít nhất 3 bài mẫu (mỗi bài ≥500 ký tự). Tốn 1 quota brand_voices.
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
                  <Textarea
                    placeholder={`Nội dung bài ${i + 1} (≥500 ký tự)`}
                    rows={6}
                    value={s.content}
                    onChange={(e) => {
                      const next = [...samples];
                      next[i] = { ...next[i]!, content: e.target.value };
                      setSamples(next);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    {s.content.length}/500 ký tự tối thiểu
                  </p>
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={samples.length >= 20}
                onClick={() => setSamples([...samples, { title: '', content: '' }])}
              >
                <Plus className="mr-2 h-4 w-4" /> Thêm bài mẫu
              </Button>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && <p className="text-sm text-green-700">{success}</p>}

            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang tạo...
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
