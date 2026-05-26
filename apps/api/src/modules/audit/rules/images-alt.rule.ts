import { Injectable } from '@nestjs/common';
import { statusFromScore, type AuditInput, type RuleResult, type ScoringRule } from './base.rule';
import { HtmlContext } from './html-context';

/** Section 8 TN7 rule #8 — ≥3 ảnh, 100 % có alt (weight 8 %). */
@Injectable()
export class ImagesAltRule implements ScoringRule {
  readonly id = 'images_alt';
  readonly name = 'Images (≥3 ảnh, 100 % có alt)';
  readonly weight = 0.08;

  evaluate(input: AuditInput): RuleResult {
    const ctx = new HtmlContext(input);
    const imgs = ctx.$('img');
    const total = imgs.length;
    let missingAlt = 0;
    let keywordAlt = 0;
    const keyword = input.target_keyword.trim().toLowerCase();

    imgs.each((_, el) => {
      const alt = (ctx.$(el).attr('alt') ?? '').trim();
      if (!alt) missingAlt++;
      else if (keyword && alt.toLowerCase().includes(keyword)) keywordAlt++;
    });

    const countOk = total >= 3;
    const altRatio = total > 0 ? 1 - missingAlt / total : 0;
    const countScore = countOk ? 50 : Math.round((total / 3) * 50);
    const altScore = Math.round(altRatio * 50);
    const score = total === 0 ? 10 : countScore + altScore;

    const suggestions: RuleResult['suggestions'] = [];
    if (total === 0) {
      suggestions.push({
        text: 'Bài không có ảnh — thêm tối thiểu 3 ảnh (sử dụng TN6 Image Generation).',
        action: 'auto-fixable',
      });
    } else {
      if (!countOk) {
        suggestions.push({
          text: `Thêm ${3 - total} ảnh nữa.`,
          action: 'auto-fixable',
        });
      }
      if (missingAlt > 0) {
        suggestions.push({
          text: `${missingAlt}/${total} ảnh thiếu alt text — sinh alt tự động qua AI.`,
          action: 'auto-fixable',
        });
      }
      if (keywordAlt === 0 && keyword) {
        suggestions.push({
          text: `Bổ sung keyword "${input.target_keyword}" vào alt của ít nhất 1 ảnh.`,
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
      message: `${total} ảnh, ${missingAlt} thiếu alt, ${keywordAlt} alt chứa keyword.`,
      suggestions,
      metrics: { total, missing_alt: missingAlt, keyword_alt: keywordAlt },
    };
  }
}
