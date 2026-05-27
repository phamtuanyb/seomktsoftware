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
import { AiSettingsService } from '../../admin/ai-settings.service';

@Injectable()
export class OpenAiProvider implements LlmProvider {
  readonly name = 'openai';

  private readonly logger = new Logger(OpenAiProvider.name);
  private readonly envKey: string;

  get available(): boolean {
    return this.settings.hasConfiguredKey('openai');
  }

  private static readonly PRICING: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 2.5, output: 10 },
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
  };

  constructor(
    cfg: ConfigService,
    private readonly settings: AiSettingsService,
  ) {
    this.envKey = cfg.get<string>('ai.openaiApiKey') ?? process.env.OPENAI_API_KEY ?? '';
    if (isPlaceholderKey(this.envKey)) {
      this.logger.warn('OpenAiProvider running in STUB mode - OPENAI_API_KEY is missing');
    }
  }

  async generate(opts: LlmGenerateOptions): Promise<LlmGenerateResult> {
    const { apiModel } = resolveModel(opts.model ?? 'gpt-4o');
    const key = await this.settings.getApiKey('openai');
    if (!key) return this.stubGenerate(opts, apiModel);

    try {
      const client = new OpenAI({ apiKey: key });
      const response = await client.chat.completions.create({
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
    } catch (err) {
      this.logger.warn(`OpenAI generate failed; falling back to stub: ${(err as Error).message}`);
      return this.stubGenerate(opts, apiModel);
    }
  }

  async *generateStream(opts: LlmGenerateOptions): AsyncIterable<LlmStreamEvent> {
    const { apiModel } = resolveModel(opts.model ?? 'gpt-4o');
    const key = await this.settings.getApiKey('openai');
    if (!key) {
      yield* this.stubStream(opts, apiModel);
      return;
    }

    try {
      const client = new OpenAI({ apiKey: key });
      const stream = await client.chat.completions.create({
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
        isStub: false,
      };
    } catch (err) {
      this.logger.warn(`OpenAI stream failed; falling back to stub: ${(err as Error).message}`);
      yield* this.stubStream(opts, apiModel);
    }
  }

  private stubGenerate(opts: LlmGenerateOptions, apiModel: string): LlmGenerateResult {
    const wantsArticle = /Markdown output only|Bat dau viet bai|Viet mot bai SEO|Bắt đầu viết|Viết một bài viết SEO/i.test(
      opts.prompt,
    );
    const labeled = opts.prompt.match(/KEYWORD CHINH:\s*\n([^\n]{2,120})/i);
    const quoted = opts.prompt.match(/keyword[^\n]*?["“']([^"”'\n]{2,80})["”']/i);
    const inline = opts.prompt.match(/keyword[":\s]+([^"'\n,]{2,80})/i);
    const keyword =
      (labeled?.[1]?.trim() || quoted?.[1]?.trim() || inline?.[1]?.trim()) ?? 'chu de mau';
    const target = Number(opts.prompt.match(/khoang\s+(\d{3,5})\s+tu/i)?.[1] ?? 2000);
    const content = wantsArticle ? stubArticleFor(keyword, target) : stubOutlineFor(keyword);
    return {
      content,
      tokensUsed: { input: Math.ceil(opts.prompt.length / 4), output: Math.ceil(content.length / 4) },
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
      isStub: true,
    };
  }

  private estimateCost(apiModel: string, tokens: { input: number; output: number }): number {
    const price = OpenAiProvider.PRICING[apiModel];
    if (!price) return 0;
    return (tokens.input / 1_000_000) * price.input + (tokens.output / 1_000_000) * price.output;
  }
}
