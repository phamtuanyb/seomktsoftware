import { Injectable } from '@nestjs/common';
import { statusFromScore, type AuditInput, type RuleResult, type ScoringRule } from './base.rule';
import { HtmlContext } from './html-context';

/** Section 8 TN7 rule #5 — ≥3 H2, H3 đúng cấu trúc, không nhảy bậc (weight 8 %). */
@Injectable()
export class HeadingStructureRule implements ScoringRule {
  readonly id = 'heading_structure';
  readonly name = 'Heading structure (≥3 H2, H3 đúng cấu trúc)';
  readonly weight = 0.08;

  evaluate(input: AuditInput): RuleResult {
    const ctx = new HtmlContext(input);
    const h2Count = ctx.$('h2').length;
    const h3Count = ctx.$('h3').length;

    // Detect "orphan" H3 — a H3 that comes before the first H2.
    const headingsInOrder: string[] = [];
    ctx.$('h1, h2, h3, h4').each((_, el) => {
      headingsInOrder.push((el as { tagName?: string }).tagName?.toLowerCase() ?? 'h?');
    });
    const firstH3Idx = headingsInOrder.indexOf('h3');
    const firstH2Idx = headingsInOrder.indexOf('h2');
    const orphanH3 = firstH3Idx >= 0 && (firstH2Idx < 0 || firstH3Idx < firstH2Idx);

    // Detect H3 → H5 jumps (skipping H4).
    let badJumps = 0;
    for (let i = 1; i < headingsInOrder.length; i++) {
      const prev = parseInt(headingsInOrder[i - 1]!.replace('h', ''), 10);
      const cur = parseInt(headingsInOrder[i]!.replace('h', ''), 10);
      if (Number.isFinite(prev) && Number.isFinite(cur) && cur - prev > 1) badJumps++;
    }

    let score = 100;
    const suggestions: RuleResult['suggestions'] = [];
    if (h2Count < 3) {
      score -= 40;
      suggestions.push({
        text: `Bài mới có ${h2Count} H2 — cần tối thiểu 3 H2 để chia mục rõ ràng.`,
        action: 'auto-fixable',
      });
    }
    if (orphanH3) {
      score -= 20;
      suggestions.push({
        text: 'Có H3 đứng trước H2 đầu tiên — chuyển sang H2 hoặc thêm H2 cha.',
        action: 'auto-fixable',
      });
    }
    if (badJumps > 0) {
      score -= 10 * badJumps;
      suggestions.push({
        text: `Phát hiện ${badJumps} bậc heading nhảy cóc (ví dụ H2→H4). Sửa lại tuần tự.`,
        action: 'manual',
      });
    }
    score = Math.max(0, score);

    const message =
      score === 100
        ? `${h2Count} H2 + ${h3Count} H3, cấu trúc OK.`
        : `${h2Count} H2 + ${h3Count} H3 — phát hiện vấn đề cấu trúc.`;

    return {
      rule_id: this.id,
      name: this.name,
      weight: this.weight,
      score,
      status: statusFromScore(score),
      message,
      suggestions,
      metrics: {
        h2_count: h2Count,
        h3_count: h3Count,
        orphan_h3: orphanH3,
        bad_jumps: badJumps,
      },
    };
  }
}
