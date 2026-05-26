import { Injectable } from '@nestjs/common';
import {
  buildKeywordRegex,
  statusFromScore,
  type AuditInput,
  type RuleResult,
  type ScoringRule,
} from './base.rule';
import { HtmlContext } from './html-context';

/** Section 8 TN7 rule #1 — keyword density 1-2 % (weight 10 %). */
@Injectable()
export class KeywordDensityRule implements ScoringRule {
  readonly id = 'keyword_density';
  readonly name = 'Mật độ keyword (1-2 %)';
  readonly weight = 0.1;

  evaluate(input: AuditInput): RuleResult {
    const ctx = new HtmlContext(input);
    const keyword = input.target_keyword.trim();
    const matches = (ctx.text.match(buildKeywordRegex(keyword)) ?? []).length;
    const density = ctx.wordCount > 0 ? matches / ctx.wordCount : 0;

    let score: number;
    let message: string;
    const suggestions: RuleResult['suggestions'] = [];
    if (density >= 0.01 && density <= 0.02) {
      score = 100;
      message = `Mật độ ${(density * 100).toFixed(2)} % — chuẩn`;
    } else if (density > 0.02 && density <= 0.03) {
      score = 70;
      message = `Mật độ ${(density * 100).toFixed(2)} % — hơi cao, có nguy cơ nhồi keyword`;
      suggestions.push({
        text: 'Giảm số lần xuất hiện keyword chính, thay thế bằng đại từ hoặc LSI.',
        action: 'auto-fixable',
      });
    } else if (density > 0.03) {
      score = 30;
      message = `Mật độ ${(density * 100).toFixed(2)} % — quá cao, Google có thể coi là spam`;
      suggestions.push({
        text: 'Rewrite các đoạn lặp keyword. Mục tiêu 1-2 %.',
        action: 'auto-fixable',
      });
    } else if (density >= 0.005) {
      score = 60;
      message = `Mật độ ${(density * 100).toFixed(2)} % — hơi thấp, có thể mất tín hiệu relevance`;
      suggestions.push({
        text: `Bổ sung thêm ${Math.max(1, Math.ceil(0.01 * ctx.wordCount - matches))} lần xuất hiện keyword "${keyword}".`,
        action: 'auto-fixable',
      });
    } else {
      score = 30;
      message = `Mật độ ${(density * 100).toFixed(2)} % — quá thấp`;
      suggestions.push({
        text: `Bổ sung keyword "${keyword}" tối thiểu ${Math.ceil(0.01 * ctx.wordCount)} lần trong bài.`,
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
        density: Number((density * 100).toFixed(2)),
        occurrences: matches,
        word_count: ctx.wordCount,
      },
    };
  }
}
