import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ErrorCode } from '@mkt-seo/shared';
import { PrismaService } from '../../../common/services/prisma.service';
import { RedisService } from '../../../common/services/redis.service';
import { DataForSeoVolumeProvider } from '../providers/volume.provider';
import { KdCalculatorService } from './kd-calculator.service';
import { IntentClassifierService, type Intent } from './intent-classifier.service';
import type { AnalyzeKeywordsDto } from '../dto/analyze.dto';

export interface AnalyzedKeywordRow {
  keyword: string;
  volume: number | null;
  cpc: number | null;
  competition: 'low' | 'medium' | 'high' | null;
  keyword_difficulty: number;
  kd_notes: string[];
  intent: Intent | null;
  intent_confidence: number | null;
  intent_method: 'ai' | 'rule' | null;
  cached: boolean;
}

export interface AnalysisStats {
  total: number;
  cached: number;
  duration_ms: number;
  cost_usd: number;
  volume_provider_stub: boolean;
  intent_provider_stub: boolean;
  intent_analyzed: boolean;
}

export interface AnalysisResult {
  rows: AnalyzedKeywordRow[];
  stats: AnalysisStats;
}

/**
 * Section 8 TN2 — Keyword Analysis. Pipeline:
 *   1. Cache lookup per keyword (Redis, 7-day TTL keyed by sha256(kw|lang|country)).
 *   2. For cache-misses: batch the unanalyzed keywords to DataForSEO for
 *      volume + cpc + competition (or stub).
 *   3. Run KD heuristic per row (uses volume + competition + keyword shape).
 *   4. If analyze_intent: batch through IntentClassifierService (Claude
 *      Haiku 50/batch + rule fallback).
 *   5. Cache each row 7 days.
 *   6. If project_id was supplied, persist the analysis back into the
 *      matching `keywords` rows (volume, KD, cpc, intent, analyzed_at).
 *
 * Acceptance: 500 keyword analyzed <60s, intent accuracy ≥85%, cost
 * <100đ/keyword after cache (Section 8 TN2). Real numbers depend on having
 * live DATAFORSEO + ANTHROPIC keys; stub mode is free.
 */
