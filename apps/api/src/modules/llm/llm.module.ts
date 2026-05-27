import { Module } from '@nestjs/common';
import { ClaudeProvider } from '../content/providers/claude.provider';
import { GeminiProvider } from '../content/providers/gemini.provider';
import { OpenAiProvider } from '../content/providers/openai.provider';
import { YescaleProvider } from '../content/providers/yescale.provider';
import { LlmRegistry } from '../content/providers/llm-registry.service';
import {
  LLM_PROVIDER_CLAUDE,
  LLM_PROVIDER_GEMINI,
  LLM_PROVIDER_OPENAI,
  LLM_PROVIDER_YESCALE,
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
    GeminiProvider,
    YescaleProvider,
    { provide: LLM_PROVIDER_CLAUDE, useExisting: ClaudeProvider },
    { provide: LLM_PROVIDER_OPENAI, useExisting: OpenAiProvider },
    { provide: LLM_PROVIDER_GEMINI, useExisting: GeminiProvider },
    { provide: LLM_PROVIDER_YESCALE, useExisting: YescaleProvider },
    LlmRegistry,
  ],
  exports: [
    LlmRegistry,
    LLM_PROVIDER_CLAUDE,
    LLM_PROVIDER_OPENAI,
    LLM_PROVIDER_GEMINI,
    LLM_PROVIDER_YESCALE,
    ClaudeProvider,
    OpenAiProvider,
    GeminiProvider,
    YescaleProvider,
  ],
})
export class LlmModule {}
