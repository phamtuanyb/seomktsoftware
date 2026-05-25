import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ErrorCode } from '@mkt-seo/shared';
import { RedisService } from '../../../common/services/redis.service';
import { LlmRegistry } from '../providers/llm-registry.service';
import { type LlmModel } from '../providers/llm-provider.interface';
import { SerpService } from './serp.service';
import {
  type GenerateOutlineDto,
  type OutlineFormat,
  type OutlineIntent,
} from '../dto/generate-outline.dto';
import { outlineSchema, type Outline, type OutlineWithMetadata } from '../schemas/outline.schema';
import { buildOutlineSystemPrompt, buildOutlineUserPrompt } from '../prompts/outline.prompt';

/**
 * Section 8 TN3 — AI Outline Generator.
 *
 * Pipeline:
 *   1. SerpService.topResults(keyword) → 5 SERP entries with h1/h2/h3 + word
 *      count (24h cache).
 *   2. Build prompt → ask Claude Sonnet 4 for a JSON outline that improves on
 *      top SERP without copying.
 *   3. Validate with Zod (outlineSchema). On parse/shape failure → retry once
 *      with a "fix the JSON" prompt before failing.
 *   4. Cache the validated outline for 30 days, keyed by
 *      sha256(keyword|intent|format|word_count|lang).
 *
 * Acceptance (Section 8 TN3):
 *   - Outline 8-12 heading <20 s
 *   - 100% H1 contains target keyword
 *   - User accept rate ≥ 80 %  (measured later)
 */
@Injectable()
export class OutlineService {
  private readonly logger = new Logger(OutlineService.name);
  private static readonly CACHE_PREFIX = 'outline:';
  private static readonly CACHE_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days per spec

  constructor(
    private readonly redis: RedisService,
    private readonly serp: SerpService,
    private readonly llm: LlmRegistry,
  ) {}

  async generate(dto: GenerateOutlineDto, model?: LlmModel): Promise<OutlineWithMetadata> {
    const keyword = dto.keyword.trim();
    const intent: OutlineIntent = dto.intent ?? this.inferIntent(keyword);
    const format: OutlineFormat = dto.format ?? 'blog';
    const targetWordCount = dto.target_word_count ?? 2000;
    const language = dto.language ?? 'vi';
    const country = dto.country ?? 'VN';

    // Cache lookup
    const cacheKey = this.cacheKey({ keyword, intent, format, targetWordCount, language });
    const cachedRaw = await this.redis.getClient().get(cacheKey);
    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw) as OutlineWithMetadata;
        return { ...cached, metadata: { ...cached.metadata, cached: true } };
      } catch {
        this.logger.warn(`Corrupt outline cache for ${cacheKey} — regenerating`);
      }
    }

    // 1. Fetch SERP context
    const serpResults = await this.serp.topResults({
      keyword,
      language,
      country,
      limit: 5,
    });

    // 2. Build prompt
    const provider = this.llm.select(model);
    const systemPrompt = buildOutlineSystemPrompt(language);
    const userPrompt = buildOutlineUserPrompt({
      keyword,
      intent,
      format,
      targetWordCount,
      language,
      serpResults,
    });

    // 3. Call LLM
    const llmResult = await provider.generate({
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: 3000,
      temperature: 0.7,
      model,
    });

    // 4. Parse + validate (retry once if JSON broken)
    let outline: Outline;
    try {
      outline = this.parseAndValidate(llmResult.content);
    } catch (firstErr) {
      this.logger.warn(
        `Outline JSON invalid on first try (${(firstErr as Error).message}) — retrying with fix prompt`,
      );
      const repaired = await provider.generate({
        system: systemPrompt,
        prompt: `Lần trước bạn trả về JSON sai schema. Lỗi: ${(firstErr as Error).message}.\n\nResponse cũ của bạn:\n${llmResult.content}\n\nHãy SỬA lại JSON cho đúng schema gốc và CHỈ trả JSON thuần, không markdown.`,
        maxTokens: 3000,
        temperature: 0.3,
        model,
      });
      try {
        outline = this.parseAndValidate(repaired.content);
      } catch (secondErr) {
        throw new BadGatewayException({
          code: ErrorCode.AI_PROVIDER_ERROR,
          message: 'AI không trả về JSON đúng schema sau 2 lần thử',
          details: { reason: (secondErr as Error).message },
        });
      }
    }

    // 5. Verify acceptance: H1 must contain keyword (best-effort soft-fix).
    if (!outline.h1.toLowerCase().includes(keyword.toLowerCase())) {
      this.logger.warn(`H1 missing keyword — patching. h1="${outline.h1}", keyword="${keyword}"`);
      outline.h1 = `${keyword}: ${outline.h1}`;
    }

    const result: OutlineWithMetadata = {
      h1: outline.h1,
      sections: outline.sections,
      metadata: {
        based_on_serps: serpResults.map((r) => r.url),
        ai_model: llmResult.modelUsed,
        tokens_used: llmResult.tokensUsed,
        cost_usd: llmResult.costUsd,
        is_stub: llmResult.isStub,
        target_word_count: targetWordCount,
        intent,
        format,
        language,
        cached: false,
        generated_at: new Date().toISOString(),
      },
    };

    // 6. Cache 30 days.
    await this.redis
      .getClient()
      .set(cacheKey, JSON.stringify(result), 'EX', OutlineService.CACHE_TTL_SECONDS);

    return result;
  }

  /** Heuristic intent detection used when caller does not pass one. */
  private inferIntent(keyword: string): OutlineIntent {
    const lower = keyword.toLowerCase();
    if (/(mua|giá|bán|order|đặt mua|book|đăng ký|signup|sign up)/.test(lower)) {
      return 'transactional';
    }
    if (/(so sánh|review|đánh giá|tốt nhất|best|top|vs|hoặc)/.test(lower)) {
      return 'commercial';
    }
    return 'info';
  }

  private parseAndValidate(raw: string): Outline {
    const cleaned = this.stripCodeFences(raw);
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      throw new Error(`Outline is not valid JSON: ${(err as Error).message}`);
    }
    const validation = outlineSchema.safeParse(parsed);
    if (!validation.success) {
      throw new Error(
        `Outline shape invalid: ${validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
      );
    }
    return validation.data;
  }

  private stripCodeFences(value: string): string {
    let v = value.trim();
    if (v.startsWith('```')) {
      // ```json\n...\n```  or  ```\n...\n```
      v = v.replace(/^```(?:json|JSON)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    return v.trim();
  }

  private cacheKey(opts: {
    keyword: string;
    intent: string;
    format: string;
    targetWordCount: number;
    language: string;
  }): string {
    const raw = `${opts.keyword.toLowerCase()}|${opts.intent}|${opts.format}|${opts.targetWordCount}|${opts.language}`;
    return (
      OutlineService.CACHE_PREFIX + createHash('sha256').update(raw).digest('hex').slice(0, 32)
    );
  }
}
