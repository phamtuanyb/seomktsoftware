import { Injectable } from '@nestjs/common';
import { statusFromScore, type AuditInput, type RuleResult, type ScoringRule } from './base.rule';

/** Section 8 TN7 rule #2 — title chứa keyword trong 50 ký tự đầu (weight 10 %). */
@Injectable()
export class TitleKeywordRule implements ScoringRule {
  readonly id = 'title_keyword';
  readonly name = 'Title chứa keyword (50 ký tự đầu)';
  readonly weight = 0.1;

  evaluate(input: AuditInput): RuleResult {
    const title = (input.title ?? '').trim();
    const keyword = input.target_keyword.trim().toLowerCase();
    const head = title.slice(0, 50).toLowerCase();
    const present = head.includes(keyword);
    const presentAnywhere = title.toLowerCase().includes(keyword);

    let score: number;
    let message: string;
    const suggestions: RuleResult['suggestions'] = [];
    if (present) {
      score = 100;
      message = 'Title bắt đầu bằng keyword chính, click-through tốt.';
    } else if (presentAnywhere) {
      score = 60;
      message = 'Title có keyword nhưng nằm sau ký tự 50 — sẽ bị cắt trên SERP.';
      suggestions.push({
        text: `Di chuyển "${input.target_keyword}" vào 50 ký tự đầu của title.`,
        action: 'auto-fixable',
      });
    } else {
      score = 30;
      message = 'Title không chứa keyword chính.';
      suggestions.push({
        text: `Viết lại title để chứa keyword "${input.target_keyword}" trong 50 ký tự đầu.`,
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
      metrics: {
        title_length: title.length,
        keyword_in_first_50: present,
      },
    };
  }
}
