import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface VolumeBatchRequest {
  keywords: string[];
  language: string;
  country: string;
}

export interface VolumeBatchResultRow {
  keyword: string;
  volume: number | null;
  cpc: number | null;
  competition: 'low' | 'medium' | 'high' | null;
}

export interface VolumeBatchResult {
  rows: VolumeBatchResultRow[];
  is_stub: boolean;
  cost_usd: number;
  duration_ms: number;
  error?: string;
}

/**
 * Section 8 TN2 — Volume + CPC via DataForSEO Google Ads Search Volume API.
 * Real endpoint: POST /v3/keywords_data/google_ads/search_volume/live (Basic
 * Auth). Batches 100 keywords/request. Spec target: <100đ/keyword after cache.
 *
 * Stub mode (no DATAFORSEO_LOGIN/PASSWORD) returns deterministic synthetic
 * data so TN2 + tests work end-to-end. Volume is derived from a stable hash
 * of the keyword to make assertions reproducible.
 */
@Injectable()
export class DataForSeoVolumeProvider {
  private readonly logger = new Logger(DataForSeoVolumeProvider.name);

  private readonly login: string;
  private readonly password: string;

  constructor(cfg: ConfigService) {
    this.login = cfg.get<string>('ai.dataforseoLogin') ?? '';
    this.password = cfg.get<string>('ai.dataforseoPassword') ?? '';
  }

  isAvailable(): boolean {
    return !!this.login && !!this.password;
  }

  async fetchBatch(req: VolumeBatchRequest): Promise<VolumeBatchResult> {
    const started = Date.now();
    if (!this.isAvailable()) {
      return this.stub(req, started);
    }
    try {
      const body = [
        {
          keywords: req.keywords.slice(0, 1000),
          language_code: req.language,
          location_code: this.toLocationCode(req.country),
        },
      ];
      const res = await fetch(
        'https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization:
              'Basic ' + Buffer.from(`${this.login}:${this.password}`).toString('base64'),
          },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return {
          ...this.stub(req, started),
          error: `DataForSEO ${res.status}: ${text.slice(0, 200)}`,
        };
      }
      const parsed = (await res.json()) as DataForSeoResponse;
      const items = parsed.tasks?.[0]?.result ?? [];
      const rows: VolumeBatchResultRow[] = items.map((it) => ({
        keyword: it.keyword,
        volume: it.search_volume ?? null,
        cpc: it.cpc ?? null,
        competition: (it.competition as VolumeBatchResultRow['competition']) ?? null,
      }));
      return {
        rows,
        is_stub: false,
        // DataForSEO bills per row — typical $0.00006 per keyword for live search volume.
        cost_usd: rows.length * 0.00006,
        duration_ms: Date.now() - started,
      };
    } catch (err) {
      this.logger.warn(`DataForSEO live fetch failed: ${(err as Error).message}`);
      return { ...this.stub(req, started), error: (err as Error).message };
    }
  }

  // ----- stub -----

  private stub(req: VolumeBatchRequest, started: number): VolumeBatchResult {
    const rows = req.keywords.map((keyword) => {
      const hash = this.hash(`${keyword}|${req.language}|${req.country}`);
      // Volume: 100 .. 30_000 range, biased toward shorter keywords.
      const lengthFactor = Math.max(0.2, 1 - keyword.length / 100);
      const volume = Math.floor((hash % 30_000) * lengthFactor + 100);
      const cpc = Math.round((hash % 5000) / 100) / 10; // 0.0 .. 5.0
      const compIdx = hash % 3;
      const competition = (['low', 'medium', 'high'] as const)[compIdx]!;
      return { keyword, volume, cpc, competition };
    });
    return {
      rows,
      is_stub: true,
      cost_usd: 0,
      duration_ms: Date.now() - started,
    };
  }

  private hash(input: string): number {
    let h = 0;
    for (let i = 0; i < input.length; i++) {
      h = (h * 31 + input.charCodeAt(i)) >>> 0;
    }
    return h;
  }

  private toLocationCode(country: string): number {
    // DataForSEO location codes — only the most common Vietnam-relevant ones
    // are baked in. The full catalog is fetched via /v3/keywords_data/locations.
    switch (country.toUpperCase()) {
      case 'VN':
        return 2704;
      case 'US':
        return 2840;
      case 'GB':
      case 'UK':
        return 2826;
      default:
        return 2840;
    }
  }
}

interface DataForSeoResponse {
  tasks?: Array<{
    result?: Array<{
      keyword: string;
      search_volume?: number | null;
      cpc?: number | null;
      competition?: string | null;
    }>;
  }>;
}
