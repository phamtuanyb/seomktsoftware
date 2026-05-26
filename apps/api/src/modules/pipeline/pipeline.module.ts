import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module';
import { AuditModule } from '../audit/audit.module';
import { ImagesModule } from '../images/images.module';
import { PublisherModule } from '../publisher/publisher.module';
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './services/pipeline.service';
import { PipelineRunnerService } from './services/pipeline-runner.service';
import { PipelineQueue } from './workers/pipeline.queue';
import { PipelineProcessor } from './workers/pipeline.processor';

/**
 * Sprint 15 — pipeline orchestrator.
 *
 * Imports the TN modules whose services it composes. The processor
 * resolves PipelineRunnerService via ModuleRef under an explicit token
 * (mirrors the publisher + webhooks pattern) so the queue⇄service cycle
 * stays loose.
 */
@Module({
  imports: [ContentModule, AuditModule, ImagesModule, PublisherModule],
  controllers: [PipelineController],
  providers: [
    PipelineService,
    PipelineRunnerService,
    { provide: 'PipelineRunnerService', useExisting: PipelineRunnerService },
    PipelineQueue,
    PipelineProcessor,
  ],
  exports: [PipelineService],
})
export class PipelineModule {}
