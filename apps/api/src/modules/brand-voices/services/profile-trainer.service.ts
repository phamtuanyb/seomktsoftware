import { Injectable, Logger } from '@nestjs/common';
import { LlmRegistry } from '../../content/providers/llm-registry.service';
import {
  brandVoiceProfileSchema,
  type BrandVoiceProfile,
  type ProfileMeta,
} from '../schemas/profile.schema';

export interface TrainingArticle {
  title?: string | null;
  content: string;
}

export interface TrainingResult {
  profile: BrandVoiceProfile;
  reference_articles: Array<{ title: string | null; content: string }>;
  meta: ProfileMeta;
}

const MIN_SAMPLE_WORDS = 500;

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Section 8 TN5 step 2-3 — ask Claude Sonnet 4 for a Brand Voice Profile,
 * validate the result with Zod, fall back to a deterministic heuristic
 * when Claude is unavailable or returns invalid JSON.
 *
 * Reference article selection (step 4): pick the 3 longest articles so
 * TN4 has substantive style to imitate.
 */
@Injectable()
export class ProfileTrainerService {
  private readonly logger = new Logger(ProfileTrainerService.name);
  private static readonly MAX_CHARS_PER_ARTICLE = 24000;
  private static readonly REFERENCE_COUNT = 3;

  constructor(private readonly llm: LlmRegistry) {}

  async train(articles: TrainingArticle[]): Promise<TrainingResult> {
    const validArticles = articles.filter(
      (a) => a.content && countWords(a.content) >= MIN_SAMPLE_WORDS,
    );
    if (validArticles.length === 0) {
      throw new Error(`Cần ít nhất 1 bài có content ≥${MIN_SAMPLE_WORDS} từ để train brand voice.`);
    }

    const reference = this.pickReferences(validArticles);
    const provider = this.llm.select('claude-sonnet-4');

    if (!provider.available) {
      return {
        profile: this.heuristicProfile(validArticles),
        reference_articles: reference,
        meta: {
          algorithm: 'placeholder-heuristic',
          upgraded_to_real_at: null,
          sample_count: validArticles.length,
          trained_at: new Date().toISOString(),
        },
      };
    }

    const trimmed = validArticles.map((a) => ({
      title: a.title ?? null,
      content: a.content.slice(0, ProfileTrainerService.MAX_CHARS_PER_ARTICLE),
    }));

    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(trimmed);

    try {
      const result = await provider.generate({
        system: systemPrompt,
        prompt: userPrompt,
        maxTokens: 2500,
        temperature: 0.2,
        model: 'claude-sonnet-4',
      });
      const profile = this.parseAndValidate(result.content);
      return {
        profile,
        reference_articles: reference,
        meta: {
          algorithm: 'claude-sonnet-4',
          upgraded_to_real_at: new Date().toISOString(),
          sample_count: validArticles.length,
          trained_at: new Date().toISOString(),
          tokens_used: result.tokensUsed,
          cost_usd: result.costUsd,
        },
      };
    } catch (err) {
      this.logger.warn(
        `Profile training fell back to heuristic — Claude returned: ${(err as Error).message}`,
      );
      return {
        profile: this.heuristicProfile(validArticles),
        reference_articles: reference,
        meta: {
          algorithm: 'placeholder-heuristic',
          upgraded_to_real_at: null,
          sample_count: validArticles.length,
          trained_at: new Date().toISOString(),
        },
      };
    }
  }

  // ----- prompt building -----

  private buildSystemPrompt(): string {
    return [
      'Bạn là chuyên gia phân tích phong cách viết. Nhiệm vụ: trích xuất Brand Voice Profile từ các bài viết mẫu Nam cung cấp.',
      'Output BẮT BUỘC là JSON thuần (không markdown wrapper, không lời dẫn). Cấu trúc phải khớp schema yêu cầu trong user prompt.',
      'Hãy phân tích KỸ — không lặp lại định nghĩa chung chung, mà rút ra các đặc điểm CỤ THỂ từ chính các bài mẫu.',
    ].join('\n');
  }

