import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/services/prisma.service';
import { EventBusService } from '../../../common/services/event-bus.service';
import { OutlineService } from '../../content/services/outline.service';
import { ArticleService } from '../../content/services/article.service';
import { AuditService } from '../../audit/services/audit.service';
import { ImagesService } from '../../images/services/images.service';
import { PublisherService } from '../../publisher/services/publisher.service';
import type { StartPipelineRunDto } from '../dto/pipeline.dto';

export interface PipelineStepResult {
  step: 'outline' | 'article' | 'audit' | 'images' | 'publish';
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
  started_at?: string;
  finished_at?: string;
  output_ref?: string;
  error_message?: string;
  /** Light per-step facts that the UI surfaces (word_count, score, image count…). */
  details?: Record<string, unknown>;
}

const STEP_ORDER: PipelineStepResult['step'][] = [
  'outline',
  'article',
  'audit',
  'images',
  'publish',
];

/**
 * Sprint 15 — Section 3 pipeline orchestrator.
 *
 * Drives the 5-step chain off a single `pipeline_runs` row:
 *   1. outline   — TN3
 *   2. article   — TN4 (consumes TN5 brand voice if provided)
 *   3. audit     — TN7 score
 *   4. images    — TN6 (skipped when `generate_images=false`)
 *   5. publish   — TN8 (skipped when `site_id` omitted)
 *
 * Each step writes its result into `steps_json` so the UI can render
 * partial progress while the worker is still in flight. Failures stop
 * the chain immediately — we don't try to recover from a bad outline by
 * skipping ahead to the article step.
 */
@Injectable()
export class PipelineRunnerService {
  private readonly logger = new Logger(PipelineRunnerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly outlines: OutlineService,
    private readonly articles: ArticleService,
    private readonly audit: AuditService,
    private readonly images: ImagesService,
    private readonly publisher: PublisherService,
  ) {}

  async run(runId: string): Promise<void> {
    const run = await this.prisma.pipelineRun.findUnique({ where: { id: runId } });
    if (!run) {
      this.logger.warn(`pipeline run ${runId} not found, nothing to do`);
      return;
    }
    if (run.status !== 'pending' && run.status !== 'running') {
      // Cancelled or already finished — don't double-execute on a worker restart.
      this.logger.log(`pipeline run ${runId} already in terminal status ${run.status}, skipping`);
      return;
    }

    const input = run.inputJson as unknown as StartPipelineRunDto;
    const steps = this.initSteps(input);

    await this.prisma.pipelineRun.update({
      where: { id: runId },
      data: {
        status: 'running',
        startedAt: new Date(),
        stepsJson: steps as unknown as object,
      },
    });

    try {
      // ---- Step 1: outline ----
      this.markRunning(steps, 'outline');
      await this.persistSteps(runId, steps);
      const outline = await this.outlines.generate(
        {
          keyword: input.keyword,
          format: input.format,
          target_word_count: input.target_word_count,
        },
        input.model,
      );
      this.markSucceeded(steps, 'outline', {
        details: {
          sections: outline.sections.length,
          model: outline.metadata.ai_model,
          cached: outline.metadata.cached,
          is_stub: outline.metadata.is_stub,
        },
      });
      await this.persistSteps(runId, steps);

      // ---- Step 2: article ----
      this.markRunning(steps, 'article');
      await this.persistSteps(runId, steps);
      const article = await this.articles.generate(
        {
          keyword: input.keyword,
          outline: { h1: outline.h1, sections: outline.sections },
          brand_voice_id: input.brand_voice_id,
          format: input.format,
          target_word_count: input.target_word_count,
          model: input.model,
        },
        run.userId,
      );
      this.markSucceeded(steps, 'article', {
        output_ref: article.id,
        details: {
          word_count: article.word_count,
          content_score: article.content_score,
          model: article.ai_model,
        },
      });
      await this.prisma.pipelineRun.update({
        where: { id: runId },
        data: {
          articleId: article.id,
          stepsJson: steps as unknown as object,
        },
      });

      // ---- Step 3: audit ----
      this.markRunning(steps, 'audit');
      await this.persistSteps(runId, steps);
      const auditReport = await this.audit.score(
        { article_id: article.id, target_keyword: input.keyword },
        run.userId,
      );
      const ruleResults = Object.values(auditReport.breakdown);
      this.markSucceeded(steps, 'audit', {
        details: {
          overall_score: auditReport.score,
          status: auditReport.status,
          rules_passed: ruleResults.filter((r) => r.status === 'good').length,
          rules_total: ruleResults.length,
        },
      });
      await this.persistSteps(runId, steps);

      // ---- Step 4: images (skippable) ----
      if (input.generate_images === false) {
        this.markSkipped(steps, 'images', 'generate_images=false');
        await this.persistSteps(runId, steps);
      } else {
        this.markRunning(steps, 'images');
        await this.persistSteps(runId, steps);
        try {
          const imageResult = await this.images.generateForArticle(
            { article_id: article.id },
            run.userId,
          );
          this.markSucceeded(steps, 'images', {
            details: {
              count: imageResult.images.length,
              cost_usd: imageResult.stats.cost_usd,
              featured_image_id: imageResult.featured_image_id,
            },
          });
        } catch (err) {
          // Don't fail the whole pipeline on a flaky image provider —
          // text content is the load-bearing artifact.
          this.markFailedSoft(steps, 'images', (err as Error).message);
          this.logger.warn(`pipeline ${runId} — image step failed soft: ${(err as Error).message}`);
        }
        await this.persistSteps(runId, steps);
      }

      // ---- Step 5: publish (skippable) ----
      if (!input.site_id) {
        this.markSkipped(steps, 'publish', 'site_id omitted');
        await this.persistSteps(runId, steps);
      } else {
        this.markRunning(steps, 'publish');
        await this.persistSteps(runId, steps);
        const publishJob = await this.publisher.enqueueOne(
          {
            article_id: article.id,
            site_id: input.site_id,
            status: input.publish_status ?? 'draft',
          },
          run.userId,
        );
        this.markSucceeded(steps, 'publish', {
          output_ref: publishJob.id,
          details: {
            // We enqueue, not synchronously publish — the BullMQ worker
            // continues in the background. UI links to /publisher for
            // job status.
            publish_job_status: publishJob.status,
            site_id: input.site_id,
          },
        });
        await this.prisma.pipelineRun.update({
          where: { id: runId },
          data: {
            publishJobId: publishJob.id,
            stepsJson: steps as unknown as object,
          },
        });
      }

      await this.prisma.pipelineRun.update({
        where: { id: runId },
        data: {
          status: 'succeeded',
          completedAt: new Date(),
          stepsJson: steps as unknown as object,
        },
      });
      await this.eventBus.emit('pipeline.completed', {
        run_id: runId,
        user_id: run.userId,
        article_id: article.id,
      });
    } catch (err) {
      const message = (err as Error).message;
      const failingStep = steps.find((s) => s.status === 'running');
      if (failingStep) {
        failingStep.status = 'failed';
        failingStep.finished_at = new Date().toISOString();
        failingStep.error_message = message;
      }
      await this.prisma.pipelineRun.update({
        where: { id: runId },
        data: {
          status: 'failed',
          errorMessage: message,
          completedAt: new Date(),
          stepsJson: steps as unknown as object,
        },
      });
      await this.eventBus.emit('pipeline.failed', {
        run_id: runId,
        user_id: run.userId,
        step: failingStep?.step ?? null,
        error: message,
      });
      this.logger.error(`pipeline ${runId} failed at step ${failingStep?.step}: ${message}`);
    }
  }

