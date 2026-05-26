import { Injectable, Logger } from '@nestjs/common';
import { LlmRegistry } from '../../content/providers/llm-registry.service';

export type Intent = 'info' | 'commercial' | 'transactional' | 'navigational';

export interface IntentResult {
  keyword: string;
  intent: Intent;
  confidence: number; // 0-1
  /** "ai" when Claude classified it, "rule" when we fell back. */
  method: 'ai' | 'rule';
}

const RULE_PATTERNS: Array<{ pattern: RegExp; intent: Intent; confidence: number }> = [
  // transactional — explicit purchase intent
  {
    pattern: /\b(mua|đặt mua|order|book|giá|coupon|discount|signup|đăng ký)\b/i,
    intent: 'transactional',
    confidence: 0.9,
  },
  { pattern: /\b(buy|purchase|cheap|near me|sale)\b/i, intent: 'transactional', confidence: 0.85 },
  // commercial — investigation before purchase
  {
    pattern: /\b(so sánh|review|đánh giá|tốt nhất|top|vs|hoặc|nên chọn)\b/i,
    intent: 'commercial',
    confidence: 0.85,
  },
  { pattern: /\b(best|compare|vs|alternative|review)\b/i, intent: 'commercial', confidence: 0.8 },
  // navigational — branded
  {
    pattern: /\b(facebook|google|youtube|tiktok|shopee|lazada|tiki)\b/i,
    intent: 'navigational',
    confidence: 0.7,
  },
  // info — general curiosity
  {
    pattern: /\b(là gì|cách|hướng dẫn|tutorial|how to|what is|why|when)\b/i,
    intent: 'info',
    confidence: 0.85,
  },
];

/**
 * Section 8 TN2 — Intent classifier.
 *
 * Strategy:
 *   1. Batch keywords (up to 50/request) to Claude Haiku for cheap, fast
 *      classification.
 *   2. When Claude returns confidence < 0.7 OR the call fails, fall back to
 *      a deterministic rule-based pass so every keyword still ends with a
 *      label. Rule confidence is hard-coded per pattern.
 *   3. When ClaudeProvider runs in stub mode (placeholder key), we skip the
 *      AI hop entirely and classify by rules — output stays usable but
 *      `method='rule'` flags it.
 *
 * Acceptance: ≥85% accuracy (Section 8 TN2). Validated externally; here we
 * just keep the contract.
 */
@Injectable()
export class IntentClassifierService {
  private readonly logger = new Logger(IntentClassifierService.name);

  constructor(private readonly llm: LlmRegistry) {}

  async classifyBatch(keywords: string[], language = 'vi'): Promise<IntentResult[]> {
    if (keywords.length === 0) return [];
    const provider = this.llm.select('claude-haiku');

    if (!provider.available) {
      return keywords.map((k) => this.classifyByRule(k));
    }

    // 50 keywords per batch (Section 8 TN2).
    const out: IntentResult[] = [];
    for (let i = 0; i < keywords.length; i += 50) {
      const batch = keywords.slice(i, i + 50);
      try {
        const aiResults = await this.classifyWithAi(batch, language);
        for (let j = 0; j < batch.length; j++) {
          const ai = aiResults[j];
          // Keep the AI verdict only when it came from AI with sufficient confidence.
          if (ai && ai.method === 'ai' && ai.confidence >= 0.7) {
            out.push(ai);
          } else {
            out.push(this.classifyByRule(batch[j]!));
          }
        }
      } catch (err) {
        this.logger.warn(
          `Intent AI batch failed at ${i} (${(err as Error).message}) — falling back to rules`,
        );
        for (const kw of batch) out.push(this.classifyByRule(kw));
      }
    }
    return out;
  }

  /** Exposed for unit tests — pure rule-based path, no LLM. */
  classifyByRule(keyword: string): IntentResult {
    for (const { pattern, intent, confidence } of RULE_PATTERNS) {
      if (pattern.test(keyword)) {
        return { keyword, intent, confidence, method: 'rule' };
      }
    }
    return { keyword, intent: 'info', confidence: 0.5, method: 'rule' };
  }

  private async classifyWithAi(keywords: string[], language: string): Promise<IntentResult[]> {
    const provider = this.llm.select('claude-haiku');
    const prompt = this.buildPrompt(keywords, language);
    const result = await provider.generate({
      system:
        'Bạn là chuyên gia SEO phân loại keyword intent. Luôn trả về JSON array thuần, không markdown.',
      prompt,
      maxTokens: 4000,
      temperature: 0.2,
      model: 'claude-haiku',
    });
    const parsed = this.parseAiResult(result.content);
    return keywords.map((kw, i) => parsed[i] ?? this.classifyByRule(kw));
  }

  private buildPrompt(keywords: string[], language: string): string {
    return [
      `Phân loại intent của ${keywords.length} keyword sau. 4 nhóm:`,
      '- info: tìm hiểu thông tin (là gì, cách làm, định nghĩa)',
      '- commercial: nghiên cứu trước khi mua (so sánh, review, đánh giá, top)',
      '- transactional: sẵn sàng mua/đăng ký (mua, giá, đặt, coupon)',
      '- navigational: tìm 1 brand/site cụ thể',
      '',
      `Ngôn ngữ: ${language === 'en' ? 'English' : 'Vietnamese'}.`,
      '',
      'Trả về JSON array, mỗi phần tử có 3 field: { "keyword": "...", "intent": "...", "confidence": 0.0-1.0 }.',
      'KHÔNG bao gồm markdown wrapper. Bắt đầu trực tiếp với [.',
      '',
      'Keywords:',
      ...keywords.map((kw, i) => `${i + 1}. ${kw}`),
    ].join('\n');
  }

  private parseAiResult(raw: string): IntentResult[] {
    let body = raw.trim();
    if (body.startsWith('```')) {
      body = body
        .replace(/^```(?:json|JSON)?\s*\n?/, '')
        .replace(/\n?```\s*$/, '')
        .trim();
    }
    try {
      const parsed = JSON.parse(body) as Array<{
        keyword?: string;
        intent?: string;
        confidence?: number;
      }>;
      if (!Array.isArray(parsed)) return [];
      const out: IntentResult[] = [];
      for (const item of parsed) {
        const intent = (item.intent ?? 'info') as Intent;
        if (!['info', 'commercial', 'transactional', 'navigational'].includes(intent)) continue;
        out.push({
          keyword: item.keyword ?? '',
          intent,
          confidence: Math.max(0, Math.min(1, item.confidence ?? 0.6)),
          method: 'ai',
        });
      }
      return out;
    } catch (err) {
      this.logger.warn(`Intent AI parse failed: ${(err as Error).message}`);
      return [];
    }
  }
}
