import { Injectable } from '@nestjs/common';
import { statusFromScore, type AuditInput, type RuleResult, type ScoringRule } from './base.rule';
import { HtmlContext } from './html-context';

/** Section 8 TN7 rule #7 — ≥3 internal + ≥2 external links (weight 8 %). */
@Injectable()
export class LinksRule implements ScoringRule {
  readonly id = 'links';
  readonly name = 'Links (≥3 internal + ≥2 external)';
  readonly weight = 0.08;

  evaluate(input: AuditInput): RuleResult {
    const ctx = new HtmlContext(input);
    let internal = 0;
    let external = 0;
    const baseHost = input.base_url ? safeHostname(input.base_url) : null;

    ctx.$('a[href]').each((_, el) => {
      const href = (ctx.$(el).attr('href') ?? '').trim();
      if (!href || href.startsWith('#') || href.startsWith('mailto:')) return;
      // Relative URLs (no scheme + not protocol-relative) always count as internal.
      const isRelative = !/^(https?:)?\/\//i.test(href);
      if (isRelative) {
        internal++;
        return;
      }
      const host = safeHostname(href);
      if (baseHost && host === baseHost) internal++;
      else external++;
    });

    const internalOk = internal >= 3;
    const externalOk = external >= 2;
    const internalScore = internalOk ? 60 : Math.round((internal / 3) * 60);
    const externalScore = externalOk ? 40 : Math.round((external / 2) * 40);
    const score = Math.min(100, internalScore + externalScore);

    const suggestions: RuleResult['suggestions'] = [];
    if (!internalOk) {
      suggestions.push({
        text: `Thêm ${3 - internal} internal link nữa (link tới bài viết khác trên cùng site).`,
        action: 'manual',
      });
    }
    if (!externalOk) {
      suggestions.push({
        text: `Thêm ${2 - external} external link nữa (link tới nguồn uy tín ngoài site).`,
        action: 'manual',
      });
    }

    return {
      rule_id: this.id,
      name: this.name,
      weight: this.weight,
      score,
      status: statusFromScore(score),
      message: `${internal} internal + ${external} external link.`,
      suggestions,
      metrics: { internal, external },
    };
  }
}

function safeHostname(value: string): string | null {
  try {
    return new URL(value, 'http://placeholder.local').hostname;
  } catch {
    return null;
  }
}
