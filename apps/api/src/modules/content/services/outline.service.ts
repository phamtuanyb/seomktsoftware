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

@Injectable()
export class OutlineService {
  private readonly logger = new Logger(OutlineService.name);
  private static readonly CACHE_PREFIX = 'outline:v3:';
  private static readonly CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;

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

    const cacheKey = this.cacheKey({ keyword, intent, format, targetWordCount, language });
    const cachedRaw = await this.redis.getClient().get(cacheKey);
    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw) as OutlineWithMetadata;
        return { ...cached, metadata: { ...cached.metadata, cached: true } };
      } catch {
        this.logger.warn(`Corrupt outline cache for ${cacheKey}; regenerating`);
      }
    }

    const serpResults = await this.serp.topResults({
      keyword,
      language,
      country,
      limit: 5,
    });

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

    const llmResult = await provider.generate({
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: 3000,
      temperature: 0.7,
      model,
    });

    let outline: Outline;
    try {
      outline = this.parseAndValidate(llmResult.content);
    } catch (firstErr) {
      this.logger.warn(
        `Outline JSON invalid on first try (${(firstErr as Error).message}); retrying with fix prompt`,
      );
      const repaired = await provider.generate({
        system: systemPrompt,
        prompt: `Lan truoc ban tra ve JSON sai schema. Loi: ${(firstErr as Error).message}.\n\nResponse cu cua ban:\n${llmResult.content}\n\nHay sua lai JSON cho dung schema goc va chi tra JSON thuan, khong markdown.`,
        maxTokens: 3000,
        temperature: 0.3,
        model,
      });
      try {
        outline = this.parseAndValidate(repaired.content);
      } catch (secondErr) {
        throw new BadGatewayException({
          code: ErrorCode.AI_PROVIDER_ERROR,
          message: 'AI khong tra ve JSON dung schema sau 2 lan thu',
          details: { reason: (secondErr as Error).message },
        });
      }
    }

    if (!outline.h1.toLowerCase().includes(keyword.toLowerCase())) {
      this.logger.warn(`H1 missing keyword; patching. h1="${outline.h1}", keyword="${keyword}"`);
      outline.h1 = `${keyword}: ${outline.h1}`;
    }
    if (!outline.meta_title.toLowerCase().includes(keyword.toLowerCase())) {
      outline.meta_title = this.fitMetaTitle(keyword, outline.h1);
    }
    if (!outline.meta_description.toLowerCase().includes(keyword.toLowerCase())) {
      outline.meta_description = this.fitMetaDescription(keyword, outline.h1);
    }

    const result: OutlineWithMetadata = {
      meta_title: outline.meta_title,
      meta_description: outline.meta_description,
      h1: outline.h1,
      sections: outline.sections,
      metadata: {
        based_on_serps: serpResults.map((result) => result.url),
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

    await this.redis
      .getClient()
      .set(cacheKey, JSON.stringify(result), 'EX', OutlineService.CACHE_TTL_SECONDS);

    return result;
  }

  private inferIntent(keyword: string): OutlineIntent {
    const lower = keyword.toLowerCase();
    if (/(mua|gia|ban|order|dat mua|book|dang ky|signup|sign up)/.test(lower)) {
      return 'transactional';
    }
    if (/(so sanh|review|danh gia|tot nhat|best|top|vs|hoac)/.test(lower)) {
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
        `Outline shape invalid: ${validation.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
      );
    }
    return validation.data;
  }

  private stripCodeFences(value: string): string {
    let cleaned = value.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json|JSON)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    return cleaned.trim();
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

  private fitMetaTitle(keyword: string, h1: string): string {
    const base = `${keyword} | ${h1}`.replace(/\s+/g, ' ').trim();
    return base.length <= 70 ? base : `${base.slice(0, 67).trimEnd()}...`;
  }

  private fitMetaDescription(keyword: string, h1: string): string {
    const base = `${keyword} - ${h1}. Xem outline gon, dung intent va san sang viet bai chuan SEO.`;
    if (base.length >= 120 && base.length <= 165) return base;
    if (base.length > 165) return `${base.slice(0, 162).trimEnd()}...`;
    return `${base} Co mo bai, than bai, ket bai va CTA ro rang cho nguoi viet trien khai ngay.`;
  }
}
