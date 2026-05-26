import { Injectable } from '@nestjs/common';
import { statusFromScore, type AuditInput, type RuleResult, type ScoringRule } from './base.rule';
import { HtmlContext } from './html-context';

/** Section 8 TN7 rule #4 — H1 unique + chứa keyword (weight 8 %). */
@Injectable()
export class H1UniqueRule implements ScoringRule {
  readonly id = 'h1_unique';
  readonly name = 'H1 unique + chứa keyword';
  readonly weight = 0.08;

  evaluate(input: AuditInput): RuleResult {
    const ctx = new HtmlContext(input);
    const h1s = ctx
      .$('h1')
      .toArray()
      .map((el) => ctx.$(el).text().replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const keyword = input.target_keyword.trim().toLowerCase();
    const count = h1s.length;
    const first = h1s[0] ?? '';
    const hasKeyword = first.toLowerCase().includes(keyword);

    let score = 0;
    let message: string;
    const suggestions: RuleResult['suggestions'] = [];

    if (count === 0) {
      score = 10;
      message = 'Bài không có H1.';
      suggestions.push({
        text: `Thêm 1 H1 chứa "${input.target_keyword}" làm tiêu đề chính.`,
        action: 'auto-fixable',
      });
    } else if (count === 1 && hasKeyword) {
      score = 100;
      message = 'H1 duy nhất và chứa keyword.';
    } else if (count === 1 && !hasKeyword) {
      score = 50;
      message = 'H1 duy nhất nhưng KHÔNG chứa keyword.';
      suggestions.push({
        text: `Bổ sung "${input.target_keyword}" vào H1.`,
        action: 'auto-fixable',
      });
    } else {
      // > 1 H1
      score = hasKeyword ? 50 : 20;
      message = `Có ${count} H1 — Google chỉ nên thấy 1 H1.`;
      suggestions.push({
        text: 'Giữ duy nhất 1 H1, chuyển các H1 còn lại xuống H2.',
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
      metrics: { h1_count: count, h1_has_keyword: hasKeyword },
    };
  }
}
