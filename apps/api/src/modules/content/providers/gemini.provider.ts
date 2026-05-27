import { Injectable, Logger } from '@nestjs/common';
import {
  resolveModel,
  type LlmGenerateOptions,
  type LlmGenerateResult,
  type LlmProvider,
  type LlmStreamEvent,
} from './llm-provider.interface';
import { stubArticleFor, stubOutlineFor } from './stub-fixtures';
import { AiSettingsService } from '../../admin/ai-settings.service';

@Injectable()
export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini';
  private readonly logger = new Logger(GeminiProvider.name);

  get available(): boolean {
    return this.settings.hasConfiguredKey('gemini');
  }

  constructor(private readonly settings: AiSettingsService) {}

  async generate(opts: LlmGenerateOptions): Promise<LlmGenerateResult> {
    const { apiModel } = resolveModel(opts.model ?? 'gemini-1.5-pro');
    const key = await this.settings.getApiKey('gemini');
    if (!key) return this.stubGenerate(opts, apiModel);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: opts.system
              ? { parts: [{ text: opts.system }] }
              : undefined,
            contents: [{ role: 'user', parts: [{ text: opts.prompt }] }],
            generationConfig: {
              maxOutputTokens: opts.maxTokens ?? 8192,
              temperature: opts.temperature ?? 0.8,
              stopSequences: opts.stopSequences,
            },
          }),
        },
      );
      if (!response.ok) {
        throw new Error(`Gemini ${response.status}: ${await response.text()}`);
      }
      const json = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      };
      const content =
        json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
      const tokensUsed = {
        input: json.usageMetadata?.promptTokenCount ?? 0,
        output: json.usageMetadata?.candidatesTokenCount ?? 0,
      };
      return {
        content,
        tokensUsed,
        modelUsed: apiModel,
        costUsd: 0,
        isStub: false,
      };
    } catch (err) {
      this.logger.warn(`Gemini generate failed; falling back to stub: ${(err as Error).message}`);
      return this.stubGenerate(opts, apiModel);
    }
  }

  async *generateStream(opts: LlmGenerateOptions): AsyncIterable<LlmStreamEvent> {
    const result = await this.generate(opts);
    for (let i = 0; i < result.content.length; i += 80) {
      yield { type: 'token', content: result.content.slice(i, i + 80) };
      await new Promise((r) => setTimeout(r, 2));
    }
    yield {
      type: 'finish',
      reason: 'stop',
      tokensUsed: result.tokensUsed,
      costUsd: result.costUsd,
      isStub: result.isStub,
    };
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
}
