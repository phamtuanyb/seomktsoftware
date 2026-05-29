'use client';

import { useState } from 'react';
import { Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { contentApi, type OutlineWithMetadata } from '@/lib/api/content';

interface ManualOutlineFormProps {
  onGenerated: (outline: OutlineWithMetadata) => void;
}

export function ManualOutlineForm({ onGenerated }: ManualOutlineFormProps) {
  const [keyword, setKeyword] = useState('');
  const [format, setFormat] = useState<
    'blog' | 'listicle' | 'how-to' | 'review' | 'comparison' | 'faq' | 'landing' | 'product'
  >('blog');
  const [wordCount, setWordCount] = useState(2000);
  const [rawOutline, setRawOutline] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const outline = await contentApi.parseManualOutline({
        keyword: keyword.trim(),
        raw_outline: rawOutline.trim(),
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
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Nhập outline có sẵn</CardTitle>
            <CardDescription>
              Paste outline thủ công để bỏ qua TN3 và đi thẳng sang viết bài.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="manual-keyword">Keyword chính</Label>
              <Input
                id="manual-keyword"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                required
                minLength={2}
                maxLength={255}
                placeholder="VD: phần mềm đăng bài group"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-format">Format</Label>
              <Select
                id="manual-format"
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
              <Label htmlFor="manual-words">Số từ mục tiêu</Label>
              <Input
                id="manual-words"
                type="number"
                min={1500}
                max={5000}
                step={100}
                value={wordCount}
                onChange={(event) => setWordCount(Number(event.target.value) || 2000)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-outline">Outline</Label>
            <Textarea
              id="manual-outline"
              value={rawOutline}
              onChange={(event) => setRawOutline(event.target.value)}
              className="min-h-[260px]"
              placeholder={`Meta Title: ...
Meta Description: ...
H1: ...

H2: ...
H3: ...
- ý 1
- ý 2

H2: ...
## Heading markdown cũng được`}
              required
            />
          </div>

          {error && <Textarea readOnly className="text-sm text-destructive" value={`Lỗi: ${error}`} />}

          <Button
            type="submit"
            disabled={loading || keyword.trim().length < 2 || rawOutline.trim().length < 10}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang parse outline...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Dùng outline này
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
