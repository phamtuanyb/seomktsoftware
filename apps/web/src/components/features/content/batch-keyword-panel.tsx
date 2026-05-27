'use client';

import { useEffect, useState } from 'react';
import { Loader2, ListOrdered, RefreshCw, SquareX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { contentApi, type ContentBatchJob } from '@/lib/api/content';

interface BatchKeywordPanelProps {
  brandVoiceId?: string;
}

export function BatchKeywordPanel({ brandVoiceId }: BatchKeywordPanelProps) {
  const [keywordsText, setKeywordsText] = useState('');
  const [format, setFormat] = useState<
    'blog' | 'listicle' | 'how-to' | 'review' | 'comparison' | 'faq' | 'landing' | 'product'
  >('blog');
  const [wordCount, setWordCount] = useState(2000);
  const [jobs, setJobs] = useState<ContentBatchJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadJobs(showSpinner = false) {
    if (showSpinner) setRefreshing(true);
    try {
      const res = await contentApi.listBatchJobs({ limit: 10 });
      setJobs(res.items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      if (showSpinner) setRefreshing(false);
    }
  }

  useEffect(() => {
    loadJobs();
    const timer = window.setInterval(() => {
      loadJobs();
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const created = await contentApi.createBatchJob({
        keywords_text: keywordsText,
        format,
        target_word_count: wordCount,
        brand_voice_id: brandVoiceId,
      });
      setJobs((current) => [created, ...current.filter((job) => job.id !== created.id)]);
      setKeywordsText('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(id: string) {
    try {
      const updated = await contentApi.cancelBatchJob(id);
      setJobs((current) => current.map((job) => (job.id === id ? updated : job)));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand/10 text-brand">
              <ListOrdered className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Tạo hàng loạt theo keyword</CardTitle>
              <CardDescription>
                Mỗi dòng 1 keyword. Hệ thống sẽ sinh outline rồi viết bài theo đúng thứ tự nhập.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="batch-format">Format</Label>
                <Select
                  id="batch-format"
                  value={format}
                  onChange={(event) => setFormat(event.target.value as typeof format)}
                >
                  <option value="blog">Blog</option>
                  <option value="listicle">Listicle</option>
                  <option value="how-to">How-to</option>
                  <option value="review">Review</option>
                  <option value="comparison">Comparison</option>
                  <option value="faq">FAQ</option>
                  <option value="landing">Landing</option>
                  <option value="product">Product</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="batch-words">Số từ mục tiêu</Label>
                <Input
                  id="batch-words"
                  type="number"
                  min={1500}
                  max={5000}
                  step={100}
                  value={wordCount}
                  onChange={(event) => setWordCount(Number(event.target.value) || 2000)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="batch-count">Số keyword</Label>
                <Input
                  id="batch-count"
                  readOnly
                  value={keywordsText.split(/\r?\n/).map((row) => row.trim()).filter(Boolean).length}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="batch-keywords">Danh sách keyword</Label>
              <Textarea
                id="batch-keywords"
                className="min-h-[220px]"
                value={keywordsText}
                onChange={(event) => setKeywordsText(event.target.value)}
                placeholder={`keyword 1
keyword 2
keyword 3`}
              />
            </div>

            {error && <Textarea readOnly className="text-sm text-destructive" value={`Loi: ${error}`} />}

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={loading || !keywordsText.trim()}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang tạo batch...
                  </>
                ) : (
                  <>
                    <ListOrdered className="mr-2 h-4 w-4" />
                    Chạy batch
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => loadJobs(true)} disabled={refreshing}>
                {refreshing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang làm mới...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Làm mới
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Batch jobs</CardTitle>
          <CardDescription>{jobs.length} job gần nhất, tự làm mới mỗi 5 giây.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {jobs.length === 0 && <p className="text-sm text-muted-foreground">Chưa có batch job nào.</p>}
          {jobs.map((job) => (
            <div key={job.id} className="rounded-md border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {job.completed_items}/{job.total_items} xong · {job.failed_items} lỗi · trạng thái{' '}
                    <span className="font-semibold">{job.status}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    format={(job.config.format as string) ?? 'blog'} · words=
                    {(job.config.target_word_count as number) ?? 2000}
                  </p>
                </div>
                {job.status === 'pending' || job.status === 'running' ? (
                  <Button variant="outline" size="sm" onClick={() => handleCancel(job.id)}>
                    <SquareX className="mr-2 h-4 w-4" />
                    Hủy
                  </Button>
                ) : null}
              </div>

              <div className="mt-3 space-y-2">
                {job.items.map((item) => (
                  <div
                    key={item.id}
                    className="grid gap-2 rounded border bg-muted/20 px-3 py-2 text-sm md:grid-cols-[48px_1fr_160px_140px]"
                  >
                    <span className="text-muted-foreground">#{item.order_index + 1}</span>
                    <span>{item.keyword}</span>
                    <span className="font-medium">{item.status}</span>
                    <span className="text-right">
                      {item.article_id ? (
                        <a className="text-brand underline" href={`/articles/${item.article_id}`}>
                          Mở bài
                        </a>
                      ) : item.error_message ? (
                        <span className="text-destructive">{item.error_message}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
