'use client';

import { useEffect, useState } from 'react';
import { OutlineForm } from '@/components/features/content/outline-form';
import { OutlineDisplay } from '@/components/features/content/outline-display';
import { ArticleEditor } from '@/components/features/content/article-editor';
import { ManualOutlineForm } from '@/components/features/content/manual-outline-form';
import { BatchKeywordPanel } from '@/components/features/content/batch-keyword-panel';
import {
  type ArticleResult,
  type OutlineWithMetadata,
  type BrandVoiceListItem,
  brandVoicesApi,
} from '@/lib/api/content';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

type ContentMode = 'single' | 'manual-outline' | 'batch';

export default function ContentPage() {
  const [mode, setMode] = useState<ContentMode>('single');
  const [outline, setOutline] = useState<OutlineWithMetadata | null>(null);
  const [article, setArticle] = useState<ArticleResult | null>(null);
  const [brandVoices, setBrandVoices] = useState<BrandVoiceListItem[]>([]);
  const [selectedBv, setSelectedBv] = useState<string>('');

  useEffect(() => {
    brandVoicesApi
      .list()
      .then((items) => {
        setBrandVoices(items);
        const defaultBrandVoice = items.find((item) => item.is_default);
        if (defaultBrandVoice) setSelectedBv(defaultBrandVoice.id);
      })
      .catch(() => {
        setBrandVoices([]);
      });
  }, []);

  function handleOutline(outlineValue: OutlineWithMetadata) {
    setOutline(outlineValue);
    setArticle(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sinh nội dung AI</h1>
        <p className="text-sm text-muted-foreground">
          Tạo 1 bài, nhập outline có sẵn, hoặc chạy hàng loạt nhiều keyword theo thứ tự.
        </p>
      </div>

      {brandVoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Brand voice</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-w-md space-y-2">
              <Label htmlFor="brand-voice">Chọn brand voice cho bài viết</Label>
              <Select
                id="brand-voice"
                value={selectedBv}
                onChange={(event) => setSelectedBv(event.target.value)}
              >
                <option value="">— Không dùng brand voice —</option>
                {brandVoices.map((brandVoice) => (
                  <option key={brandVoice.id} value={brandVoice.id}>
                    {brandVoice.name}
                    {brandVoice.is_default ? ' (mặc định)' : ''} · {brandVoice.sample_count} sample
                  </option>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant={mode === 'single' ? 'default' : 'outline'} onClick={() => setMode('single')}>
          Tạo 1 bài
        </Button>
        <Button
          variant={mode === 'manual-outline' ? 'default' : 'outline'}
          onClick={() => setMode('manual-outline')}
        >
          Nhập outline
        </Button>
        <Button variant={mode === 'batch' ? 'default' : 'outline'} onClick={() => setMode('batch')}>
          Batch keyword
        </Button>
      </div>

      {mode === 'single' && <OutlineForm onGenerated={handleOutline} />}
      {mode === 'manual-outline' && <ManualOutlineForm onGenerated={handleOutline} />}
      {mode === 'batch' && <BatchKeywordPanel brandVoiceId={selectedBv || undefined} />}

      {mode !== 'batch' && outline && (
        <OutlineDisplay
          outline={outline}
          brandVoiceId={selectedBv || undefined}
          onArticleStreamed={(_events, result) => {
            if (result) setArticle(result);
          }}
        />
      )}

      {mode !== 'batch' && article && <ArticleEditor article={article} />}
    </div>
  );
}
