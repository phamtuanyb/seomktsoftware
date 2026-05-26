import { Module } from '@nestjs/common';
import { ClaudeProvider } from '../content/providers/claude.provider';
import { OpenAiProvider } from '../content/providers/openai.provider';
import { LlmRegistry } from '../content/providers/llm-registry.service';
import {
  LLM_PROVIDER_CLAUDE,
  LLM_PROVIDER_OPENAI,
} from '../content/providers/llm-provider.interface';

/**
 * Shared module that owns the LLM providers + registry so multiple feature
 * modules (content, audit, keywords) can inject LlmRegistry without creating
 * a module-level cycle through ContentModule.
 *
 * The provider classes still live in content/providers/ — only the
 * NestJS-level wiring moves here.
 */
@Module({
  providers: [
    ClaudeProvider,
    OpenAiProvider,
    { provide: LLM_PROVIDER_CLAUDE, useExisting: ClaudeProvider },
    { provide: LLM_PROVIDER_OPENAI, useExisting: OpenAiProvider },
    LlmRegistry,
  ],
  exports: [LlmRegistry, LLM_PROVIDER_CLAUDE, LLM_PROVIDER_OPENAI, ClaudeProvider, OpenAiProvider],
})
export class LlmModule {}
