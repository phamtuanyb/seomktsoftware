import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  isPlaceholderKey,
  resolveModel,
  type LlmGenerateOptions,
  type LlmGenerateResult,
  type LlmProvider,
  type LlmStreamEvent,
} from './llm-provider.interface';
import { stubArticleFor, stubOutlineFor } from './stub-fixtures';

/**
 * Backup provider — OpenAI GPT-4o. Mirrors ClaudeProvider's contract so
 * callers can choose `model: 'gpt-4o'` (Section 8 TN4 lists it as a valid
 * option). Stub mode kicks in when OPENAI_API_KEY is the placeholder.
 *
 * Pricing snapshot (USD per 1M tokens, 2026):
 *   gpt-4o:      input $2.50, output $10
 *   gpt-4o-mini: input $0.15, output $0.60
 */
@Injectable()
export class OpenAiProvider implements LlmProvider {
  readonly name = 'openai';

  private readonly logger = new Logger(OpenAiProvider.name);
  private readonly client: OpenAI | null;
  readonly available: boolean;

  private static readonly PRICING: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 2.5, output: 10 },
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
  };

  constructor(cfg: ConfigService) {
    const key = cfg.get<string>('ai.openaiApiKey') ?? process.env.OPENAI_API_KEY;
    this.available = !isPlaceholderKey(key);
    this.client = this.available ? new OpenAI({ apiKey: key }) : null;
    if (!this.available) {
      this.logger.warn(
        'OpenAiProvider running in STUB mode — OPENAI_API_KEY is missing or placeholder',
      );
    }
  }

  async generate(opts: LlmGenerateOptions): Promise<LlmGenerateResult> {
    const { apiModel } = resolveModel(opts.model);

    if (!this.client || !this.available) {
      return this.stubGenerate(opts, apiModel);
    }

    const response = await this.client.chat.completions.create({
      model: apiModel,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0.7,
      messages: [
        ...(opts.system ? [{ role: 'system' as const, content: opts.system }] : []),
        { role: 'user' as const, content: opts.prompt },
      ],
      stop: opts.stopSequences,
    });

    const content = response.choices[0]?.message?.content ?? '';
    const tokensUsed = {
      input: response.usage?.prompt_tokens ?? 0,
      output: response.usage?.completion_tokens ?? 0,
    };
    return {
      content,
      tokensUsed,
      modelUsed: response.model,
      costUsd: this.estimateCost(apiModel, tokensUsed),
      isStub: false,
    };
  }

  async *generateStream(opts: LlmGenerateOptions): AsyncIterable<LlmStreamEvent> {
    const { apiModel } = resolveModel(opts.model);

    if (!this.client || !this.available) {
      yield* this.stubStream(opts, apiModel);
      return;
    }

    const stream = await this.client.chat.completions.create({
      model: apiModel,
      max_tokens: opts.maxTokens ?? 8192,
      temperature: opts.temperature ?? 0.8,
      messages: [
        ...(opts.system ? [{ role: 'system' as const, content: opts.system }] : []),
        { role: 'user' as const, content: opts.prompt },
      ],
      stream: true,
      stream_options: { include_usage: true },
    });

    let inputTokens = 0;
    let outputTokens = 0;
    let finishReason = 'stop';

    for await (const event of stream) {
      const delta = event.choices[0]?.delta?.content;
      if (delta) yield { type: 'token', content: delta };
      if (event.choices[0]?.finish_reason) finishReason = event.choices[0].finish_reason;
      if (event.usage) {
        inputTokens = event.usage.prompt_tokens;
        outputTokens = event.usage.completion_tokens;
      }
    }

    yield {
      type: 'finish',
      reason: finishReason,
      tokensUsed: { input: inputTokens, output: outputTokens },
      costUsd: this.estimateCost(apiModel, { input: inputTokens, output: outputTokens }),
    };
  }

  // ----- stub mode -----

  private stubGenerate(opts: LlmGenerateOptions, apiModel: string): LlmGenerateResult {
    const isOutline = /outline|h1|sections|JSON/i.test(opts.prompt);
    const keyword =
      opts.prompt.match(/keyword[":\s]+["']?([^"'\n,]{2,80})["']?/i)?.[1]?.trim() ?? 'chủ đề mẫu';
    const content = isOutline ? stubOutlineFor(keyword) : stubArticleFor(keyword);
    return {
      content,
      tokensUsed: { input: 100, output: 800 },
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
    for (let i = 0; i < result.content.length; i += 40) {
      yield { type: 'token', content: result.content.slice(i, i + 40) };
      await new Promise((r) => setTimeout(r, 5));
    }
    yield {
      type: 'finish',
      reason: 'stop',
      tokensUsed: result.tokensUsed,
      costUsd: 0,
    };
  }

  private estimateCost(apiModel: string, tokens: { input: number; output: number }): number {
    const price = OpenAiProvider.PRICING[apiModel];
    if (!price) return 0;
    return (tokens.input / 1_000_000) * price.input + (tokens.output / 1_000_000) * price.output;
  }
}
