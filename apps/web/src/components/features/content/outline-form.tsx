'use client';

import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { contentApi, type OutlineWithMetadata } from '@/lib/api/content';

interface OutlineFormProps {
  onGenerated: (outline: OutlineWithMetadata) => void;
}

export function OutlineForm({ onGenerated }: OutlineFormProps) {
  const [keyword, setKeyword] = useState('');
  const [intent, setIntent] = useState<
    'info' | 'commercial' | 'transactional' | 'navigational' | ''
  >('');
  const [format, setFormat] = useState<
    'blog' | 'listicle' | 'how-to' | 'review' | 'comparison' | 'faq' | 'landing' | 'product'
  >('blog');
  const [wordCount, setWordCount] = useState(2000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const outline = await contentApi.generateOutline({
        keyword: keyword.trim(),
        intent: intent || undefined,
        format,
        target_word_count: wordCount,
      });
      onGenerated(outline);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand/10 text-brand">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>TN3 — AI Outline Generator</CardTitle>
            <CardDescription>
              Phân tích top 5 SERP rồi sinh outline gọn hơn: Meta Title, Meta Description, H1,
              H2/H3 đủ dùng để duyệt trước khi viết.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="keyword">Keyword chính</Label>
            <Input
              id="keyword"
              required
              minLength={2}
              maxLength={255}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="VD: SEO local cho doanh nghiệp nhỏ"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="intent">Intent (để trống nếu muốn tự suy)</Label>
              <Select
                id="intent"
                value={intent}
                onChange={(event) =>
                  setIntent(
                    event.target.value as
                      | 'info'
                      | 'commercial'
                      | 'transactional'
                      | 'navigational'
                      | '',
                  )
                }
              >
                <option value="">Tự suy</option>
                <option value="info">Info</option>
                <option value="commercial">Commercial</option>
                <option value="transactional">Transactional</option>
                <option value="navigational">Navigational</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="format">Format</Label>
              <Select
                id="format"
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
              <Label htmlFor="words">Số từ mục tiêu</Label>
              <Input
                id="words"
                type="number"
                min={1500}
                max={5000}
                step={100}
                value={wordCount}
                onChange={(event) => setWordCount(Number(event.target.value) || 2000)}
              />
            </div>
          </div>

          {error && (
            <Textarea readOnly className="text-sm text-destructive" value={`Lỗi: ${error}`} />
          )}

          <Button type="submit" disabled={loading || keyword.trim().length < 2}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang phân tích SERP...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Sinh outline
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
