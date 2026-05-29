'use client';

import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type ArticleStreamEvent,
  type ArticleResult,
  type OutlineFormat,
  type OutlineWithMetadata,
  contentApi,
} from '@/lib/api/content';

interface OutlineDisplayProps {
  outline: OutlineWithMetadata;
  brandVoiceId?: string;
  onArticleStreamed: (events: ArticleStreamEvent[], result: ArticleResult | null) => void;
}

export function OutlineDisplay({
  outline,
  brandVoiceId,
  onArticleStreamed,
}: OutlineDisplayProps) {
  const [streaming, setStreaming] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);
  const [sectionEvents, setSectionEvents] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function writeArticle() {
    setStreaming(true);
    setTokenCount(0);
    setSectionEvents([]);
    setError(null);

    const events: ArticleStreamEvent[] = [];
    let result: ArticleResult | null = null;

    try {
      for await (const event of contentApi.streamArticle({
        keyword: outline.h1.replace(/^\[STUB\]\s*/i, '').split(':')[0].trim(),
        outline: {
          meta_title: outline.meta_title,
          meta_description: outline.meta_description,
          h1: outline.h1,
          sections: outline.sections,
        },
        brand_voice_id: brandVoiceId,
        format: outline.metadata.format as OutlineFormat,
        target_word_count: outline.metadata.target_word_count,
      })) {
        events.push(event);
        if (event.type === 'token') setTokenCount((count) => count + 1);
        if (event.type === 'section_complete') {
          setSectionEvents((current) => [...current, event.section_title]);
        }
        if (event.type === 'complete') {
          try {
            result = await contentApi.getArticle(event.article_id);
          } catch {
            result = null;
          }
        }
        if (event.type === 'error') setError(event.message);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStreaming(false);
      onArticleStreamed(events, result);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-lg">{outline.h1}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {outline.sections.length} H2 chính · model:{' '}
            <code className="text-xs">{outline.metadata.ai_model}</code>
            {outline.metadata.is_stub && (
              <span className="ml-2 rounded bg-yellow-100 px-2 py-0.5 text-yellow-800">STUB</span>
            )}
            {outline.metadata.cached && (
              <span className="ml-2 rounded bg-green-100 px-2 py-0.5 text-green-800">cached</span>
            )}
          </p>
        </div>
        <Button onClick={writeArticle} disabled={streaming}>
          {streaming ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Đang viết {tokenCount} tokens...
            </>
          ) : (
            <>
              Viết bài hoàn chỉnh <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border bg-muted/20 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Meta Title
            </p>
            <p className="mt-1 text-sm font-medium">{outline.meta_title}</p>
          </div>
          <div className="rounded-md border bg-muted/20 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Meta Description
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{outline.meta_description}</p>
          </div>
        </div>

        {outline.sections.map((section, sectionIndex) => (
          <div key={`section-${sectionIndex}`} className="rounded-md border bg-muted/30 p-3">
            <p className="font-medium">
              {sectionIndex + 1}. {section.h2}
            </p>
            <ul className="mt-2 space-y-1 pl-4">
              {section.subsections.map((subsection, subsectionIndex) => (
                <li key={`sub-${sectionIndex}-${subsectionIndex}`} className="text-sm">
                  <span className="font-medium">{subsection.h3}</span>
                  <ul className="ml-4 list-disc text-xs text-muted-foreground">
                    {subsection.bullets.map((bullet, bulletIndex) => (
                      <li key={`bullet-${sectionIndex}-${subsectionIndex}-${bulletIndex}`}>
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {sectionEvents.length > 0 && (
          <div className="rounded-md border-l-4 border-l-brand bg-brand/5 p-3 text-sm">
            <p className="font-medium">Tiến độ streaming:</p>
            <ul className="mt-1 list-disc pl-4 text-xs">
              {sectionEvents.map((title, index) => (
                <li key={index}>Hoàn thành: {title}</li>
              ))}
            </ul>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
