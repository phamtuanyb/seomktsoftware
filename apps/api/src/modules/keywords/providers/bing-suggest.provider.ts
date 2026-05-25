import { Injectable, Logger } from '@nestjs/common';
import { KeywordProxyService } from './proxy.service';
import {
  type KeywordSourceProvider,
  type KeywordSourceQuery,
  type KeywordSourceResult,
} from './keyword-source.interface';
import { stubBingSuggestions } from './stub-suggestions';

/**
 * Bing Autosuggest — `https://api.bing.com/osjson.aspx?query=...` returns
 * `["seed", ["suggestion1", "suggestion2", ...]]` (OpenSearch JSON shape).
 * No API key required for this public endpoint. Spec Section 8 TN1.
 */
@Injectable()
export class BingSuggestProvider implements KeywordSourceProvider {
  readonly source = 'bing_suggest' as const;
  private readonly logger = new Logger(BingSuggestProvider.name);

  constructor(private readonly proxy: KeywordProxyService) {}

  async fetch(query: KeywordSourceQuery): Promise<KeywordSourceResult> {
    const started = Date.now();
    const url = `https://api.bing.com/osjson.aspx?query=${encodeURIComponent(query.seed)}&mkt=${this.toMarket(query)}`;

    if (!this.proxy.isAvailable()) return this.stubResult(query, started);

    try {
      const res = await this.proxy.fetch(url, {
        country: query.country,
        retries: 3,
        timeoutMs: 10_000,
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
      this.logger.warn(`Bing suggest live fetch failed: ${(err as Error).message}`);
      return this.stubResult(query, started, (err as Error).message);
    }
  }

  /** Maps {language, country} to Bing's `mkt` parameter (`vi-VN`, `en-US`, ...). */
  private toMarket(query: KeywordSourceQuery): string {
    return `${query.language}-${query.country}`;
  }

  private stubResult(
    query: KeywordSourceQuery,
    started: number,
    error?: string,
  ): KeywordSourceResult {
    return {
      source: this.source,
      suggestions: stubBingSuggestions(query.seed, query.limit).map((keyword, i) => ({
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
