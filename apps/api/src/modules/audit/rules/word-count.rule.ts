import { Injectable } from '@nestjs/common';
import { statusFromScore, type AuditInput, type RuleResult, type ScoringRule } from './base.rule';
import { HtmlContext } from './html-context';

/**
 * Section 8 TN7 rule #6 — word count theo intent (weight 10 %).
 *   info        → ≥1500
 *   commercial  → ≥2000
 *   transactional → ≥1000 (sales page có thể ngắn hơn)
 *   navigational  → ≥500
 */
@Injectable()
export class WordCountRule implements ScoringRule {
  readonly id = 'word_count';
  readonly name = 'Word count theo intent';
  readonly weight = 0.1;

  private static readonly TARGETS: Record<string, number> = {
    info: 1500,
    commercial: 2000,
    transactional: 1000,
    navigational: 500,
  };

  evaluate(input: AuditInput): RuleResult {
    const ctx = new HtmlContext(input);
    const intent = input.intent ?? 'info';
    const target = WordCountRule.TARGETS[intent] ?? 1500;
    const wc = ctx.wordCount;
    const ratio = target > 0 ? wc / target : 0;

    let score: number;
    let message: string;
    const suggestions: RuleResult['suggestions'] = [];
    if (ratio >= 1) {
      score = 100;
      message = `${wc} từ — vượt mục tiêu ${target} (intent=${intent}).`;
    } else if (ratio >= 0.75) {
      score = 70;
      message = `${wc} từ — gần đủ ${target}, cần thêm ~${target - wc} từ.`;
      suggestions.push({
        text: `Mở rộng thêm ${target - wc} từ cho intent "${intent}" (ưu tiên thêm ví dụ, case study).`,
        action: 'auto-fixable',
      });
    } else if (ratio >= 0.5) {
      score = 45;
      message = `${wc} từ — thiếu ${target - wc} từ so với mục tiêu ${target}.`;
      suggestions.push({
        text: `Bài quá ngắn cho intent "${intent}". Bổ sung ${target - wc} từ.`,
        action: 'auto-fixable',
      });
    } else {
      score = 15;
      message = `${wc} từ — quá ngắn cho intent "${intent}" (mục tiêu ${target}).`;
      suggestions.push({
        text: `Viết lại bài với độ sâu hơn — mục tiêu ${target} từ.`,
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
      metrics: { word_count: wc, target, intent },
    };
  }
}
