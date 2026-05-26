import { Injectable, Logger } from '@nestjs/common';
import { LlmRegistry } from '../../content/providers/llm-registry.service';

export interface SafetyCheckResult {
  /** false means the prompt is unsafe and should be rejected. */
  safe: boolean;
  /** Cleaned prompt — when safe=true this may have minor edits (PII removed). */
  cleaned_prompt: string;
  reason?: string;
  flags: string[];
  /** "ai" when Claude classified, "rule" when fallback was used. */
  method: 'ai' | 'rule';
}

/**
 * Section 8 TN6 step 1 — safety check (no NSFW, no real person names).
 *
 * Strategy:
 *   1. Cheap regex pass for the obvious-NSFW + violent terms list.
 *   2. When ClaudeProvider is available, ask Claude Haiku for a final
 *      verdict + cleaned-up prompt (e.g. strip celebrity names).
 *   3. Fail-open on Claude errors so a single API hiccup doesn't block
 *      every image gen request — but log loudly so we can investigate.
 */
@Injectable()
export class ImageSafetyService {
  private readonly logger = new Logger(ImageSafetyService.name);

  private static readonly HARD_BLOCK = [
    /\b(nude|naked|porn|porno|sex|nsfw|erotic|fetish|hentai)\b/i,
    /\b(khoả thân|gợi cảm 18\+|tục|đồi trụy)\b/i,
    /\b(gun|firearm|bomb|explosive|terror)\b/i,
    /\b(murder|kill|suicide|self-harm)\b/i,
  ];

  /** Known celebrity / political names that Replicate's TOS forbids. Conservative starter list. */
  private static readonly NAMED_PERSON_PATTERNS = [
    /\b(elon musk|donald trump|joe biden|xi jinping|putin|kim jong[- ]?un)\b/i,
    /\b(taylor swift|beyonce|rihanna|kanye)\b/i,
    /\b(messi|ronaldo|neymar|mbappe)\b/i,
  ];

  constructor(private readonly llm: LlmRegistry) {}

  async check(rawPrompt: string): Promise<SafetyCheckResult> {
    const prompt = rawPrompt.trim();
    const flags: string[] = [];

    // 1) Hard block — bypass AI entirely.
    for (const re of ImageSafetyService.HARD_BLOCK) {
      const m = prompt.match(re);
      if (m) flags.push(`hard:${m[0].toLowerCase()}`);
    }
    if (flags.length > 0) {
      return {
        safe: false,
        cleaned_prompt: prompt,
        reason: 'Prompt chứa từ khoá bị chặn (NSFW/violence).',
        flags,
        method: 'rule',
      };
    }

    // 2) Named persons — strip names if found, don't outright block.
    let cleaned = prompt;
    for (const re of ImageSafetyService.NAMED_PERSON_PATTERNS) {
      if (re.test(cleaned)) {
        flags.push('named-person');
        cleaned = cleaned.replace(re, 'a public figure');
      }
    }

    // 3) AI verdict when available.
    const provider = this.llm.select('claude-haiku');
    if (!provider.available) {
      return { safe: true, cleaned_prompt: cleaned, flags, method: 'rule' };
    }

    try {
      const verdict = await provider.generate({
        system:
          'Bạn là moderator hình ảnh. Trả về JSON thuần (không markdown) dạng {"safe": true|false, "reason": "..."}.',
        prompt: `Đánh giá prompt sinh ảnh sau có an toàn không (no NSFW, no violence, no real-person likeness)?\n\nPrompt: ${cleaned}`,
        maxTokens: 200,
        temperature: 0,
        model: 'claude-haiku',
      });
      const parsed = this.parse(verdict.content);
      if (parsed === null) {
        return { safe: true, cleaned_prompt: cleaned, flags, method: 'ai' };
      }
      return {
        safe: parsed.safe,
        cleaned_prompt: cleaned,
        reason: parsed.reason,
        flags,
        method: 'ai',
      };
    } catch (err) {
      this.logger.warn(`Safety AI check failed (${(err as Error).message}) — failing open`);
      return { safe: true, cleaned_prompt: cleaned, flags, method: 'rule' };
    }
  }

  private parse(raw: string): { safe: boolean; reason?: string } | null {
    const trimmed = raw
      .trim()
      .replace(/^```(?:json)?\s*\n?/, '')
      .replace(/\n?```\s*$/, '');
    try {
      const obj = JSON.parse(trimmed) as { safe?: boolean; reason?: string };
      if (typeof obj.safe !== 'boolean') return null;
      return { safe: obj.safe, reason: obj.reason };
    } catch {
      return null;
    }
  }
}
