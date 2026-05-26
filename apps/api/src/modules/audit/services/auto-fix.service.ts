import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { marked } from 'marked';
import { ErrorCode } from '@mkt-seo/shared';
import { PrismaService } from '../../../common/services/prisma.service';
import { LlmRegistry } from '../../content/providers/llm-registry.service';
import { AuditService, type AuditReport } from './audit.service';
import type { AutoFixDto } from '../dto/score.dto';
import type { AuditInput, RuleResult } from '../rules/base.rule';

export interface AutoFixReport {
  article_id: string;
  before: { score: number; failing_rules: string[] };
  after: { score: number; failing_rules: string[] };
  improved: boolean;
  rules_targeted: string[];
  ai_model: string;
  cost_usd: number;
  is_stub: boolean;
  duration_ms: number;
}

/**
 * Section 8 TN7 — Auto-fix. Loads the article, runs the audit, builds a
 * targeted rewrite prompt for Claude listing every failing rule + its
 * suggestion text, asks for a revised markdown body, post-processes to
 * HTML, re-audits to verify improvement.
 *
 * Only persists when the new score >= old score so a bad rewrite never
 * makes the article worse. Stub mode (no real Claude key) is a no-op
 * marker so the UI can still complete the round trip.
 */
@Injectable()
export class AutoFixService {
  private readonly logger = new Logger(AutoFixService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audits: AuditService,
    private readonly llm: LlmRegistry,
  ) {}

  async fix(dto: AutoFixDto, userId: string): Promise<AutoFixReport> {
    const started = Date.now();

    const article = await this.prisma.article.findFirst({
      where: { id: dto.article_id, userId, deletedAt: null },
    });
    if (!article) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Không tìm thấy bài viết',
      });
    }
    if (!article.contentMarkdown || !article.targetKeyword) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Bài viết thiếu content_markdown hoặc target_keyword để auto-fix.',
      });
    }

    // 1) Pre-audit so we know what to fix.
    const before = await this.audits.score(
      {
        article_id: article.id,
        target_keyword: article.targetKeyword,
        secondary_keywords: article.secondaryKeywords ?? [],
      },
      userId,
    );

    const targetedIds = this.selectTargets(before, dto.rule_ids);
    if (targetedIds.length === 0) {
      return this.unchangedReport(article.id, before, started, dto.rule_ids ?? [], true);
    }

    // 2) Build the rewrite prompt around the rule suggestions.
    const provider = this.llm.select('claude-sonnet-4');
    const failingRules = targetedIds
      .map((id) => before.breakdown[id])
      .filter(Boolean) as RuleResult[];
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(
      article.contentMarkdown,
      article.targetKeyword,
      failingRules,
    );

    let newMarkdown: string;
    let costUsd = 0;
    let modelUsed = provider.name;
    let isStub = !provider.available;

    try {
      const result = await provider.generate({
        system: systemPrompt,
        prompt: userPrompt,
        maxTokens: 8192,
        temperature: 0.4,
        model: 'claude-sonnet-4',
      });
      newMarkdown = result.content;
      costUsd = result.costUsd;
      modelUsed = result.modelUsed;
      isStub = result.isStub;
    } catch (err) {
      this.logger.warn(`Auto-fix LLM call failed: ${(err as Error).message}`);
      return this.unchangedReport(article.id, before, started, targetedIds, false);
    }

    // Stub mode just returns the canned article — skip persistence so we
    // don't overwrite a real article with placeholder text.
    if (isStub) {
      return this.unchangedReport(article.id, before, started, targetedIds, true);
    }

    const newHtml = marked.parse(newMarkdown, { async: false, gfm: true }) as string;

    // 3) Re-audit the new HTML inline (no DB write yet).
    const after = await this.audits.scoreInline({
      title: article.title,
      content: newHtml,
      content_markdown: newMarkdown,
      meta_title: article.metaTitle ?? '',
      meta_description: article.metaDescription ?? '',
      target_keyword: article.targetKeyword,
      secondary_keywords: article.secondaryKeywords ?? [],
    } satisfies AuditInput);

    const improved = after.score > before.score;
    if (improved) {
      await this.prisma.article.update({
        where: { id: article.id },
        data: {
          content: newHtml,
          contentMarkdown: newMarkdown,
          contentScore: after.score,
          scoreBreakdownJson: after.breakdown as unknown as object,
          // Bump aiCostUsd by the rewrite cost (Decimal field — Prisma accepts string).
          aiCostUsd: { increment: costUsd } as unknown as number,
        },
      });
    } else {
      this.logger.warn(
        `Auto-fix did not improve score (${before.score} → ${after.score}) — discarding rewrite`,
      );
    }

    return {
      article_id: article.id,
      before: {
        score: before.score,
        failing_rules: this.listFailing(before),
      },
      after: {
        score: improved ? after.score : before.score,
        failing_rules: improved ? this.listFailing(after) : this.listFailing(before),
      },
      improved,
      rules_targeted: targetedIds,
      ai_model: modelUsed,
      cost_usd: costUsd,
      is_stub: isStub,
      duration_ms: Date.now() - started,
    };
  }

  private selectTargets(report: AuditReport, restrict?: string[]): string[] {
    const failing = Object.values(report.breakdown)
      .filter((r) => r.score < 80 && r.suggestions.some((s) => s.action === 'auto-fixable'))
      .sort((a, b) => b.weight * (100 - b.score) - a.weight * (100 - a.score));
    if (restrict && restrict.length > 0) {
      return failing.filter((r) => restrict.includes(r.rule_id)).map((r) => r.rule_id);
    }
    return failing.map((r) => r.rule_id);
  }

  private listFailing(report: AuditReport): string[] {
    return Object.values(report.breakdown)
      .filter((r) => r.score < 80)
      .map((r) => r.rule_id);
  }

  private unchangedReport(
    articleId: string,
    before: AuditReport,
    started: number,
    targetedIds: string[],
    isStub: boolean,
  ): AutoFixReport {
    return {
      article_id: articleId,
      before: { score: before.score, failing_rules: this.listFailing(before) },
      after: { score: before.score, failing_rules: this.listFailing(before) },
      improved: false,
      rules_targeted: targetedIds,
      ai_model: 'auto-fix-noop',
      cost_usd: 0,
      is_stub: isStub,
      duration_ms: Date.now() - started,
    };
  }

  private buildSystemPrompt(): string {
    return `Bạn là editor SEO chuyên sửa bài viết theo audit report. Bạn LUÔN giữ ý tưởng + chiều dài bài gốc, chỉ rewrite những đoạn cần fix. Output là MARKDOWN thuần (không JSON wrapper, không lời dẫn).`;
  }

  private buildUserPrompt(markdown: string, keyword: string, failing: RuleResult[]): string {
    const suggestions = failing
      .map((r, i) => {
        const lines = r.suggestions
          .filter((s) => s.action === 'auto-fixable')
          .map((s) => `   - ${s.text}`)
          .join('\n');
        return `${i + 1}. [${r.rule_id}] ${r.name} — score ${r.score}/100\n${lines}`;
      })
      .join('\n\n');

    return `Bài viết gốc cần sửa (target keyword: "${keyword}"):

===== BÀI GỐC (MARKDOWN) =====
${markdown}

===== CÁC ĐIỂM CẦN SỬA =====
${suggestions}

===== YÊU CẦU =====
- Sửa ĐÚNG các điểm trên, KHÔNG thay đổi ý tưởng tổng thể.
- Giữ nguyên các phần đã tốt.
- Output: markdown thuần, bắt đầu trực tiếp bằng # H1.

Bắt đầu viết lại:`;
  }
}
