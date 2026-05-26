'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { contentApi, type ArticleResult } from '@/lib/api/content';

export default function ArticleDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [article, setArticle] = useState<ArticleResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [status, setStatus] = useState<'draft' | 'ready' | 'published'>('draft');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.id) return;
    setLoading(true);
    contentApi
      .getArticle(params.id)
      .then((a) => {
        setArticle(a);
        setTitle(a.title);
        setMarkdown(a.content_markdown);
        setMetaTitle(a.meta_title);
        setMetaDescription(a.meta_description);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [params?.id]);

  async function handleSave() {
    if (!article) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await contentApi.updateArticle(article.id, {
        title,
        content_markdown: markdown,
        meta_title: metaTitle,
        meta_description: metaDescription,
        status,
      });
      setArticle(updated);
      setSuccess('Đã lưu.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!article || !window.confirm('Xoá bài viết này?')) return;
    try {
      await contentApi.deleteArticle(article.id);
      router.push('/articles');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">{error ?? 'Không tìm thấy bài viết.'}</p>
        <Button variant="outline" onClick={() => router.push('/articles')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Về danh sách
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" onClick={() => router.push('/articles')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại
          </Button>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Sửa bài viết</h1>
          <p className="text-sm text-muted-foreground">
            Score {article.content_score}/100 · {article.word_count} từ · {article.ai_model}
            {article.is_stub && <span className="ml-2 text-amber-700">(stub)</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDelete}>
            <Trash2 className="mr-2 h-4 w-4 text-destructive" /> Xoá
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Lưu
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nội dung</CardTitle>
          <CardDescription>
            Markdown là nguồn chính — HTML và word_count tự cập nhật khi lưu.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Tiêu đề</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={500}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="md">Markdown</Label>
            <Textarea
              id="md"
              rows={20}
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SEO meta</CardTitle>
          <CardDescription>
            Section 8 TN4 — meta_description 140-160 ký tự cho preview SERP.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mt">Meta title</Label>
            <Input
              id="mt"
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground">{metaTitle.length}/60 ký tự khuyến nghị</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="md-desc">Meta description</Label>
            <Textarea
              id="md-desc"
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              maxLength={300}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {metaDescription.length}/160 ký tự khuyến nghị
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Trạng thái</Label>
            <select
              id="status"
              className="h-9 w-full max-w-xs rounded-md border bg-background px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
            >
              <option value="draft">Bản nháp</option>
              <option value="ready">Sẵn sàng</option>
              <option value="published">Đã xuất bản</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-700">{success}</p>}
    </div>
  );
}