  // ----- helpers -----

  private initSteps(input: StartPipelineRunDto): PipelineStepResult[] {
    return STEP_ORDER.map((step) => {
      if (step === 'images' && input.generate_images === false) {
        return { step, status: 'skipped' };
      }
      if (step === 'publish' && !input.site_id) {
        return { step, status: 'skipped' };
      }
      return { step, status: 'pending' };
    });
  }

  private markRunning(steps: PipelineStepResult[], name: PipelineStepResult['step']): void {
    const step = steps.find((s) => s.step === name);
    if (!step) return;
    step.status = 'running';
    step.started_at = new Date().toISOString();
  }

  private markSucceeded(
    steps: PipelineStepResult[],
    name: PipelineStepResult['step'],
    extra: Partial<PipelineStepResult> = {},
  ): void {
    const step = steps.find((s) => s.step === name);
    if (!step) return;
    step.status = 'succeeded';
    step.finished_at = new Date().toISOString();
    Object.assign(step, extra);
  }

  private markSkipped(
    steps: PipelineStepResult[],
    name: PipelineStepResult['step'],
    reason: string,
  ): void {
    const step = steps.find((s) => s.step === name);
    if (!step) return;
    step.status = 'skipped';
    step.details = { reason };
  }

  private markFailedSoft(
    steps: PipelineStepResult[],
    name: PipelineStepResult['step'],
    message: string,
  ): void {
    const step = steps.find((s) => s.step === name);
    if (!step) return;
    step.status = 'failed';
    step.finished_at = new Date().toISOString();
    step.error_message = message;
    if (!step.details) step.details = {};
    step.details.soft_failure = true;
  }

  private async persistSteps(runId: string, steps: PipelineStepResult[]): Promise<void> {
    await this.prisma.pipelineRun.update({
      where: { id: runId },
      data: { stepsJson: steps as unknown as object },
    });
  }
}
