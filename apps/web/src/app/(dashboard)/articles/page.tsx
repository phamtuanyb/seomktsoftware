'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, Loader2, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { contentApi, type ArticleResult } from '@/lib/api/content';

type StatusFilter = '' | 'draft' | 'ready' | 'published';

export default function ArticlesPage() {
  const [items, setItems] = useState<ArticleResult[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'fresh' | 'more') => {
      if (mode === 'fresh') setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const res = await contentApi.listArticles({
          limit: 20,
          q: search.trim() || undefined,
          status: status || undefined,
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
    [search, status, cursor],
  );

  useEffect(() => {
    void load('fresh');
    // intentionally exclude `load` — only refresh on filter change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function handleDelete(id: string) {
    if (!window.confirm('Xoá bài viết này?')) return;
    try {
      await contentApi.deleteArticle(id);
      setItems((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bài viết</h1>
        <p className="text-sm text-muted-foreground">
          Section 8 TN4 — tất cả bài viết đã sinh. Click để mở editor, xoá để soft-delete.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bộ lọc</CardTitle>
          <CardDescription>
            Tìm theo tiêu đề / từ khóa mục tiêu, lọc theo trạng thái.
          </CardDescription>
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
              placeholder="Tìm tiêu đề hoặc từ khóa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={status}
              onChange={(e) => {
                setCursor(null);
                setStatus(e.target.value as StatusFilter);
              }}
            >
              <option value="">Tất cả</option>
              <option value="draft">Bản nháp</option>
              <option value="ready">Sẵn sàng</option>
              <option value="published">Đã xuất bản</option>
            </select>
            <Button type="submit" variant="outline">
              <Search className="mr-2 h-4 w-4" /> Tìm
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{loading ? 'Đang tải...' : `${items.length} bài viết`}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Chưa có bài viết nào. Vào trang Nội dung để sinh bài đầu tiên.
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {items.map((a) => (
                <li key={a.id} className="flex items-start justify-between p-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/articles/${a.id}`}
                      className="block truncate font-medium hover:underline"
                    >
                      {a.title || '(không tiêu đề)'}
                    </Link>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      <span className="mr-2 inline-flex items-center rounded bg-muted px-1.5 py-0.5">
                        {a.target_keyword || 'không rõ keyword'}
                      </span>
                      <span className="mr-2">
                        Score{' '}
                        <strong
                          className={
                            a.content_score >= 80
                              ? 'text-emerald-700'
                              : a.content_score >= 60
                                ? 'text-amber-700'
                                : 'text-rose-700'
                          }
                        >
                          {a.content_score}
                        </strong>
                      </span>
                      <span className="mr-2">{a.word_count} từ</span>
                      <span>{a.ai_model}</span>
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button asChild variant="ghost" size="sm" aria-label="Xem">
                      <Link href={`/articles/${a.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Xoá"
                      onClick={() => handleDelete(a.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
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
