import { Injectable } from '@nestjs/common';
import { statusFromScore, type AuditInput, type RuleResult, type ScoringRule } from './base.rule';
import { HtmlContext } from './html-context';

/** Section 8 TN7 rule #12 — ≥5 câu FAQ (weight 8 %). */
@Injectable()
export class FaqSectionRule implements ScoringRule {
  readonly id = 'faq_section';
  readonly name = 'FAQ section (≥5 câu hỏi)';
  readonly weight = 0.08;

  evaluate(input: AuditInput): RuleResult {
    const ctx = new HtmlContext(input);

    // Heuristic 1: explicit FAQ section detected by heading.
    const faqHeadingRegex = /(faq|câu hỏi thường gặp|q&a|q\s*&\s*a)/i;
    let faqSectionH3Count = 0;
    let inFaq = false;
    ctx.$('h2, h3').each((_, el) => {
      const tag = (el as { tagName?: string }).tagName?.toLowerCase();
      const text = ctx.$(el).text();
      if (tag === 'h2') {
        inFaq = faqHeadingRegex.test(text);
      } else if (tag === 'h3' && inFaq) {
        faqSectionH3Count++;
      }
    });

    // Heuristic 2: bare question count in all headings (?) when no FAQ
    // section was tagged.
    const questionHeadings = ctx
      .$('h2, h3')
      .toArray()
      .filter((el) => /\?$/.test(ctx.$(el).text().trim())).length;

    const count = Math.max(faqSectionH3Count, questionHeadings);

    let score: number;
    let message: string;
    const suggestions: RuleResult['suggestions'] = [];
    if (count >= 5) {
      score = 100;
      message = `Detected ${count} câu FAQ — đủ chuẩn.`;
    } else if (count >= 3) {
      score = 70;
      message = `Mới ${count} câu FAQ — cần thêm ${5 - count}.`;
      suggestions.push({
        text: `Bổ sung ${5 - count} câu FAQ vào section "Câu hỏi thường gặp".`,
        action: 'auto-fixable',
      });
    } else {
      score = 25;
      message = `${count} câu FAQ — quá ít hoặc không có section FAQ.`;
      suggestions.push({
        text: 'Thêm section FAQ với ≥5 câu hỏi + trả lời 80-150 từ mỗi câu (rich snippet).',
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
      metrics: { faq_count: count },
    };
  }
}
