import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ErrorCode } from '@mkt-seo/shared';
import { uuidv7 } from 'uuidv7';
import { PrismaService } from '../../../common/services/prisma.service';
import { EventBusService } from '../../../common/services/event-bus.service';
import { LlmRegistry } from '../providers/llm-registry.service';
import { type LlmModel, type LlmStreamEvent } from '../providers/llm-provider.interface';
import {
  buildArticleSystemPrompt,
  buildArticleUserPrompt,
  type BrandVoiceProfileLite,
  type ReferenceArticleLite,
} from '../prompts/article.prompt';
import { ArticlePostProcessService, type PostProcessOutput } from './article-post-process.service';
import { type GenerateArticleDto } from '../dto/generate-article.dto';

export type ArticleStreamEvent =
  | { type: 'token'; content: string }
  | { type: 'section_complete'; section_id: string; section_title: string }
  | {
      type: 'complete';
      article_id: string;
      content_score: number;
      content_score_breakdown: PostProcessOutput['content_score_breakdown'];
      word_count: number;
      meta_title: string;
      meta_description: string;
      ai_model: string;
      cost_usd: number;
      is_stub: boolean;
    }
  | { type: 'error'; code: string; message: string };

export interface ArticleResult {
  id: string;
  title: string;
  slug: string;
  content_markdown: string;
  content_html: string;
  meta_title: string;
  meta_description: string;
  target_keyword: string;
  word_count: number;
  content_score: number;
  content_score_breakdown: PostProcessOutput['content_score_breakdown'];
  ai_model: string;
  ai_cost_usd: number;
  is_stub: boolean;
  brand_voice_id?: string | null;
}

/**
 * Section 8 TN4 — AI Full Article Writer (FLAGSHIP).
 *
 * Two entry points:
 *   1. `generate()` — one-shot, returns ArticleResult once Claude finishes.
 *   2. `generateStream()` — async iterable of ArticleStreamEvent so the
 *      controller can pipe to an SSE response. Buffers all token deltas to
 *      assemble the final markdown, then runs the post-process pipeline +
 *      persists the article + emits article.completed before yielding `complete`.
 *
 * Brand voice is loaded inline (no service yet — Sprint 5.6 wraps it). If
 * `brand_voice_id` belongs to a different user we treat it as not-found to
 * avoid leaking ownership (Section 2 principle 5 — multi-tenant).
 */
@Injectable()
export class ArticleService {
  private readonly logger = new Logger(ArticleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmRegistry,
    private readonly postProcess: ArticlePostProcessService,
    private readonly eventBus: EventBusService,
  ) {}

  /** Non-streaming variant — caller awaits the full ArticleResult. */
  async generate(dto: GenerateArticleDto, userId: string): Promise<ArticleResult> {
    let final: Extract<ArticleStreamEvent, { type: 'complete' }> | undefined;
    let articleId: string | undefined;

    for await (const event of this.generateStream(dto, userId)) {
      if (event.type === 'complete') {
        final = event;
        articleId = event.article_id;
      }
      if (event.type === 'error') {
        throw new BadRequestException({
          code: event.code,
          message: event.message,
        });
      }
    }

    if (!final || !articleId) {
      throw new Error('Article stream finished without a complete event');
    }

    const article = await this.prisma.article.findUnique({ where: { id: articleId } });
    if (!article) {
      throw new Error(`Article ${articleId} disappeared after creation`);
    }
    return this.toResult(article, final.is_stub);
  }