  private buildUserPrompt(articles: Array<{ title: string | null; content: string }>): string {
    const block = articles
      .map((a, i) => `=== Bài ${i + 1}${a.title ? ` — "${a.title}"` : ''} ===\n${a.content}`)
      .join('\n\n');

    return `Phân tích ${articles.length} bài viết sau và trả về Brand Voice Profile theo schema JSON dưới đây.

===== BÀI MẪU =====
${block}

===== SCHEMA OUTPUT =====
{
  "tone": {
    "primary": "string (ví dụ: 'professional', 'friendly', 'authoritative', 'casual', ...)",
    "secondary": ["string", ...],
    "confidence": 0.0-1.0
  },
  "sentence_structure": {
    "avg_words_per_sentence": 3-80,
    "short_sentences_pct": 0-100,
    "long_sentences_pct": 0-100
  },
  "addressing": {
    "primary": "string (ví dụ: 'bạn', 'quý vị', 'anh chị', 'mình', ...)",
    "formality": "low|medium|high"
  },
  "signature_phrases": ["cụm từ đặc trưng", ...],
  "vocabulary": {
    "complexity": "simple|medium|advanced",
    "domain_terms": ["từ khoá lĩnh vực", ...]
  },
  "emoji_usage": {
    "enabled": true|false,
    "density": "none|sparse|medium|heavy",
    "common_emojis": ["😊", "🚀", ...]
  },
  "patterns": {
    "opening_style": "mô tả cách mở bài (1-2 câu)",
    "closing_style": "mô tả cách kết bài (1-2 câu)",
    "cta_style": "mô tả cách gọi hành động (1-2 câu)"
  }
}

===== YÊU CẦU =====
- KHÔNG dùng markdown fence. Bắt đầu trực tiếp bằng {.
- "signature_phrases" tối thiểu 3, tối đa 10 cụm thật sự đặc trưng (lặp lại ≥2 lần qua các bài, hoặc rất riêng biệt).
- Mọi giá trị phải dựa trên BẰNG CHỨNG trong bài mẫu — không bịa.

Bắt đầu trả về JSON:`;
  }

  // ----- parsing + validation -----

  private parseAndValidate(raw: string): BrandVoiceProfile {
    let body = raw.trim();
    if (body.startsWith('```')) {
      body = body
        .replace(/^```(?:json)?\s*\n?/i, '')
        .replace(/\n?```\s*$/, '')
        .trim();
    }
    const parsed = JSON.parse(body) as unknown;
    const result = brandVoiceProfileSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `Profile shape invalid: ${result.error.issues
          .slice(0, 5)
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')}`,
      );
    }
    return result.data;
  }

  // ----- helpers -----

  private pickReferences(
    articles: TrainingArticle[],
  ): Array<{ title: string | null; content: string }> {
    return [...articles]
      .sort((a, b) => b.content.length - a.content.length)
      .slice(0, ProfileTrainerService.REFERENCE_COUNT)
      .map((a) => ({ title: a.title ?? null, content: a.content }));
  }

  /** Section 5.6 fallback — heuristic profile (used when Claude is unavailable). */
  private heuristicProfile(articles: TrainingArticle[]): BrandVoiceProfile {
    const corpus = articles.map((a) => a.content).join('\n\n');
    const sentences = corpus.split(/[.!?]+\s+/).filter(Boolean);
    const lengths = sentences.map((s) => s.trim().split(/\s+/).length);
    const avg =
      lengths.length > 0
        ? Math.max(3, Math.min(80, Math.round(lengths.reduce((s, n) => s + n, 0) / lengths.length)))
        : 18;
    const shortPct = (lengths.filter((n) => n <= 10).length / Math.max(1, lengths.length)) * 100;
    const longPct = (lengths.filter((n) => n >= 25).length / Math.max(1, lengths.length)) * 100;
    const usesEmoji = /\p{Extended_Pictographic}/u.test(corpus);
    const usesBan = /\bbạn\b/i.test(corpus);

    return {
      tone: {
        primary: 'neutral-professional',
        secondary: [],
        confidence: 0.5,
      },
      sentence_structure: {
        avg_words_per_sentence: avg,
        short_sentences_pct: Math.round(shortPct),
        long_sentences_pct: Math.round(longPct),
      },
      addressing: {
        primary: usesBan ? 'bạn' : 'người đọc',
        formality: 'medium',
      },
      signature_phrases: [],
      vocabulary: { complexity: 'medium', domain_terms: [] },
      emoji_usage: {
        enabled: usesEmoji,
        density: usesEmoji ? 'sparse' : 'none',
        common_emojis: [],
      },
      patterns: {
        opening_style: 'hook then context',
        closing_style: 'summary with CTA',
        cta_style: 'soft suggestion',
      },
    };
  }
}
