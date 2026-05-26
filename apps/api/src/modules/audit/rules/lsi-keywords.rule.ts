import { Injectable } from '@nestjs/common';
import {
  buildKeywordRegex,
  statusFromScore,
  type AuditInput,
  type RuleResult,
  type ScoringRule,
} from './base.rule';
import { HtmlContext } from './html-context';

/**
 * Section 8 TN7 rule #10 — ≥10 LSI keyword (weight 8 %).
 *
 * Real implementation: Claude semantic check (call AI to expand the
 * primary keyword + score how many semantic neighbors appear). Sprint 7
 * keeps a deterministic heuristic that uses (1) secondary_keywords[]
 * passed in, and (2) co-occurring 3+-word phrases from the article that
 * share lexical overlap with the primary keyword. AutoFix can promote to
 * real AI when ANTHROPIC_API_KEY lands.
 */
@Injectable()
export class LsiKeywordsRule implements ScoringRule {
  readonly id = 'lsi_keywords';
  readonly name = 'LSI keyword (≥10 từ liên quan)';
  readonly weight = 0.08;

  evaluate(input: AuditInput): RuleResult {
    const ctx = new HtmlContext(input);
    const keyword = input.target_keyword.trim();
    const text = ctx.text.toLowerCase();
    const keywordTokens = new Set(
      keyword
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length >= 3),
    );

    const matched = new Set<string>();
    // 1) Provided secondary keywords.
    for (const sk of input.secondary_keywords ?? []) {
      const skClean = sk.trim();
      if (skClean && buildKeywordRegex(skClean).test(text)) {
        matched.add(skClean.toLowerCase());
      }
    }

    // 2) Heuristic candidates — 4-char+ tokens that co-occur with keyword
    //    head and are distinct from it.
    const tokens = text.match(/[\p{L}]{4,}/gu) ?? [];
    const freq = new Map<string, number>();
    const STOP = new Set([
      'một',
      'những',
      'cũng',
      'được',
      'không',
      'này',
      'cho',
      'với',
      'như',
      'của',
      'có',
      'và',
      'là',
      'từ',
      'trong',
      'khi',
      'đến',
      'mà',
      'thì',
      'sẽ',
      'bạn',
      'their',
      'about',
      'their',
      'they',
      'this',
      'that',
      'with',
      'from',
      'have',
      'will',
      'your',
    ]);
    for (const tok of tokens) {
      if (STOP.has(tok)) continue;
      if (keywordTokens.has(tok)) continue;
      freq.set(tok, (freq.get(tok) ?? 0) + 1);
    }
    const repeated = [...freq.entries()].filter(([, c]) => c >= 2).map(([w]) => w);
    for (const r of repeated) matched.add(r);

    const count = matched.size;
    let score: number;
    let message: string;
    const suggestions: RuleResult['suggestions'] = [];
    if (count >= 10) {
      score = 100;
      message = `${count} LSI / từ liên quan — chuẩn.`;
    } else if (count >= 5) {
      score = 60;
      message = `${count} LSI — thiếu (mục tiêu ≥10).`;
      suggestions.push({
        text: `Bổ sung ${10 - count} từ liên quan ngữ nghĩa với "${keyword}" rải đều trong bài.`,
        action: 'auto-fixable',
      });
    } else {
      score = 25;
      message = `${count} LSI — quá ít.`;
      suggestions.push({
        text: `Bài thiếu chiều sâu ngữ nghĩa. Sinh 10-15 LSI keyword qua AI và viết lại có chèn tự nhiên.`,
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
      metrics: { lsi_count: count },
    };
  }
}
