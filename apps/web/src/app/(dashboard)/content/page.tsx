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
        const defaultBrandVoice = items.find((item) => item.is_default);
        if (defaultBrandVoice) setSelectedBv(defaultBrandVoice.id);
      })
      .catch(() => {
        setBrandVoices([]);
      });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sinh noi dung AI</h1>
        <p className="text-sm text-muted-foreground">
          Outline gon de duyet truoc, sau do viet bai hoan chinh theo brand voice va provider AI
          dang cau hinh.
        </p>
      </div>

      {brandVoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Brand voice</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-w-md space-y-2">
              <Label htmlFor="brand-voice">Chon brand voice cho bai viet</Label>
              <Select
                id="brand-voice"
                value={selectedBv}
                onChange={(event) => setSelectedBv(event.target.value)}
              >
                <option value="">— Khong dung brand voice —</option>
                {brandVoices.map((brandVoice) => (
                  <option key={brandVoice.id} value={brandVoice.id}>
                    {brandVoice.name}
                    {brandVoice.is_default ? ' (mac dinh)' : ''} · {brandVoice.sample_count} sample
                  </option>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      <OutlineForm
        onGenerated={(generatedOutline) => {
          setOutline(generatedOutline);
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
