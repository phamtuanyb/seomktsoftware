import { Injectable, Logger } from '@nestjs/common';
import { KeywordProxyService } from './proxy.service';
import {
  type KeywordSourceProvider,
  type KeywordSourceQuery,
  type KeywordSourceResult,
} from './keyword-source.interface';
import { stubGoogleSuggestions } from './stub-suggestions';

/**
 * Google Autocomplete provider — `https://www.google.com/complete/search`
 * with `client=chrome` returns a 4-element JSON array where index 1 is the
 * suggestion list. Spec Section 8 TN1.
 *
 * Stub mode kicks in when no proxy is configured OR when the live fetch
 * fails — keeps `pnpm dev` working end-to-end without burning credits.
 */
@Injectable()
export class GoogleSuggestProvider implements KeywordSourceProvider {
  readonly source = 'google_suggest' as const;
  private readonly logger = new Logger(GoogleSuggestProvider.name);

  constructor(private readonly proxy: KeywordProxyService) {}

  async fetch(query: KeywordSourceQuery): Promise<KeywordSourceResult> {
    const started = Date.now();
    const url = `https://www.google.com/complete/search?client=chrome&q=${encodeURIComponent(query.seed)}&hl=${encodeURIComponent(query.language)}&gl=${encodeURIComponent(query.country)}`;

    if (!this.proxy.isAvailable()) {
      return this.stubResult(query, started);
    }

    try {
      const res = await this.proxy.fetch(url, {
        country: query.country,
        retries: 3,
        timeoutMs: 12_000,
      });
      if (res.status === 0 || !res.body) return this.stubResult(query, started, 'empty body');

      const parsed = JSON.parse(res.body) as unknown[];
      const list = Array.isArray(parsed) && Array.isArray(parsed[1]) ? (parsed[1] as string[]) : [];
      if (list.length === 0) return this.stubResult(query, started, 'no suggestions');

      const suggestions = list
        .slice(0, query.limit)
        .map((keyword, i) => ({ keyword: keyword.trim(), source: this.source, rank: i + 1 }))
        .filter((s) => s.keyword.length > 0);

      return {
        source: this.source,
        suggestions,
        duration_ms: Date.now() - started,
        is_stub: false,
      };
    } catch (err) {
      this.logger.warn(`Google suggest live fetch failed: ${(err as Error).message}`);
      return this.stubResult(query, started, (err as Error).message);
    }
  }

  private stubResult(
    query: KeywordSourceQuery,
    started: number,
    error?: string,
  ): KeywordSourceResult {
    return {
      source: this.source,
      suggestions: stubGoogleSuggestions(query.seed, query.limit).map((keyword, i) => ({
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
