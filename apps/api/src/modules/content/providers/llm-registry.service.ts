import { Inject, Injectable } from '@nestjs/common';
import {
  LLM_PROVIDER_CLAUDE,
  LLM_PROVIDER_GEMINI,
  LLM_PROVIDER_OPENAI,
  LLM_PROVIDER_YESCALE,
  resolveModel,
  type LlmModel,
  type LlmProvider,
} from './llm-provider.interface';
import { AiSettingsService } from '../../admin/ai-settings.service';

/**
 * Picks the right provider based on the user-supplied `model`. Section 8 TN4
 * allows `claude-sonnet-4 | claude-haiku | gpt-4o`. Default = claude-sonnet-4.
 */
@Injectable()
export class LlmRegistry {
  constructor(
    @Inject(LLM_PROVIDER_CLAUDE) private readonly claude: LlmProvider,
    @Inject(LLM_PROVIDER_OPENAI) private readonly openai: LlmProvider,
    @Inject(LLM_PROVIDER_GEMINI) private readonly gemini: LlmProvider,
    @Inject(LLM_PROVIDER_YESCALE) private readonly yescale: LlmProvider,
    private readonly settings: AiSettingsService,
  ) {}

  select(model?: LlmModel): LlmProvider {
    if (!model) {
      const provider = this.settings.getCachedDefaultProvider();
      if (provider === 'openai') return this.openai;
      if (provider === 'gemini') return this.gemini;
      if (provider === 'yescale') return this.yescale;
      return this.claude;
    }
    const { providerKey } = resolveModel(model);
    if (providerKey === LLM_PROVIDER_OPENAI) return this.openai;
    if (providerKey === LLM_PROVIDER_GEMINI) return this.gemini;
    if (providerKey === LLM_PROVIDER_YESCALE) return this.yescale;
    return this.claude;
  }
}
