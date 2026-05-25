'use client';

import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type ArticleStreamEvent,
  type ArticleResult,
  type OutlineWithMetadata,
  contentApi,
} from '@/lib/api/content';

interface OutlineDisplayProps {
  outline: OutlineWithMetadata;
  brandVoiceId?: string;
  onArticleStreamed: (events: ArticleStreamEvent[], result: ArticleResult | null) => void;
}

export function OutlineDisplay({ outline, brandVoiceId, onArticleStreamed }: OutlineDisplayProps) {
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
      for await (const ev of contentApi.streamArticle({
        keyword: outline.h1
          .replace(/^\[STUB\]\s*/i, '')
          .split(':')[0]
          .trim(),
        outline: { h1: outline.h1, sections: outline.sections },
        brand_voice_id: brandVoiceId,
        format: outline.metadata.format as 'blog' | 'how-to' | 'listicle',
        target_word_count: outline.metadata.target_word_count,
      })) {
        events.push(ev);
        if (ev.type === 'token') setTokenCount((c) => c + 1);
        if (ev.type === 'section_complete') {
          setSectionEvents((arr) => [...arr, ev.section_title]);
        }
        if (ev.type === 'complete') {
          // Backend persisted the article — pull the full row.
          try {
            result = await contentApi.getArticle(ev.article_id);
          } catch {
            result = null;
          }
        }
        if (ev.type === 'error') setError(ev.message);
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
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-lg">{outline.h1}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {outline.sections.length} H2 · model:{' '}
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
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Streaming {tokenCount} tokens...
            </>
          ) : (
            <>
              Viết bài hoàn chỉnh <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {outline.sections.map((section, i) => (
          <div key={`s${i}`} className="rounded-md border bg-muted/30 p-3">
            <p className="font-medium">
              {i + 1}. {section.h2}
            </p>
            <ul className="mt-2 space-y-1 pl-4">
              {section.subsections.map((sub, j) => (
                <li key={`s${i}-${j}`} className="text-sm">
                  <span className="font-medium">{sub.h3}</span>
                  <ul className="ml-4 list-disc text-xs text-muted-foreground">
                    {sub.bullets.map((b, k) => (
                      <li key={`s${i}-${j}-${k}`}>{b}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {sectionEvents.length > 0 && (
          <div className="rounded-md border-l-4 border-l-brand bg-brand/5 p-3 text-sm">
            <p className="font-medium">Stream progress:</p>
            <ul className="mt-1 list-disc pl-4 text-xs">
              {sectionEvents.map((title, i) => (
                <li key={i}>✓ {title}</li>
              ))}
            </ul>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
