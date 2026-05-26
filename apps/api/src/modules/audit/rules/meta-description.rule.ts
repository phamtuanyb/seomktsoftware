import { Injectable } from '@nestjs/common';
import { statusFromScore, type AuditInput, type RuleResult, type ScoringRule } from './base.rule';

/** Section 8 TN7 rule #3 — meta description 140-160 ký tự + chứa keyword (weight 8 %). */
@Injectable()
export class MetaDescriptionRule implements ScoringRule {
  readonly id = 'meta_description';
  readonly name = 'Meta description (140-160 chars + keyword)';
  readonly weight = 0.08;

  evaluate(input: AuditInput): RuleResult {
    const desc = (input.meta_description ?? '').trim();
    const keyword = input.target_keyword.trim().toLowerCase();
    const len = desc.length;
    const hasKeyword = desc.toLowerCase().includes(keyword);

    let score = 0;
    const suggestions: RuleResult['suggestions'] = [];
    let message: string;
    if (len >= 140 && len <= 160 && hasKeyword) {
      score = 100;
      message = `Meta description ${len} ký tự, có keyword — chuẩn.`;
    } else {
      // Partial credit components.
      const lengthScore = len >= 140 && len <= 160 ? 60 : len >= 120 && len < 180 ? 35 : 15;
      const keywordScore = hasKeyword ? 40 : 0;
      score = lengthScore + keywordScore;
      message = `Meta description ${len} ký tự${hasKeyword ? ' (có keyword)' : ' (THIẾU keyword)'}.`;
      if (len < 140) {
        suggestions.push({
          text: `Mở rộng meta description lên 140-160 ký tự (hiện ${len}).`,
          action: 'auto-fixable',
        });
      } else if (len > 160) {
        suggestions.push({
          text: `Rút gọn meta description xuống 140-160 ký tự (hiện ${len}).`,
          action: 'auto-fixable',
        });
      }
      if (!hasKeyword) {
        suggestions.push({
          text: `Bổ sung keyword "${input.target_keyword}" vào meta description.`,
          action: 'auto-fixable',
        });
      }
    }

    return {
      rule_id: this.id,
      name: this.name,
      weight: this.weight,
      score,
      status: statusFromScore(score),
      message,
      suggestions,
      metrics: { length: len, has_keyword: hasKeyword },
    };
  }
}
