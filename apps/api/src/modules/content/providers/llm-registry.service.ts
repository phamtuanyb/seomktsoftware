import { Inject, Injectable } from '@nestjs/common';
import {
  LLM_PROVIDER_CLAUDE,
  LLM_PROVIDER_OPENAI,
  resolveModel,
  type LlmModel,
  type LlmProvider,
} from './llm-provider.interface';

/**
 * Picks the right provider based on the user-supplied `model`. Section 8 TN4
 * allows `claude-sonnet-4 | claude-haiku | gpt-4o`. Default = claude-sonnet-4.
 */
@Injectable()
export class LlmRegistry {
  constructor(
    @Inject(LLM_PROVIDER_CLAUDE) private readonly claude: LlmProvider,
    @Inject(LLM_PROVIDER_OPENAI) private readonly openai: LlmProvider,
  ) {}

  select(model?: LlmModel): LlmProvider {
    const { providerKey } = resolveModel(model);
    return providerKey === LLM_PROVIDER_OPENAI ? this.openai : this.claude;
  }
}
