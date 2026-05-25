import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { KeywordProxyService } from './proxy.service';
import {
  type KeywordSourceProvider,
  type KeywordSourceQuery,
  type KeywordSourceResult,
} from './keyword-source.interface';
import { stubPaaSuggestions } from './stub-suggestions';

/**
 * Google "People Also Ask" (PAA) scraper. Hits the standard Google search
 * results page through a proxy with JS rendering on, then cheerio-extracts
 * the questions from the accordion blocks (`[data-initq]` + `div[role="heading"]`
 * inside `.related-question-pair`).
 *
 * Section 8 TN1: PAA needs a proxy + anti-bot capable provider (Bright Data
 * Web Unlocker recommended). Without that we fall back to the canned PAA
 * patterns so the rest of the suggestion pipeline still works.
 */
@Injectable()
export class PaaProvider implements KeywordSourceProvider {
  readonly source = 'paa' as const;
  private readonly logger = new Logger(PaaProvider.name);

  constructor(private readonly proxy: KeywordProxyService) {}

  async fetch(query: KeywordSourceQuery): Promise<KeywordSourceResult> {
    const started = Date.now();
    if (!this.proxy.isAvailable()) return this.stubResult(query, started);

    const url = `https://www.google.com/search?q=${encodeURIComponent(query.seed)}&hl=${encodeURIComponent(query.language)}&gl=${encodeURIComponent(query.country)}`;
    try {
      const res = await this.proxy.fetch(url, {
        renderJs: true,
        country: query.country,
        retries: 3,
        timeoutMs: 20_000,
      });
      if (res.status === 0 || !res.body) return this.stubResult(query, started, 'empty body');

      const questions = this.extractPaaQuestions(res.body);
      if (questions.length === 0) return this.stubResult(query, started, 'no PAA on page');

      return {
        source: this.source,
        suggestions: questions.slice(0, query.limit).map((keyword, i) => ({
          keyword,
          source: this.source,
          rank: i + 1,
        })),
        duration_ms: Date.now() - started,
        is_stub: false,
      };
    } catch (err) {
      this.logger.warn(`PAA live fetch failed: ${(err as Error).message}`);
      return this.stubResult(query, started, (err as Error).message);
    }
  }

  /** Exposed for unit tests — pure HTML → string[] of questions. */
  extractPaaQuestions(html: string): string[] {
    const $ = cheerio.load(html);
    const out = new Set<string>();
    // Multiple Google SERP layouts — try several selectors.
    $('div.related-question-pair [role="heading"]').each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (text) out.add(text);
    });
    $('div[data-initq]').each((_, el) => {
      const text = $(el).attr('data-initq') ?? $(el).text();
      const cleaned = text.replace(/\s+/g, ' ').trim();
      if (cleaned) out.add(cleaned);
    });
    return [...out];
  }

  private stubResult(
    query: KeywordSourceQuery,
    started: number,
    error?: string,
  ): KeywordSourceResult {
    return {
      source: this.source,
      suggestions: stubPaaSuggestions(query.seed, query.limit).map((keyword, i) => ({
        keyword,
        source: this.source,
        rank: i + 1,
      })),
      duration_ms: Date.now() - started,
      is_stub: true,
      ...(error ? { error } : {}),
    };
  }
}
