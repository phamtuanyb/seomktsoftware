import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import {
  isPlaceholderKey,
  resolveModel,
  type LlmGenerateOptions,
  type LlmGenerateResult,
  type LlmProvider,
  type LlmStreamEvent,
} from './llm-provider.interface';
import { stubArticleFor, stubOutlineFor, stubRewriteFor } from './stub-fixtures';
import { AiSettingsService } from '../../admin/ai-settings.service';

/**
 * Anthropic Claude provider — TN3 outline + TN4 article (streaming).
 *
 * Auto-detects when `ANTHROPIC_API_KEY` is still the .env.example placeholder
 * and falls back to deterministic stub responses. This lets Nam smoke-test the
 * whole pipeline end-to-end without paying for tokens, and lets unit tests
 * exercise the same code path.
 *
 * Pricing snapshot used for cost estimation (USD per 1M tokens, 2026):
 *   claude-sonnet-4-6:  input $3,    output $15
 *   claude-haiku-4-5:   input $0.80, output $4
 */
@Injectable()
export class ClaudeProvider implements LlmProvider {
  readonly name = 'claude';

  private readonly logger = new Logger(ClaudeProvider.name);
  private readonly envKey: string;

  get available(): boolean {
    return this.settings.hasConfiguredKey('claude');
  }

  /** Per-1M-token cost lookup (USD). */
  private static readonly PRICING: Record<string, { input: number; output: number }> = {
    'claude-sonnet-4-6': { input: 3, output: 15 },
    'claude-haiku-4-5-20251001': { input: 0.8, output: 4 },
  };

  constructor(
    cfg: ConfigService,
    private readonly settings: AiSettingsService,
  ) {
    this.envKey = cfg.get<string>('ai.anthropicApiKey') ?? process.env.ANTHROPIC_API_KEY ?? '';
    if (isPlaceholderKey(this.envKey)) {
      this.logger.warn(
        'ClaudeProvider running in STUB mode — ANTHROPIC_API_KEY is missing or placeholder',
      );
    }
  }

