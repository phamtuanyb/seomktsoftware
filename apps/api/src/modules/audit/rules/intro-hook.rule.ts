import { Injectable } from '@nestjs/common';
import {
  buildKeywordRegex,
  statusFromScore,
  type AuditInput,
  type RuleResult,
  type ScoringRule,
} from './base.rule';
import { HtmlContext } from './html-context';

/** Section 8 TN7 rule #11 — intro 150 từ đầu chứa keyword (weight 7 %). */
@Injectable()
export class IntroHookRule implements ScoringRule {
  readonly id = 'intro_hook';
  readonly name = 'Intro hook (150 từ đầu chứa keyword)';
  readonly weight = 0.07;

  evaluate(input: AuditInput): RuleResult {
    const ctx = new HtmlContext(input);
    const intro = ctx.firstNWords(150);
    const keyword = input.target_keyword.trim();
    const keywordRegex = buildKeywordRegex(keyword);
    const hasKeyword = keywordRegex.test(intro);

    // First 50 words = hook proper. Question / number signal stronger hook.
    const hook = ctx.firstNWords(50);
    const hasQuestion = /[?]|làm sao|tại sao|liệu|bao nhiêu|how |why |what /i.test(hook);
    const hasNumber = /\d+/.test(hook);

    let score = 0;
    let message: string;
    const suggestions: RuleResult['suggestions'] = [];

    if (hasKeyword) {
      score = 70;
      if (hasQuestion || hasNumber) score += 30;
      if (score === 100) message = 'Intro mạnh: chứa keyword + có hook (số liệu hoặc câu hỏi).';
      else {
        message = 'Intro có keyword nhưng thiếu hook hấp dẫn (số liệu / câu hỏi).';
        suggestions.push({
          text: 'Mở bài bằng 1 số liệu cụ thể hoặc 1 câu hỏi gợi tò mò.',
          action: 'auto-fixable',
        });
      }
    } else {
      score = 30;
      message = 'Intro KHÔNG chứa keyword trong 150 từ đầu.';
      suggestions.push({
        text: `Bổ sung "${keyword}" trong đoạn mở (50 từ đầu càng tốt).`,
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
        has_keyword_in_intro: hasKeyword,
        hook_has_question: hasQuestion,
        hook_has_number: hasNumber,
      },
    };
  }
}
