import { Module } from '@nestjs/common';
import { ContentController } from './content.controller';
import { ClaudeProvider } from './providers/claude.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { LlmRegistry } from './providers/llm-registry.service';
import { LLM_PROVIDER_CLAUDE, LLM_PROVIDER_OPENAI } from './providers/llm-provider.interface';
import { SerpService } from './services/serp.service';
import { OutlineService } from './services/outline.service';

/** Section 8 — TN3 outline + TN4 article (streaming). */
@Module({
  controllers: [ContentController],
  providers: [
    SerpService,
    OutlineService,
    ClaudeProvider,
    OpenAiProvider,
    { provide: LLM_PROVIDER_CLAUDE, useExisting: ClaudeProvider },
    { provide: LLM_PROVIDER_OPENAI, useExisting: OpenAiProvider },
    LlmRegistry,
  ],
  exports: [OutlineService, LlmRegistry],
})
export class ContentModule {}
