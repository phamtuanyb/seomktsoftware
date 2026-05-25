import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { RedisService } from '../../../common/services/redis.service';
import { GoogleSuggestProvider } from '../providers/google-suggest.provider';
import { BingSuggestProvider } from '../providers/bing-suggest.provider';
import { PaaProvider } from '../providers/paa.provider';
import {
  type KeywordSourceName,
  type KeywordSourceProvider,
  type KeywordSourceResult,
  type KeywordSuggestion,
} from '../providers/keyword-source.interface';
import type { SuggestKeywordsDto } from '../dto/suggest.dto';

export interface SuggestionStats {
  total_returned: number;
  total_raw: number;
  dedupe_rate: number;
  duration_ms: number;
  by_source: Record<
    KeywordSourceName,
    { count: number; duration_ms: number; is_stub: boolean; error?: string }
  >;
  cached: boolean;
}

export interface SuggestionResult {
  seed: string;
  language: string;
  country: string;
  sources_used: KeywordSourceName[];
  keywords: KeywordSuggestion[];
  stats: SuggestionStats;
}

/**
 * Section 8 TN1 — Keyword Suggestion. Fans out to enabled sources in
 * parallel via Promise.allSettled (Section 2 principle 4 — Event-Driven,
 * fault-tolerant), aggregates, dedupes, caches 7 days.
 *
 * Acceptance ref:
 *   - ≥200 keyword unique in <15s — achievable with stub fixtures + real
 *     proxy paths run in parallel.
 *   - Dedupe rate <10% — measured in the stats output.
 *   - Cache hit ratio >60% after 1 week — Redis 7-day TTL serves repeats.
 *   - Error rate <2% (fallback when 1 source fails) — Promise.allSettled +
 *     auto-stub fallback per provider.
 */
@Injectable()
export class SuggestionService {
  private readonly logger = new Logger(SuggestionService.name);
  private static readonly CACHE_PREFIX = 'keywords:suggest:';
  private static readonly CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

  private readonly registry: Record<KeywordSourceName, KeywordSourceProvider>;

  constructor(
    private readonly redis: RedisService,
    google: GoogleSuggestProvider,
    bing: BingSuggestProvider,
    paa: PaaProvider,
  ) {
    this.registry = {
      google_suggest: google,
      bing_suggest: bing,
      paa,
      manual: {
        source: 'manual',
        fetch: async () => ({ source: 'manual', suggestions: [], duration_ms: 0, is_stub: true }),
      },
    };
  }

  async suggest(dto: SuggestKeywordsDto): Promise<SuggestionResult> {
    const seed = dto.seed.trim();
    const sources = (dto.sources ?? [
      'google_suggest',
      'bing_suggest',
      'paa',
    ]) as KeywordSourceName[];
    const language = dto.language ?? 'vi';
    const country = dto.country ?? 'VN';
    const limit = dto.limit ?? 500;
    const started = Date.now();

    // 1) Cache lookup.
    const cacheKey = this.cacheKey({ seed, sources, language, country, limit });
    const cached = await this.redis.getClient().get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as SuggestionResult;
        parsed.stats.cached = true;
        return parsed;
      } catch {
        this.logger.warn(`Corrupt suggestion cache for ${cacheKey} — regenerating`);
      }
    }

    // 2) Dispatch in parallel. Each provider gets a proportional share of
    //    the overall limit so the sum doesn't overshoot.
    const perSourceLimit = Math.max(20, Math.ceil((limit * 1.5) / sources.length));
    const results = await Promise.allSettled(
      sources.map((s) =>
        this.registry[s].fetch({ seed, language, country, limit: perSourceLimit }),
      ),
    );

    // 3) Aggregate + dedupe (case + diacritic-insensitive on a normalized form
    //    but we KEEP the first-seen casing).
    const by_source: SuggestionStats['by_source'] = {
      google_suggest: { count: 0, duration_ms: 0, is_stub: false },
      bing_suggest: { count: 0, duration_ms: 0, is_stub: false },
      paa: { count: 0, duration_ms: 0, is_stub: false },
      manual: { count: 0, duration_ms: 0, is_stub: false },
    };

    const seen = new Map<string, KeywordSuggestion>();
    let totalRaw = 0;
    for (let i = 0; i < sources.length; i++) {
      const sourceName = sources[i]!;
      const settled = results[i]!;
      if (settled.status === 'rejected') {
        by_source[sourceName] = {
          count: 0,
          duration_ms: 0,
          is_stub: false,
          error: (settled.reason as Error).message,
        };
        continue;
      }
      const sourceResult: KeywordSourceResult = settled.value;
      by_source[sourceName] = {
        count: 0,
        duration_ms: sourceResult.duration_ms,
        is_stub: sourceResult.is_stub,
        ...(sourceResult.error ? { error: sourceResult.error } : {}),
      };
      for (const s of sourceResult.suggestions) {
        totalRaw++;
        const norm = this.normalize(s.keyword);
        if (!norm) continue;
        if (!seen.has(norm)) {
          seen.set(norm, s);
          by_source[sourceName].count++;
        }
      }
    }

    const keywords = [...seen.values()].slice(0, limit);
    const dedupeRate = totalRaw > 0 ? (totalRaw - keywords.length) / totalRaw : 0;
    const stats: SuggestionStats = {
      total_returned: keywords.length,
      total_raw: totalRaw,
      dedupe_rate: dedupeRate,
      duration_ms: Date.now() - started,
      by_source,
      cached: false,
    };

    const result: SuggestionResult = {
      seed,
      language,
      country,
      sources_used: sources,
      keywords,
      stats,
    };

    // 4) Cache 7 days.
    await this.redis
      .getClient()
      .set(cacheKey, JSON.stringify(result), 'EX', SuggestionService.CACHE_TTL_SECONDS);

    return result;
  }

  private normalize(keyword: string): string {
    return keyword
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/[^\p{L}\p{N} -]/gu, '')
      .trim();
  }

  private cacheKey(opts: {
    seed: string;
    sources: KeywordSourceName[];
    language: string;
    country: string;
    limit: number;
  }): string {
    const raw = `${opts.seed.toLowerCase()}|${[...opts.sources].sort().join(',')}|${opts.language}|${opts.country}|${opts.limit}`;
    return (
      SuggestionService.CACHE_PREFIX + createHash('sha256').update(raw).digest('hex').slice(0, 32)
    );
  }
}
