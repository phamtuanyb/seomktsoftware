import { Injectable, Logger } from '@nestjs/common';

export interface FetchedArticle {
  title: string | null;
  content: string;
  excerpt: string | null;
  byline: string | null;
  source_url: string;
  /** Words after readability extraction. */
  word_count: number;
}

/**
 * Section 8 TN5 step 1 — "Fetch content từ URL (dùng @mozilla/readability)".
 *
 * Two phases:
 *   1. Plain `fetch()` → grab raw HTML.
 *   2. Run JSDOM + Readability to extract a clean article body.
 *
 * Heavy deps (jsdom, readability) are lazy-imported so the import chain
 * stays cheap when nobody is training brand voices. Errors fall back to a
 * cheerio body-text extraction so a partially failed page still produces
 * usable training data.
 */
@Injectable()
export class UrlFetcherService {
  private readonly logger = new Logger(UrlFetcherService.name);

  async fetch(url: string, timeoutMs = 12_000): Promise<FetchedArticle> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    let html: string;
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 MKTSEOBot/1.0 (+https://github.com/anthropics/claude)',
          Accept: 'text/html,application/xhtml+xml',
        },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} fetching ${url}`);
      }
      html = await res.text();
    } finally {
      clearTimeout(t);
    }

    const readable = await this.runReadability(html, url).catch((err) => {
      this.logger.warn(`Readability failed for ${url}: ${(err as Error).message}`);
      return null;
    });

    if (readable && readable.content) {
      return {
        title: readable.title,
        content: readable.content,
        excerpt: readable.excerpt,
        byline: readable.byline,
        source_url: url,
        word_count: this.countWords(readable.content),
      };
    }

    // Fallback to cheerio body-text extraction.
    const fallback = await this.cheerioFallback(html);
    return {
      title: fallback.title,
      content: fallback.content,
      excerpt: null,
      byline: null,
      source_url: url,
      word_count: this.countWords(fallback.content),
    };
  }

  private async runReadability(
    html: string,
    url: string,
  ): Promise<{
    title: string | null;
    content: string;
    excerpt: string | null;
    byline: string | null;
  } | null> {
    const [{ JSDOM }, { Readability }] = await Promise.all([
      import('jsdom'),
      import('@mozilla/readability'),
    ]);
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const parsed = reader.parse();
    if (!parsed) return null;
    return {
      title: parsed.title ?? null,
      // textContent strips tags so the LLM doesn't see CSS / scripts.
      content: parsed.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      excerpt: parsed.excerpt ?? null,
      byline: parsed.byline ?? null,
    };
  }

  private async cheerioFallback(html: string): Promise<{ title: string | null; content: string }> {
    const cheerioMod = await import('cheerio');
    const $ = cheerioMod.load(html);
    $('script, style, nav, header, footer, aside').remove();
    const title = $('title').first().text().trim() || $('h1').first().text().trim() || null;
    const content = $('article').text() || $('main').text() || $('body').text();
    return {
      title,
      content: content.replace(/\s+/g, ' ').trim(),
    };
  }

  private countWords(text: string): number {
    const t = text.trim();
    return t ? t.split(/\s+/).length : 0;
  }
}