  async generate(opts: LlmGenerateOptions): Promise<LlmGenerateResult> {
    const { apiModel } = resolveModel(opts.model);

    const key = await this.settings.getApiKey('claude');
    if (!key) {
      return this.stubGenerate(opts, apiModel);
    }

    try {
      const client = new Anthropic({ apiKey: key });
      const response = await client.messages.create({
        model: apiModel,
        max_tokens: opts.maxTokens ?? 4096,
        temperature: opts.temperature ?? 0.7,
        system: opts.system,
        messages: [{ role: 'user', content: opts.prompt }],
        stop_sequences: opts.stopSequences,
      });

      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === 'text',
      );
      const content = textBlocks.map((b) => b.text).join('');
      const tokensUsed = {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      };
      return {
        content,
        tokensUsed,
        modelUsed: response.model,
        costUsd: this.estimateCost(apiModel, tokensUsed),
        isStub: false,
      };
    } catch (err) {
      this.logger.warn(
        `Claude generate failed; falling back to stub output: ${this.errorMessage(err)}`,
      );
      return this.stubGenerate(opts, apiModel);
    }
  }

  async *generateStream(opts: LlmGenerateOptions): AsyncIterable<LlmStreamEvent> {
    const { apiModel } = resolveModel(opts.model);

    const key = await this.settings.getApiKey('claude');
    if (!key) {
      yield* this.stubStream(opts, apiModel);
      return;
    }

    try {
      const client = new Anthropic({ apiKey: key });
      const stream = client.messages.stream({
        model: apiModel,
        max_tokens: opts.maxTokens ?? 8192,
        temperature: opts.temperature ?? 0.8,
        system: opts.system,
        messages: [{ role: 'user', content: opts.prompt }],
        stop_sequences: opts.stopSequences,
      });

      let inputTokens = 0;
      let outputTokens = 0;

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield { type: 'token', content: event.delta.text };
        } else if (event.type === 'message_delta' && event.usage) {
          outputTokens = event.usage.output_tokens;
        } else if (event.type === 'message_start' && event.message.usage) {
          inputTokens = event.message.usage.input_tokens;
        }
      }

      const final = await stream.finalMessage();
      yield {
        type: 'finish',
        reason: final.stop_reason ?? 'end_turn',
        tokensUsed: {
          input: final.usage.input_tokens || inputTokens,
          output: final.usage.output_tokens || outputTokens,
        },
        costUsd: this.estimateCost(apiModel, {
          input: final.usage.input_tokens || inputTokens,
          output: final.usage.output_tokens || outputTokens,
        }),
        isStub: false,
      };
    } catch (err) {
      this.logger.warn(
        `Claude stream failed; falling back to stub stream: ${this.errorMessage(err)}`,
      );
      yield* this.stubStream(opts, apiModel);
    }
  }

  // ----- stub mode helpers -----

  private stubGenerate(opts: LlmGenerateOptions, apiModel: string): LlmGenerateResult {
    // The article prompt explicitly asks for markdown / "Bắt đầu viết:"; the
    // outline prompt explicitly asks to "Trả về JSON thuần". The rewrite/regenerate
    // prompts include a "===== NỘI DUNG GỐC =====" section. Use marker phrases
    // (not the word "outline" — TN4 prompt embeds the input outline) so stub
    // mode picks the right fixture.
    const wantsRewrite = /NỘI DUNG GỐC|Body cũ \(để tham khảo/i.test(opts.prompt);
    const wantsArticle = /Markdown output only|Bat dau viet bai|Viet mot bai SEO|Bắt đầu viết|Viết một bài viết SEO/i.test(
      opts.prompt,
    );
    const keyword = this.guessKeyword(opts.prompt);
    let content: string;
    if (wantsRewrite) {
      const action = /shorter/i.test(opts.prompt)
        ? 'shorter'
        : /longer/i.test(opts.prompt)
          ? 'longer'
          : /tone "/i.test(opts.prompt)
            ? 'tone'
            : /thêm chi tiết/i.test(opts.prompt)
              ? 'details'
              : /Body cũ/i.test(opts.prompt)
                ? 'regenerate'
                : 'rewrite';
      content = stubRewriteFor({ source: opts.prompt, action, keyword });
    } else if (wantsArticle) {
      content = stubArticleFor(keyword, this.guessTargetWordCount(opts.prompt));
    } else {
      content = stubOutlineFor(keyword);
    }
    const inputTokens = Math.ceil((opts.prompt.length + (opts.system?.length ?? 0)) / 4);
    const outputTokens = Math.ceil(content.length / 4);
    return {
      content,
      tokensUsed: { input: inputTokens, output: outputTokens },
      modelUsed: `${apiModel}-stub`,
      costUsd: 0,
      isStub: true,
    };
  }

  private async *stubStream(
    opts: LlmGenerateOptions,
    apiModel: string,
  ): AsyncIterable<LlmStreamEvent> {
    const result = this.stubGenerate(opts, apiModel);
    // Chunk into ~40-char tokens with a small delay so the SSE pipeline gets
    // exercised the same way as real Claude streaming.
    const chunkSize = 40;
    for (let i = 0; i < result.content.length; i += chunkSize) {
      const chunk = result.content.slice(i, i + chunkSize);
      yield { type: 'token', content: chunk };
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    yield {
      type: 'finish',
      reason: 'end_turn',
      tokensUsed: result.tokensUsed,
      costUsd: 0,
      isStub: true,
    };
  }

  private guessKeyword(prompt: string): string {
    // Patterns we emit in our prompt templates:
    //   `keyword: "..."`  /  `KEYWORD CHINH:\n...`  /  `keyword "..."`
    const quoted = prompt.match(/keyword[^\n]*?["“']([^"”'\n]{2,80})["”']/i);
    if (quoted?.[1]) return quoted[1].trim();
    const asciiLabeled = prompt.match(/KEYWORD CHINH:\s*\n([^\n]{2,120})/i);
    if (asciiLabeled?.[1]) return asciiLabeled[1].trim();
    const labeled = prompt.match(/===== KEYWORD( CHÍNH)? =====\s*\n([^\n]{2,80})/i);
    if (labeled?.[2]) return labeled[2].trim();
    const inline = prompt.match(/keyword[":\s]+([^"'\n,]{2,80})/i);
    if (inline?.[1]) return inline[1].trim();
    return 'chủ đề mẫu';
  }

  private guessTargetWordCount(prompt: string): number {
    const exact = prompt.match(/khoang\s+(\d{3,5})\s+tu/i);
    if (exact?.[1]) return Number(exact[1]);
    const range = prompt.match(/khoang\s+(\d{3,5})-(\d{3,5})\s+tu/i);
    if (range?.[1] && range?.[2]) return Math.round((Number(range[1]) + Number(range[2])) / 2);
    return 2000;
  }

  private estimateCost(apiModel: string, tokens: { input: number; output: number }): number {
    const price = ClaudeProvider.PRICING[apiModel];
    if (!price) return 0;
    return (tokens.input / 1_000_000) * price.input + (tokens.output / 1_000_000) * price.output;
  }

  private errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
