import { Injectable, Logger } from '@nestjs/common';
import { LlmRegistry } from '../../content/providers/llm-registry.service';

export interface AltTextRequest {
  prompt: string;
  keyword?: string;
  /** Optional surrounding heading or article title for context. */
  context?: string;
}

export interface AltTextResult {
  alt_text: string;
  cost_usd: number;
  is_stub: boolean;
  method: 'ai' | 'rule';
}

/**
 * Section 8 TN6 step 6 — sinh alt text bằng Claude Haiku từ prompt + context.
 * Acceptance: Alt text 100 % chứa keyword.
 *
 * Stub mode (no real Anthropic key) builds the alt text from the prompt +
 * keyword via a deterministic template so the rest of the pipeline still
 * persists a usable alt value.
 */
@Injectable()
export class AltTextService {
  private readonly logger = new Logger(AltTextService.name);

  constructor(private readonly llm: LlmRegistry) {}

  async generate(req: AltTextRequest): Promise<AltTextResult> {
    const provider = this.llm.select('claude-haiku');
    if (!provider.available) {
      return {
        alt_text: this.fallback(req),
        cost_usd: 0,
        is_stub: true,
        method: 'rule',
      };
    }
    try {
      const result = await provider.generate({
        system:
          'Bạn là chuyên gia SEO viết alt text cho ảnh. Yêu cầu: 1 câu mô tả ngắn (5-15 từ), tiếng Việt tự nhiên, không bắt đầu bằng "Hình ảnh của", có chèn keyword chính nếu hợp ngữ cảnh.',
        prompt: this.buildPrompt(req),
        maxTokens: 80,
        temperature: 0.4,
        model: 'claude-haiku',
      });
      let altText = this.clean(result.content);
      // Acceptance guard — force-inject keyword if AI forgot it.
      if (req.keyword && !altText.toLowerCase().includes(req.keyword.toLowerCase())) {
        altText = `${altText} (${req.keyword})`;
      }
      return {
        alt_text: altText.slice(0, 500),
        cost_usd: result.costUsd,
        is_stub: result.isStub,
        method: 'ai',
      };
    } catch (err) {
      this.logger.warn(`Alt-text AI gen failed (${(err as Error).message}) — using fallback`);
      return {
        alt_text: this.fallback(req),
        cost_usd: 0,
        is_stub: true,
        method: 'rule',
      };
    }
  }

  private buildPrompt(req: AltTextRequest): string {
    return [
      `Prompt tạo ảnh: ${req.prompt}`,
      req.context ? `Ngữ cảnh bài viết: ${req.context}` : '',
      req.keyword ? `Keyword cần chèn: ${req.keyword}` : '',
      'Trả về CHỈ alt text (1 câu, không quote, không markdown):',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private clean(raw: string): string {
    return raw
      .replace(/^["']+|["']+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private fallback(req: AltTextRequest): string {
    const base = req.prompt.split(/[,.\n]/)[0]?.trim() ?? 'minh hoạ';
    if (req.keyword && !base.toLowerCase().includes(req.keyword.toLowerCase())) {
      return `${base} — ${req.keyword}`.slice(0, 500);
    }
    return base.slice(0, 500);
  }
}
