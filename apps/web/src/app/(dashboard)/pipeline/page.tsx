'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Circle, Loader2, PlayCircle, XCircle, MinusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  pipelineApi,
  type PipelineRun,
  type PipelineStep,
  type PipelineStepName,
  type PipelineStepStatus,
} from '@/lib/api/pipeline';
import { brandVoicesApi, type BrandVoiceListItem } from '@/lib/api/content';
import { publisherApi, type SiteSummary } from '@/lib/api/publisher';

const STEP_ORDER: PipelineStepName[] = ['outline', 'article', 'audit', 'images', 'publish'];

const STEP_LABEL: Record<PipelineStepName, string> = {
  outline: 'Outline (TN3)',
  article: 'Bài viết (TN4)',
  audit: 'Chấm điểm (TN7)',
  images: 'Hình ảnh (TN6)',
  publish: 'Xuất bản (TN8)',
};

export default function PipelinePage() {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [brandVoices, setBrandVoices] = useState<BrandVoiceListItem[]>([]);
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // form
  const [keyword, setKeyword] = useState('');
  const [brandVoiceId, setBrandVoiceId] = useState<string>('');
  const [siteId, setSiteId] = useState<string>('');
  const [generateImages, setGenerateImages] = useState(true);
  const [publishStatus, setPublishStatus] = useState<'draft' | 'publish'>('draft');

  const refresh = useCallback(async () => {
    try {
      const res = await pipelineApi.list({ limit: 25 });
      setRuns(res.items);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      pipelineApi.list({ limit: 25 }),
      brandVoicesApi.list().catch(() => []),
      publisherApi.listSites().catch(() => []),
    ])
      .then(([runsRes, bvs, ss]) => {
        setRuns(runsRes.items);
        setBrandVoices(bvs);
        setSites(ss);
        const def = bvs.find((b) => b.is_default);
        if (def) setBrandVoiceId(def.id);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  // Poll every 2s while any run is still running/pending.
  useEffect(() => {
    const hasInFlight = runs.some((r) => r.status === 'running' || r.status === 'pending');
    if (!hasInFlight) return;
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [runs, refresh]);

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const run = await pipelineApi.start({
        keyword: keyword.trim(),
        brand_voice_id: brandVoiceId || undefined,
        site_id: siteId || undefined,
        generate_images: generateImages,
        publish_status: publishStatus,
      });
      setSuccess(`Đã khởi chạy pipeline ${run.id.slice(0, 8)}...`);
      setKeyword('');
      void refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(id: string) {
    if (!window.confirm('Huỷ pipeline đang chạy?')) return;
    setBusyId(id);
    try {
      await pipelineApi.cancel(id);
      void refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pipeline end-to-end</h1>
        <p className="text-sm text-muted-foreground">
          Section 3 — Outline → Article (Brand Voice) → Audit → Images → Publish trong một lần chạy.
          Quota tính 1 article + image/publish theo bước thực sự chạy.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-700">{success}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Khởi chạy run mới</CardTitle>
          <CardDescription>Pipeline chạy async — bảng bên dưới poll mỗi 2 giây.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleStart} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="kw">Keyword</Label>
              <Input
                id="kw"
                required
                minLength={2}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="VD: content marketing 2026"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bv">Brand voice (tuỳ chọn)</Label>
                <select
                  id="bv"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={brandVoiceId}
                  onChange={(e) => setBrandVoiceId(e.target.value)}
                >
                  <option value="">— Không dùng brand voice —</option>
                  {brandVoices.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.is_default ? '(mặc định)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="site">WordPress site (tuỳ chọn)</Label>
                <select
                  id="site"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={siteId}
                  onChange={(e) => setSiteId(e.target.value)}
                >
                  <option value="">— Không publish —</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name ?? s.url}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={generateImages}
                  onChange={(e) => setGenerateImages(e.target.checked)}
                />
                Sinh hình ảnh (TN6)
              </label>
              {siteId && (
                <div className="flex items-center gap-2 text-sm">
                  <Label htmlFor="ps">Trạng thái WP:</Label>
                  <select
                    id="ps"
                    className="h-8 rounded-md border bg-background px-2 text-sm"
                    value={publishStatus}
                    onChange={(e) => setPublishStatus(e.target.value as 'draft' | 'publish')}
                  >
                    <option value="draft">Draft (mặc định)</option>
                    <option value="publish">Publish ngay</option>
                  </select>
                </div>
              )}
            </div>

            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="mr-2 h-4 w-4" />
              )}
              Chạy pipeline
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{loading ? 'Đang tải...' : `${runs.length} run gần nhất`}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có pipeline nào — chạy thử đi.</p>
          ) : (
            <ul className="space-y-3">
              {runs.map((r) => (
                <li key={r.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{r.keyword || '(không keyword)'}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.id.slice(0, 8)}... · {new Date(r.created_at).toLocaleString()}
                        {r.started_at && r.completed_at && (
                          <span>
                            {' '}
                            ·{' '}
                            {Math.round(
                              (new Date(r.completed_at).getTime() -
                                new Date(r.started_at).getTime()) /
                                1000,
                            )}
                            s
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={r.status} />
                      {(r.status === 'running' || r.status === 'pending') && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === r.id}
                          onClick={() => handleCancel(r.id)}
                        >
                          Huỷ
                        </Button>
                      )}
                    </div>
                  </div>
                  <ol className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-5">
                    {STEP_ORDER.map((name) => {
                      const step = r.steps.find((s) => s.step === name);
                      return <StepCard key={name} name={name} step={step} />;
                    })}
                  </ol>
                  {r.error_message && (
                    <p className="mt-2 text-xs text-destructive">{r.error_message}</p>
                  )}
                  {r.article_id && (
                    <p className="mt-2 text-xs">
                      <a className="text-brand hover:underline" href={`/articles/${r.article_id}`}>
                        → Mở bài viết
                      </a>
                    </p>
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

function StatusBadge({ status }: { status: PipelineRun['status'] }) {
  const styles = {
    pending: 'bg-muted text-muted-foreground',
    running: 'bg-amber-100 text-amber-800',
    succeeded: 'bg-emerald-100 text-emerald-800',
    failed: 'bg-rose-100 text-rose-800',
    cancelled: 'bg-zinc-200 text-zinc-700',
  } as const;
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${styles[status]}`}>{status}</span>
  );
}

function StepCard({ name, step }: { name: PipelineStepName; step: PipelineStep | undefined }) {
  const status: PipelineStepStatus = step?.status ?? 'pending';
  const Icon =
    status === 'succeeded'
      ? CheckCircle2
      : status === 'failed'
        ? XCircle
        : status === 'running'
          ? Loader2
          : status === 'skipped'
            ? MinusCircle
            : Circle;
  const color =
    status === 'succeeded'
      ? 'text-emerald-600'
      : status === 'failed'
        ? 'text-rose-600'
        : status === 'running'
          ? 'text-amber-600 animate-spin'
          : status === 'skipped'
            ? 'text-zinc-400'
            : 'text-muted-foreground';
  return (
    <li className="rounded border bg-muted/20 p-2 text-xs">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="font-medium">{STEP_LABEL[name]}</span>
      </div>
      {step?.details && (
        <ul className="mt-1 ml-6 space-y-0.5 text-muted-foreground">
          {Object.entries(step.details).map(([k, v]) => (
            <li key={k} className="truncate">
              {k}: <span className="font-mono">{String(v)}</span>
            </li>
          ))}
        </ul>
      )}
      {step?.error_message && <p className="mt-1 ml-6 text-destructive">{step.error_message}</p>}
    </li>
  );
}