@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);
  private static readonly CACHE_PREFIX = 'keywords:analyze:';
  private static readonly CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly volumes: DataForSeoVolumeProvider,
    private readonly kd: KdCalculatorService,
    private readonly intents: IntentClassifierService,
  ) {}

  async analyze(dto: AnalyzeKeywordsDto, userId: string): Promise<AnalysisResult> {
    const started = Date.now();
    const language = dto.language ?? 'vi';
    const country = dto.country ?? 'VN';
    const analyzeIntent = dto.analyze_intent !== false;

    // Normalize input — trim + dedupe.
    const keywords = [...new Set(dto.keywords.map((k) => k.trim()).filter((k) => k.length > 0))];

    // 1) Cache lookup per keyword.
    const cached: Record<string, AnalyzedKeywordRow> = {};
    const cacheKeys = keywords.map((k) => this.cacheKey(k, language, country));
    const redisClient = this.redis.getClient();
    const cachedValues = keywords.length > 0 ? await redisClient.mget(...cacheKeys) : [];
    const missing: string[] = [];
    for (let i = 0; i < keywords.length; i++) {
      const raw = cachedValues[i];
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as AnalyzedKeywordRow;
          parsed.cached = true;
          cached[keywords[i]!] = parsed;
          continue;
        } catch {
          // fall through to missing
        }
      }
      missing.push(keywords[i]!);
    }

    // 2) Volume + CPC + competition for missing.
    let volumeStub = true;
    let cost = 0;
    const volumeMap = new Map<
      string,
      { volume: number | null; cpc: number | null; competition: 'low' | 'medium' | 'high' | null }
    >();
    if (missing.length > 0) {
      const volRes = await this.volumes.fetchBatch({ keywords: missing, language, country });
      volumeStub = volRes.is_stub;
      cost += volRes.cost_usd;
      for (const row of volRes.rows) {
        volumeMap.set(row.keyword, {
          volume: row.volume,
          cpc: row.cpc,
          competition: row.competition,
        });
      }
    }

    // 3) Intent batch.
    let intentStub = true;
    const intentMap = new Map<
      string,
      { intent: Intent; confidence: number; method: 'ai' | 'rule' }
    >();
    if (analyzeIntent && missing.length > 0) {
      const intentResults = await this.intents.classifyBatch(missing, language);
      intentStub = intentResults.every((r) => r.method === 'rule');
      for (const r of intentResults) {
        intentMap.set(r.keyword, {
          intent: r.intent,
          confidence: r.confidence,
          method: r.method,
        });
      }
    }

    // 4) Compose + cache.
    const rows: AnalyzedKeywordRow[] = [];
    for (const keyword of keywords) {
      const cachedRow = cached[keyword];
      if (cachedRow) {
        rows.push(cachedRow);
        continue;
      }
      const vol = volumeMap.get(keyword) ?? { volume: null, cpc: null, competition: null };
      const kdRes = this.kd.compute({ keyword, volume: vol.volume, competition: vol.competition });
      const intent = analyzeIntent ? (intentMap.get(keyword) ?? null) : null;

      const row: AnalyzedKeywordRow = {
        keyword,
        volume: vol.volume,
        cpc: vol.cpc,
        competition: vol.competition,
        keyword_difficulty: kdRes.kd,
        kd_notes: kdRes.notes,
        intent: intent ? intent.intent : null,
        intent_confidence: intent ? intent.confidence : null,
        intent_method: intent ? intent.method : null,
        cached: false,
      };
      rows.push(row);
      await redisClient.set(
        this.cacheKey(keyword, language, country),
        JSON.stringify({ ...row, cached: false }),
        'EX',
        AnalysisService.CACHE_TTL_SECONDS,
      );
    }

    // 5) Optional persist to project keyword rows.
    if (dto.project_id) {
      await this.persistToProject(userId, dto.project_id, rows);
    }

    const cachedCount = Object.keys(cached).length;
    return {
      rows,
      stats: {
        total: rows.length,
        cached: cachedCount,
        duration_ms: Date.now() - started,
        cost_usd: cost,
        volume_provider_stub: volumeStub,
        intent_provider_stub: intentStub,
        intent_analyzed: analyzeIntent,
      },
    };
  }

  private async persistToProject(
    userId: string,
    projectId: string,
    rows: AnalyzedKeywordRow[],
  ): Promise<void> {
    const project = await this.prisma.keywordProject.findFirst({
      where: { id: projectId, userId, deletedAt: null },
    });
    if (!project) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Project không tồn tại để persist kết quả analyze',
      });
    }
    const now = new Date();
    for (const row of rows) {
      try {
        await this.prisma.keyword.updateMany({
          where: {
            userId,
            projectId,
            keyword: row.keyword,
          },
          data: {
            volume: row.volume ?? undefined,
            cpc: row.cpc ?? undefined,
            keywordDifficulty: row.keyword_difficulty,
            intent: row.intent ?? undefined,
            intentConfidence: row.intent_confidence ?? undefined,
            analyzedAt: now,
            metadataJson: {
              competition: row.competition,
              kd_notes: row.kd_notes,
              intent_method: row.intent_method,
            },
          },
        });
      } catch (err) {
        this.logger.warn(`Persist analysis row "${row.keyword}" failed: ${(err as Error).message}`);
      }
    }
  }

  private cacheKey(keyword: string, language: string, country: string): string {
    const raw = `${keyword.toLowerCase()}|${language}|${country}`;
    return (
      AnalysisService.CACHE_PREFIX + createHash('sha256').update(raw).digest('hex').slice(0, 32)
    );
  }
}
