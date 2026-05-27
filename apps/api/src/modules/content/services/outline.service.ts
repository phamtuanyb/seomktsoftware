import { BadGatewayException, BadRequestException, Injectable, Logger } from '@nestjs/common';
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
import { type ParseManualOutlineDto } from '../dto/parse-manual-outline.dto';
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

  fromManualInput(dto: ParseManualOutlineDto): OutlineWithMetadata {
    const keyword = dto.keyword.trim();
    const format: OutlineFormat = dto.format ?? 'blog';
    const targetWordCount = dto.target_word_count ?? 2000;
    const language = dto.language ?? 'vi';
    const parsed = this.parseManualOutline(dto.raw_outline, keyword);

    if (!parsed.h1.toLowerCase().includes(keyword.toLowerCase())) {
      parsed.h1 = `${keyword}: ${parsed.h1}`;
    }
    if (!parsed.meta_title.toLowerCase().includes(keyword.toLowerCase())) {
      parsed.meta_title = this.fitMetaTitle(keyword, parsed.h1);
    }
    if (!parsed.meta_description.toLowerCase().includes(keyword.toLowerCase())) {
      parsed.meta_description = this.fitMetaDescription(keyword, parsed.h1);
    }

    return {
      meta_title: parsed.meta_title,
      meta_description: parsed.meta_description,
      h1: parsed.h1,
      sections: parsed.sections,
      metadata: {
        based_on_serps: [],
        ai_model: 'manual',
        tokens_used: { input: 0, output: 0 },
        cost_usd: 0,
        is_stub: false,
        target_word_count: targetWordCount,
        intent: 'manual',
        format,
        language,
        cached: false,
        generated_at: new Date().toISOString(),
      },
    };
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

  private parseManualOutline(raw: string, keyword: string): Outline {
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    let metaTitle = '';
    let metaDescription = '';
    let h1 = '';
    const sections: Outline['sections'] = [];
    let currentSection: Outline['sections'][number] | null = null;
    let currentSubsection: Outline['sections'][number]['subsections'][number] | null = null;

    const pushSection = (title: string) => {
      currentSection = { h2: title, subsections: [] };
      sections.push(currentSection);
      currentSubsection = null;
    };

    const pushSubsection = (title: string) => {
      if (!currentSection) pushSection('Noi dung chinh');
      currentSubsection = { h3: title, bullets: [] };
      currentSection!.subsections.push(currentSubsection);
    };

    for (const line of lines) {
      if (/^meta\s*title\s*:/i.test(line)) {
        metaTitle = line.replace(/^meta\s*title\s*:/i, '').trim();
        continue;
      }
      if (/^meta\s*description\s*:/i.test(line)) {
        metaDescription = line.replace(/^meta\s*description\s*:/i, '').trim();
        continue;
      }
      if (/^h1\s*:/i.test(line)) {
        h1 = line.replace(/^h1\s*:/i, '').trim();
        continue;
      }
      if (/^h2\s*:/i.test(line)) {
        pushSection(line.replace(/^h2\s*:/i, '').trim());
        continue;
      }
      if (/^h3\s*:/i.test(line)) {
        pushSubsection(line.replace(/^h3\s*:/i, '').trim());
        continue;
      }
      if (/^###\s+/.test(line)) {
        pushSubsection(line.replace(/^###\s+/, '').trim());
        continue;
      }
      if (/^##\s+/.test(line)) {
        pushSection(line.replace(/^##\s+/, '').trim());
        continue;
      }
      if (/^#\s+/.test(line)) {
        h1 = line.replace(/^#\s+/, '').trim();
        continue;
      }
      if (/^[-*]\s+/.test(line)) {
        if (!currentSubsection) pushSubsection('Y chinh');
        currentSubsection!.bullets.push(line.replace(/^[-*]\s+/, '').trim());
        continue;
      }
    }

    const cleanedSections = sections
      .map((section) => ({
        ...section,
        subsections: section.subsections
          .filter((subsection) => subsection.h3 && subsection.bullets.length > 0)
          .slice(0, 1)
          .map((subsection) => ({
            ...subsection,
            bullets: subsection.bullets.slice(0, 2),
          })),
      }))
      .filter((section) => section.h2)
      .slice(0, 6);

    if (!h1) {
      h1 = cleanedSections[0]?.h2 ? `${keyword}: ${cleanedSections[0].h2}` : keyword;
    }
    if (!metaTitle) metaTitle = this.fitMetaTitle(keyword, h1);
    if (!metaDescription) metaDescription = this.fitMetaDescription(keyword, h1);
    if (cleanedSections.length === 0) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Outline nhap tay khong hop le. Can it nhat 1 H2 hoac 1 dong H2: ...',
      });
    }

    return {
      meta_title: metaTitle,
      meta_description: metaDescription,
      h1,
      sections: cleanedSections,
    };
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
