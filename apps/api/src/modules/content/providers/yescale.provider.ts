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

const YESCALE_BASE_URL = 'https://api.yescale.io/v1';

@Injectable()
export class YescaleProvider implements LlmProvider {
  readonly name = 'yescale';

  private readonly logger = new Logger(YescaleProvider.name);
  private readonly envKey: string;

  get available(): boolean {
    return this.settings.hasConfiguredKey('yescale');
  }

  constructor(
    cfg: ConfigService,
    private readonly settings: AiSettingsService,
  ) {
    this.envKey = cfg.get<string>('ai.yescaleApiKey') ?? process.env.YESCALE_API_KEY ?? '';
    if (isPlaceholderKey(this.envKey)) {
      this.logger.warn('YescaleProvider running in STUB mode - YESCALE_API_KEY is missing');
    }
  }

  async generate(opts: LlmGenerateOptions): Promise<LlmGenerateResult> {
    const { apiModel } = resolveModel(opts.model ?? 'yescale-gpt-4.1-mini');
    const key = await this.settings.getApiKey('yescale');
    if (!key) return this.stubGenerate(opts, apiModel);

    try {
      const client = new OpenAI({ apiKey: key, baseURL: YESCALE_BASE_URL });
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
        costUsd: 0,
        isStub: false,
      };
    } catch (err) {
      this.logger.warn(`Yescale generate failed; falling back to stub: ${(err as Error).message}`);
      return this.stubGenerate(opts, apiModel);
    }
  }

  async *generateStream(opts: LlmGenerateOptions): AsyncIterable<LlmStreamEvent> {
    const { apiModel } = resolveModel(opts.model ?? 'yescale-gpt-4.1-mini');
    const key = await this.settings.getApiKey('yescale');
    if (!key) {
      yield* this.stubStream(opts, apiModel);
      return;
    }

    try {
      const client = new OpenAI({ apiKey: key, baseURL: YESCALE_BASE_URL });
      const stream = await client.chat.completions.create({
        model: apiModel,
        max_tokens: opts.maxTokens ?? 8192,
        temperature: opts.temperature ?? 0.8,
        messages: [
          ...(opts.system ? [{ role: 'system' as const, content: opts.system }] : []),
          { role: 'user' as const, content: opts.prompt },
        ],
        stream: true,
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
        costUsd: 0,
        isStub: false,
      };
    } catch (err) {
      this.logger.warn(`Yescale stream failed; falling back to stub: ${(err as Error).message}`);
      yield* this.stubStream(opts, apiModel);
    }
  }

  private stubGenerate(opts: LlmGenerateOptions, apiModel: string): LlmGenerateResult {
    const wantsArticle = /Markdown output only|Bat dau viet bai|Viet mot bai SEO|Bắt đầu viết|Viết một bài viết SEO/i.test(
      opts.prompt,
    );
    const keyword =
      opts.prompt.match(/KEYWORD CHINH:\s*\n([^\n]{2,120})/i)?.[1]?.trim() ??
      opts.prompt.match(/keyword[^\n]*?["“']([^"”'\n]{2,80})["”']/i)?.[1]?.trim() ??
      'chu de mau';
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
}
