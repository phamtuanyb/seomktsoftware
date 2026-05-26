import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { marked } from 'marked';
import { ErrorCode } from '@mkt-seo/shared';
import { PrismaService } from '../../../common/services/prisma.service';
import {
  SCORING_RULES,
  type AuditInput,
  type RuleResult,
  type ScoringRule,
} from '../rules/base.rule';
import type { ScoreContentDto } from '../dto/score.dto';

export interface AuditReport {
  /** Overall weighted score 0-100 (rounded). */
  score: number;
  /** Status derived from `score`. */
  status: 'good' | 'warning' | 'fail';
  /** Per-rule output indexed by rule id. */
  breakdown: Record<string, RuleResult>;
  /** Ordered list (largest weight × deficit first) so the UI can show priorities. */
  prioritized: Array<{ rule_id: string; impact: number }>;
  /** Source — either "article" (loaded by id) or "inline". */
  source: 'article' | 'inline';
  /** When source=article, the persisted article id. */
  article_id?: string;
  duration_ms: number;
}

/**
 * Section 8 TN7 — Content Score orchestrator.
 *
 * Chain of Responsibility: 12 ScoringRule instances are injected via the
 * SCORING_RULES token. The service:
 *   1. Loads the article from DB (when article_id was supplied) or accepts
 *      inline title/content/meta payload.
 *   2. Runs every rule (Promise.all — most are sync but the contract allows
 *      async so future AI-backed rules can hook in).
 *   3. Computes weighted average score and per-rule status.
 *   4. Persists score + breakdown back into the article row when source =
 *      article.
 *
 * Acceptance Section 8 TN7:
 *   - Score 1 bài <5s (sync rules: ~10ms with cheerio cache).
 *   - Gợi ý fix actionable 100 % cho rule <80 — every failing rule's
 *     suggestions[] is populated.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SCORING_RULES) private readonly rules: ScoringRule[],
  ) {
    const weightSum = this.rules.reduce((sum, r) => sum + r.weight, 0);
    if (Math.abs(weightSum - 1) > 0.01) {
      this.logger.warn(`Rule weights sum to ${weightSum.toFixed(3)} (expected 1.0)`);
    }
  }

  async score(dto: ScoreContentDto, userId: string): Promise<AuditReport> {
    const started = Date.now();
    let input: AuditInput;
    let articleId: string | undefined;
    let source: 'article' | 'inline';

    if (dto.article_id) {
      const article = await this.prisma.article.findFirst({
        where: { id: dto.article_id, userId, deletedAt: null },
      });
      if (!article) {
        throw new NotFoundException({
          code: ErrorCode.RESOURCE_NOT_FOUND,
          message: 'Không tìm thấy bài viết để chấm điểm',
        });
      }
      articleId = article.id;
      source = 'article';
      input = {
        title: article.title,
        content: article.content ?? '',
        content_markdown: article.contentMarkdown ?? undefined,
        meta_title: article.metaTitle ?? '',
        meta_description: article.metaDescription ?? '',
        target_keyword: dto.target_keyword || article.targetKeyword || '',
        secondary_keywords: article.secondaryKeywords ?? dto.secondary_keywords ?? [],
        intent: dto.intent,
        base_url: dto.base_url,
      };
    } else {
      // Sprint 6.6 — accept either pre-rendered HTML (content) or raw
      // markdown (content_markdown). Editor live-preview sends markdown
      // because converting on the client would require shipping marked
      // in the bundle.
      const html =
        dto.content ??
        (dto.content_markdown ? await Promise.resolve(marked.parse(dto.content_markdown)) : null);
      if (!dto.title || !html) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Cần cung cấp article_id HOẶC (title + content/content_markdown).',
        });
      }
      source = 'inline';
      input = {
        title: dto.title,
        content: html,
        content_markdown: dto.content_markdown,
        meta_title: dto.meta_title ?? '',
        meta_description: dto.meta_description ?? '',
        target_keyword: dto.target_keyword,
        secondary_keywords: dto.secondary_keywords ?? [],
        intent: dto.intent,
        base_url: dto.base_url,
      };
    }

    const results = await Promise.all(this.rules.map((r) => r.evaluate(input)));
    const breakdown: Record<string, RuleResult> = {};
    let weighted = 0;
    for (const r of results) {
      breakdown[r.rule_id] = r;
      weighted += r.score * r.weight;
    }
    const score = Math.round(weighted);
    const status: AuditReport['status'] = score >= 80 ? 'good' : score >= 50 ? 'warning' : 'fail';

    // Priority list — biggest "impact = weight × (100 - score)" first.
    const prioritized = results
      .map((r) => ({ rule_id: r.rule_id, impact: Math.round(r.weight * (100 - r.score)) }))
      .filter((p) => p.impact > 0)
      .sort((a, b) => b.impact - a.impact);

    // Persist back to article row when applicable.
    if (articleId) {
      await this.prisma.article.update({
        where: { id: articleId },
        data: {
          contentScore: score,
          scoreBreakdownJson: breakdown as unknown as object,
        },
      });
    }

    return {
      score,
      status,
      breakdown,
      prioritized,
      source,
      article_id: articleId,
      duration_ms: Date.now() - started,
    };
  }

  /** Exposed so other modules (TN4 article completion) can score an in-memory article. */
  async scoreInline(input: AuditInput): Promise<AuditReport> {
    const started = Date.now();
    const results = await Promise.all(this.rules.map((r) => r.evaluate(input)));
    const breakdown: Record<string, RuleResult> = {};
    let weighted = 0;
    for (const r of results) {
      breakdown[r.rule_id] = r;
      weighted += r.score * r.weight;
    }
    const score = Math.round(weighted);
    const status: AuditReport['status'] = score >= 80 ? 'good' : score >= 50 ? 'warning' : 'fail';
    const prioritized = results
      .map((r) => ({ rule_id: r.rule_id, impact: Math.round(r.weight * (100 - r.score)) }))
      .filter((p) => p.impact > 0)
      .sort((a, b) => b.impact - a.impact);

    return {
      score,
      status,
      breakdown,
      prioritized,
      source: 'inline',
      duration_ms: Date.now() - started,
    };
  }
}
