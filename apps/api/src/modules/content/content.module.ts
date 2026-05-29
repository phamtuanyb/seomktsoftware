import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { AuditModule } from '../audit/audit.module';
import { ContentController } from './content.controller';
import { SerpService } from './services/serp.service';
import { OutlineService } from './services/outline.service';
import { ArticleService } from './services/article.service';
import { ArticleEditorService } from './services/article-editor.service';
import { ArticlePostProcessService } from './services/article-post-process.service';
import { ContentBatchService } from './services/content-batch.service';
import { ContentBatchRunnerService } from './services/content-batch-runner.service';
import { BrandVoiceSimilarityService } from './services/brand-voice-similarity.service';
import { ContentBatchQueue } from './workers/content-batch.queue';
import { ContentBatchProcessor } from './workers/content-batch.processor';

/** Section 8 — TN3 outline + TN4 article (streaming). */
@Module({
  // LlmModule owns the Claude/OpenAI providers + registry.
  // AuditModule provides the 12-rule AuditService that TN4 calls after post-process.
  imports: [LlmModule, AuditModule],
  controllers: [ContentController],
  providers: [
    SerpService,
    OutlineService,
    ArticleService,
    ArticleEditorService,
    ArticlePostProcessService,
    BrandVoiceSimilarityService,
    ContentBatchService,
    ContentBatchRunnerService,
    { provide: 'ContentBatchRunnerService', useExisting: ContentBatchRunnerService },
    ContentBatchQueue,
    ContentBatchProcessor,
  ],
  exports: [
    OutlineService,
    ArticleService,
    ArticleEditorService,
    ArticlePostProcessService,
    ContentBatchService,
  ],
})
export class ContentModule {}
