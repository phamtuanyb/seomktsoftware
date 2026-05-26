'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Globe, Loader2, Plus, RotateCcw, Trash2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  publisherApi,
  type PublishJobSummary,
  type SiteSummary,
  type TestConnectionResult,
} from '@/lib/api/publisher';
import { contentApi, type ArticleResult } from '@/lib/api/content';

interface JobRow extends PublishJobSummary {
  site_name?: string;
  article_title?: string;
}

export default function PublisherPage() {
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [articles, setArticles] = useState<ArticleResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Connect form
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [creatingSite, setCreatingSite] = useState(false);

  // Publish form
  const [publishArticleId, setPublishArticleId] = useState('');
  const [publishSiteId, setPublishSiteId] = useState('');
  const [publishStatus, setPublishStatus] = useState<'draft' | 'publish' | 'future'>('publish');
  const [scheduledAt, setScheduledAt] = useState('');
  const [categories, setCategories] = useState('');
  const [tags, setTags] = useState('');
  const [publishing, setPublishing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [s, a, j] = await Promise.all([
        publisherApi.listSites(),
        contentApi.listArticles().catch(() => [] as ArticleResult[]),
        publisherApi.listJobs(),
      ]);
      setSites(s);
      setArticles(a);
      const titleById = new Map(a.map((x) => [x.id, x.title]));
      const siteById = new Map(s.map((x) => [x.id, x.name ?? x.url]));
      setJobs(
        j.map((row) => ({
          ...row,
          article_title: titleById.get(row.article_id),
          site_name: siteById.get(row.site_id) ?? row.site_id,
        })),
      );
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setCreatingSite(true);
    try {
      const created = await publisherApi.createSite({
        url: url.trim(),
        name: name.trim() || undefined,
        username: username.trim(),
        application_password: appPassword,
      });
      setInfo(
        `Đã thêm "${created.name ?? created.url}" — status ${created.status}${
          created.plugin_seo_detected ? `, SEO plugin: ${created.plugin_seo_detected}` : ''
        }.`,
      );
      setUrl('');
      setName('');
      setUsername('');
      setAppPassword('');
      refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreatingSite(false);
    }
  }

  async function handleTest(id: string) {
    try {
      const r: TestConnectionResult = await publisherApi.testSite(id);
      setInfo(
        r.ok
          ? `Site OK${r.seo_plugin ? ` — SEO plugin: ${r.seo_plugin}` : ''}`
          : `Site lỗi: ${r.reason}`,
      );
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDeleteSite(id: string) {
    if (!window.confirm('Xoá site này? Tất cả publish job liên quan vẫn được giữ lại.')) return;
    try {
      await publisherApi.deleteSite(id);
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setPublishing(true);
    try {
      if (!publishArticleId || !publishSiteId) throw new Error('Chọn article + site trước.');
      const job = await publisherApi.publish({
        article_id: publishArticleId,
        site_id: publishSiteId,
        status: publishStatus,
        scheduled_at: publishStatus === 'future' ? new Date(scheduledAt).toISOString() : undefined,
        categories: categories
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        tags: tags
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setInfo(`Đã enqueue job ${job.id} (status=${job.status}).`);
      refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPublishing(false);
    }
  }

  async function handleCancelJob(id: string) {
    if (!window.confirm('Huỷ publish job này?')) return;
    try {
      await publisherApi.cancelJob(id);
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">WordPress Publisher</h1>
        <p className="text-sm text-muted-foreground">
          Section 8 TN8 — Auto detect Yoast/RankMath/SEOPress, AES-256-GCM credentials, BullMQ với
          retry exponential backoff, rate limit 10 bài/site/giờ.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-destructive bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {info && (
        <p className="rounded-md border border-brand bg-brand/5 p-3 text-sm text-brand">{info}</p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sites đã kết nối</CardTitle>
            <CardDescription>{sites.length} site · auto poll mỗi 5 s</CardDescription>
          </CardHeader>
          <CardContent>
            {sites.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có site nào.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {sites.map((s) => (
                  <li key={s.id} className="space-y-2 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="flex items-center gap-2 font-medium">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          {s.name ?? s.url}
                          {s.status === 'active' ? (
                            <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">
                              active
                            </span>
                          ) : (
                            <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">
                              {s.status}
                            </span>
                          )}
                          {s.plugin_seo_detected && s.plugin_seo_detected !== 'none' && (
                            <span className="rounded bg-brand/10 px-2 py-0.5 text-xs text-brand">
                              {s.plugin_seo_detected}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {s.url} · {s.username}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTest(s.id)}
                          aria-label="Test"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSite(s.id)}
                          aria-label="Xoá"
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kết nối site mới</CardTitle>
            <CardDescription>
              Nhập WP URL + Application Password (WP 5.6+). Password mã hoá AES-256-GCM trước khi
              lưu DB.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleConnect} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="site-url">URL</Label>
                <Input
                  id="site-url"
                  type="url"
                  required
                  placeholder="https://my-blog.example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-name">Tên (tuỳ chọn)</Label>
                <Input id="site-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="site-user">Username</Label>
                  <Input
                    id="site-user"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="site-pass">App password</Label>
                  <Input
                    id="site-pass"
                    type="password"
                    required
                    minLength={8}
                    value={appPassword}
                    onChange={(e) => setAppPassword(e.target.value)}
                  />
                </div>
              </div>
              <Button type="submit" disabled={creatingSite}>
                {creatingSite ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang kết nối...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" /> Connect site
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Publish bài</CardTitle>
          <CardDescription>
            Chọn 1 bài + 1 site → enqueue BullMQ. Status="future" cần scheduled_at.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePublish} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pub-article">Bài viết</Label>
                <Select
                  id="pub-article"
                  required
                  value={publishArticleId}
                  onChange={(e) => setPublishArticleId(e.target.value)}
                >
                  <option value="">— chọn bài —</option>
                  {articles.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title.slice(0, 60)} (score {a.content_score})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pub-site">Site</Label>
                <Select
                  id="pub-site"
                  required
                  value={publishSiteId}
                  onChange={(e) => setPublishSiteId(e.target.value)}
                >
                  <option value="">— chọn site —</option>
                  {sites
                    .filter((s) => s.status === 'active' || true)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name ?? s.url}
                      </option>
                    ))}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="pub-status">Status</Label>
                <Select
                  id="pub-status"
                  value={publishStatus}
                  onChange={(e) =>
                    setPublishStatus(e.target.value as 'draft' | 'publish' | 'future')
                  }
                >
                  <option value="publish">publish</option>
                  <option value="draft">draft</option>
                  <option value="future">future (scheduled)</option>
                </Select>
              </div>
              {publishStatus === 'future' && (
                <div className="space-y-2">
                  <Label htmlFor="pub-sched">Scheduled at</Label>
                  <Input
                    id="pub-sched"
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    required
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="pub-cat">Categories (comma)</Label>
                <Input
                  id="pub-cat"
                  value={categories}
                  onChange={(e) => setCategories(e.target.value)}
                  placeholder="Tin SEO, Tutorial"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pub-tag">Tags (comma)</Label>
                <Input
                  id="pub-tag"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="seo, content"
                />
              </div>
            </div>
            <Button type="submit" disabled={publishing}>
              {publishing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang enqueue...
                </>
              ) : (
                <>Publish</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Publish jobs</CardTitle>
          <CardDescription>{jobs.length} job · auto-refresh mỗi 5 s</CardDescription>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có publish job nào.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Article</th>
                    <th className="px-3 py-2 text-left">Site</th>
                    <th className="px-3 py-2 text-left">Scheduled</th>
                    <th className="px-3 py-2 text-left">Result</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j) => (
                    <tr key={j.id} className="border-t">
                      <td className="px-3 py-2">
                        <span className={statusClass(j.status)}>{j.status}</span>
                        {j.retry_count > 0 && (
                          <span className="ml-2 text-[10px] text-muted-foreground">
                            retry {j.retry_count}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {j.article_title ?? j.article_id.slice(0, 8)}
                      </td>
                      <td className="px-3 py-2 text-xs">{j.site_name ?? j.site_id.slice(0, 8)}</td>
                      <td className="px-3 py-2 text-xs">
                        {j.scheduled_at ? new Date(j.scheduled_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {j.published_url ? (
                          <a
                            href={j.published_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand hover:underline"
                          >
                            View ↗
                          </a>
                        ) : j.error_message ? (
                          <span className="text-destructive" title={j.error_message}>
                            {j.error_code ?? 'error'}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {(j.status === 'pending' || j.status === 'failed') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelJob(j.id)}
                            aria-label="Huỷ"
                          >
                            <XCircle className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                        {j.status === 'completed' && (
                          <CheckCircle2 className="h-3 w-3 text-green-700" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function statusClass(status: string): string {
  const base = 'rounded px-2 py-0.5 text-xs font-medium';
  switch (status) {
    case 'completed':
      return `${base} bg-green-100 text-green-800`;
    case 'processing':
      return `${base} bg-blue-100 text-blue-800`;
    case 'failed':
      return `${base} bg-red-100 text-red-800`;
    case 'cancelled':
      return `${base} bg-gray-100 text-gray-700`;
    default:
      return `${base} bg-amber-100 text-amber-800`;
  }
}
