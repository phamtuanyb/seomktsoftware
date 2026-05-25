'use client';

import { useEffect, useState } from 'react';
import { OutlineForm } from '@/components/features/content/outline-form';
import { OutlineDisplay } from '@/components/features/content/outline-display';
import { ArticleEditor } from '@/components/features/content/article-editor';
import {
  type ArticleResult,
  type OutlineWithMetadata,
  type BrandVoiceListItem,
  brandVoicesApi,
} from '@/lib/api/content';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

export default function ContentPage() {
  const [outline, setOutline] = useState<OutlineWithMetadata | null>(null);
  const [article, setArticle] = useState<ArticleResult | null>(null);
  const [brandVoices, setBrandVoices] = useState<BrandVoiceListItem[]>([]);
  const [selectedBv, setSelectedBv] = useState<string>('');

  useEffect(() => {
    brandVoicesApi
      .list()
      .then((items) => {
        setBrandVoices(items);
        const def = items.find((b) => b.is_default);
        if (def) setSelectedBv(def.id);
      })
      .catch(() => {
        // Empty list is fine.
      });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sinh nội dung AI</h1>
        <p className="text-sm text-muted-foreground">
          Section 8 TN3 + TN4 — outline + viết bài full + streaming SSE. Stub mode đến khi paste
          ANTHROPIC_API_KEY thật.
        </p>
      </div>

      {brandVoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Brand voice (TN5)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-w-md space-y-2">
              <Label htmlFor="bv">Chọn brand voice cho bài viết</Label>
              <Select id="bv" value={selectedBv} onChange={(e) => setSelectedBv(e.target.value)}>
                <option value="">— Không dùng brand voice —</option>
                {brandVoices.map((bv) => (
                  <option key={bv.id} value={bv.id}>
                    {bv.name}
                    {bv.is_default ? ' (mặc định)' : ''} · {bv.sample_count} sample
                  </option>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      <OutlineForm
        onGenerated={(o) => {
          setOutline(o);
          setArticle(null);
        }}
      />

      {outline && (
        <OutlineDisplay
          outline={outline}
          brandVoiceId={selectedBv || undefined}
          onArticleStreamed={(_events, result) => {
            if (result) setArticle(result);
          }}
        />
      )}

      {article && <ArticleEditor article={article} />}
    </div>
  );
}