  /**
   * Async iterable over Claude's streaming output. Emits one `token` per LLM
   * chunk, a `section_complete` whenever a new ## heading lands, and a final
   * `complete` with the article id once the row is persisted.
   */
  async *generateStream(
    dto: GenerateArticleDto,
    userId: string,
  ): AsyncIterable<ArticleStreamEvent> {
    const keyword = dto.keyword.trim();
    const targetWordCount = dto.target_word_count ?? 2000;
    const language = dto.language ?? 'vi';
    const format = dto.format ?? 'blog';
    const enableSchemaMarkup = dto.enable_schema_markup ?? true;

    // Brand voice context (inline lookup for now — Sprint 5.6 wraps in service).
    const brandVoice = await this.loadBrandVoiceContext(dto.brand_voice_id, userId);

    const systemPrompt = buildArticleSystemPrompt({
      keyword,
      outline: dto.outline,
      tone: dto.tone,
      format,
      targetWordCount,
      language,
      brandVoice,
    });
    const userPrompt = buildArticleUserPrompt({
      keyword,
      outline: dto.outline,
      tone: dto.tone,
      format,
      targetWordCount,
      language,
      brandVoice,
    });

    const provider = this.llm.select(dto.model as LlmModel | undefined);
    const stream = provider.generateStream({
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: 8192,
      temperature: 0.8,
      model: dto.model as LlmModel | undefined,
    });

    // Buffer tokens to assemble the full markdown + detect section boundaries.
    let buffer = '';
    let lastSectionStart = 0;
    let sectionCount = 0;
    let finishMeta: Extract<LlmStreamEvent, { type: 'finish' }> | undefined;

    try {
      for await (const ev of stream) {
        if (ev.type === 'token') {
          buffer += ev.content;
          yield { type: 'token', content: ev.content };
          // Detect a new ## heading on a fresh line.
          const sectionMatch = /\n##\s+([^\n]+)/g;
          sectionMatch.lastIndex = lastSectionStart;
          let m: RegExpExecArray | null;
          while ((m = sectionMatch.exec(buffer)) !== null) {
            sectionCount++;
            yield {
              type: 'section_complete',
              section_id: `s${sectionCount}`,
              section_title: (m[1] ?? '').trim(),
            };
            lastSectionStart = m.index + m[0].length;
          }
        } else if (ev.type === 'finish') {
          finishMeta = ev;
        }
      }
    } catch (err) {
      this.logger.error(`Streaming failed: ${(err as Error).message}`);
      yield {
        type: 'error',
        code: ErrorCode.AI_PROVIDER_ERROR,
        message: 'AI streaming bị lỗi giữa chừng. Vui lòng thử lại.',
      };
      return;
    }

    if (!finishMeta) {
      yield {
        type: 'error',
        code: ErrorCode.AI_PROVIDER_ERROR,
        message: 'AI không gửi tín hiệu kết thúc',
      };
      return;
    }

    // Run the deterministic post-process pipeline.
    const processed = this.postProcess.process({
      markdown: buffer,
      keyword,
      enableSchemaMarkup,
    });

    // Persist.
    const articleId = uuidv7();
    const slug = this.toSlug(dto.outline.h1);
    await this.prisma.article.create({
      data: {
        id: articleId,
        userId,
        title: dto.outline.h1,
        slug,
        content: processed.html,
        contentMarkdown: processed.markdownProcessed,
        metaTitle: processed.meta_title,
        metaDescription: processed.meta_description,
        targetKeyword: keyword,
        outlineJson: dto.outline as unknown as object,
        format,
        wordCount: processed.word_count,
        contentScore: processed.content_score,
        scoreBreakdownJson: processed.content_score_breakdown as unknown as object,
        status: 'draft',
        brandVoiceId: brandVoice ? dto.brand_voice_id : null,
        aiModelUsed: provider.name + ':' + (dto.model ?? 'default'),
        aiCostUsd: finishMeta.costUsd,
        metadataJson: {
          tokens_used: finishMeta.tokensUsed,
          lsi_keywords: processed.lsi_keywords,
          keyword_count: processed.keyword_count,
          keyword_density: processed.keyword_density,
          enable_schema_markup: enableSchemaMarkup,
          is_stub: !provider.available,
        },
      },
    });

    await this.eventBus.emit('article.completed', {
      article_id: articleId,
      user_id: userId,
      keyword,
      content_score: processed.content_score,
      word_count: processed.word_count,
    });

    yield {
      type: 'complete',
      article_id: articleId,
      content_score: processed.content_score,
      content_score_breakdown: processed.content_score_breakdown,
      word_count: processed.word_count,
      meta_title: processed.meta_title,
      meta_description: processed.meta_description,
      ai_model: provider.name,
      cost_usd: finishMeta.costUsd,
      is_stub: !provider.available,
    };
  }

  // ----- Brand voice loading (inline) -----

  private async loadBrandVoiceContext(
    brandVoiceId: string | undefined,
    userId: string,
  ): Promise<{ profile: BrandVoiceProfileLite; referenceArticles: ReferenceArticleLite[] } | null> {
    if (!brandVoiceId) return null;
    const row = await this.prisma.brandVoice.findFirst({
      where: { id: brandVoiceId, userId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Không tìm thấy brand voice với id đã cho',
      });
    }
    return {
      profile: row.profileJson as unknown as BrandVoiceProfileLite,
      referenceArticles: Array.isArray(row.referenceArticles)
        ? (row.referenceArticles as unknown as ReferenceArticleLite[])
        : [],
    };
  }

  // ----- Helpers -----

  private toResult(
    row: {
      id: string;
      title: string;
      slug: string | null;
      content: string | null;
      contentMarkdown: string | null;
      metaTitle: string | null;
      metaDescription: string | null;
      targetKeyword: string | null;
      wordCount: number | null;
      contentScore: number | null;
      scoreBreakdownJson: unknown;
      aiModelUsed: string | null;
      aiCostUsd: { toNumber(): number } | number | null;
      brandVoiceId: string | null;
    },
    isStub: boolean,
  ): ArticleResult {
    return {
      id: row.id,
      title: row.title,
      slug: row.slug ?? '',
      content_markdown: row.contentMarkdown ?? '',
      content_html: row.content ?? '',
      meta_title: row.metaTitle ?? '',
      meta_description: row.metaDescription ?? '',
      target_keyword: row.targetKeyword ?? '',
      word_count: row.wordCount ?? 0,
      content_score: row.contentScore ?? 0,
      content_score_breakdown:
        (row.scoreBreakdownJson as PostProcessOutput['content_score_breakdown']) ?? {},
      ai_model: row.aiModelUsed ?? 'unknown',
      ai_cost_usd:
        typeof row.aiCostUsd === 'number' ? row.aiCostUsd : (row.aiCostUsd?.toNumber?.() ?? 0),
      is_stub: isStub,
      brand_voice_id: row.brandVoiceId,
    };
  }

  private toSlug(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }
}
