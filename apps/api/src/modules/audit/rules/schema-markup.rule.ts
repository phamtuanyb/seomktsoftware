import { Injectable } from '@nestjs/common';
import { statusFromScore, type AuditInput, type RuleResult, type ScoringRule } from './base.rule';
import { HtmlContext } from './html-context';

/** Section 8 TN7 rule #9 — có FAQ/Article schema JSON-LD (weight 7 %). */
@Injectable()
export class SchemaMarkupRule implements ScoringRule {
  readonly id = 'schema_markup';
  readonly name = 'Schema markup (Article + FAQPage JSON-LD)';
  readonly weight = 0.07;

  evaluate(input: AuditInput): RuleResult {
    const ctx = new HtmlContext(input);
    const scripts = ctx.$('script[type="application/ld+json"]');
    let hasArticle = false;
    let hasFaq = false;

    scripts.each((_, el) => {
      const raw = ctx.$(el).text();
      try {
        const parsed = JSON.parse(raw) as { '@type'?: string | string[] };
        const types = Array.isArray(parsed['@type']) ? parsed['@type'] : [parsed['@type'] ?? ''];
        for (const t of types) {
          if (typeof t === 'string') {
            if (/Article|BlogPosting|NewsArticle/i.test(t)) hasArticle = true;
            if (/FAQPage/i.test(t)) hasFaq = true;
          }
        }
      } catch {
        // Skip malformed JSON-LD.
      }
    });

    let score: number;
    let message: string;
    const suggestions: RuleResult['suggestions'] = [];
    if (hasArticle && hasFaq) {
      score = 100;
      message = 'Có cả Article + FAQPage schema.';
    } else if (hasArticle) {
      score = 70;
      message = 'Có Article schema, thiếu FAQPage.';
      suggestions.push({
        text: 'Thêm FAQPage JSON-LD cho section FAQ để hiển thị rich snippet.',
        action: 'auto-fixable',
      });
    } else if (hasFaq) {
      score = 60;
      message = 'Có FAQPage, thiếu Article schema.';
      suggestions.push({
        text: 'Thêm Article schema JSON-LD ở đầu bài.',
        action: 'auto-fixable',
      });
    } else {
      score = 10;
      message = 'Không có schema markup nào.';
      suggestions.push({
        text: 'Inject Article + FAQPage JSON-LD (post-process pipeline trong TN4 hỗ trợ sẵn).',
        action: 'auto-fixable',
      });
    }

    return {
      rule_id: this.id,
      name: this.name,
      weight: this.weight,
      score,
      status: statusFromScore(score),
      message,
      suggestions,
      metrics: { article_schema: hasArticle, faq_schema: hasFaq },
    };
  }
}
