import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import { ErrorCode } from '@mkt-seo/shared';
import { PrismaService } from '../../../common/services/prisma.service';
import type { ListRunsQueryDto, StartPipelineRunDto } from '../dto/pipeline.dto';
import { PipelineQueue } from '../workers/pipeline.queue';
import type { PipelineStepResult } from './pipeline-runner.service';

const STEP_ORDER: PipelineStepResult['step'][] = [
  'outline',
  'article',
  'audit',
  'images',
  'publish',
];

export interface PipelineRunSummary {
  id: string;
  status: string;
  keyword: string;
  format: string;
  brand_voice_id: string | null;
  site_id: string | null;
  article_id: string | null;
  publish_job_id: string | null;
  steps: PipelineStepResult[];
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Sprint 15 — Section 3 pipeline orchestrator surface.
 *
 * The runner lives in PipelineRunnerService; this service owns the run
 * lifecycle: create row → enqueue → list/get → cancel. Multi-tenant
 * (Section 2 principle 5): every read filters by userId.
 */
@Injectable()
export class PipelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: PipelineQueue,
  ) {}

  async start(userId: string, dto: StartPipelineRunDto): Promise<PipelineRunSummary> {
    if (dto.site_id && !dto.generate_images && dto.generate_images !== false) {
      // Default to images-on when publishing; otherwise the WP post lacks a featured image.
      dto.generate_images = true;
    }
    const id = uuidv7();
    const initialSteps: PipelineStepResult[] = STEP_ORDER.map((step) => {
      if (step === 'images' && dto.generate_images === false) {
        return { step, status: 'skipped', details: { reason: 'generate_images=false' } };
      }
      if (step === 'publish' && !dto.site_id) {
        return { step, status: 'skipped', details: { reason: 'site_id omitted' } };
      }
      return { step, status: 'pending' };
    });
    await this.prisma.pipelineRun.create({
      data: {
        id,
        userId,
        status: 'pending',
        inputJson: dto as unknown as object,
        stepsJson: initialSteps as unknown as object,
      },
    });
    await this.queue.enqueue({ run_id: id, user_id: userId });
    return this.get(userId, id);
  }

  async list(
    userId: string,
    query: ListRunsQueryDto,
  ): Promise<{ items: PipelineRunSummary[]; cursor: string | null; has_more: boolean }> {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const decoded = query.cursor ? this.decodeCursor(query.cursor) : null;

    const where: {
      userId: string;
      status?: string;
      createdAt?: { lt: Date };
    } = { userId };
    if (query.status) where.status = query.status;
    if (decoded) where.createdAt = { lt: decoded.createdAt };

    const rows = await this.prisma.pipelineRun.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page.at(-1);
    return {
      items: page.map((r) => this.toSummary(r)),
      cursor: hasMore && last ? this.encodeCursor(last.createdAt) : null,
      has_more: hasMore,
    };
  }

  async get(userId: string, id: string): Promise<PipelineRunSummary> {
    const row = await this.prisma.pipelineRun.findFirst({ where: { id, userId } });
    if (!row) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Không tìm thấy pipeline run',
      });
    }
    return this.toSummary(row);
  }

  async cancel(userId: string, id: string): Promise<PipelineRunSummary> {
    const row = await this.prisma.pipelineRun.findFirst({ where: { id, userId } });
    if (!row) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Không tìm thấy pipeline run',
      });
    }
    if (row.status === 'succeeded' || row.status === 'failed' || row.status === 'cancelled') {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: `Pipeline run đã ở trạng thái ${row.status}, không huỷ được.`,
      });
    }
    // Try to yank the job out of BullMQ. If the worker has already picked it up,
    // the runner re-reads status='cancelled' before persisting the next step
    // and short-circuits cleanly (worst case: one step finishes before we abort).
    await this.queue.cancel(id);
    await this.prisma.pipelineRun.update({
      where: { id },
      data: { status: 'cancelled', completedAt: new Date() },
    });
    return this.get(userId, id);
  }

  // ----- helpers -----

  private toSummary(row: {
    id: string;
    status: string;
    inputJson: unknown;
    stepsJson: unknown;
    articleId: string | null;
    publishJobId: string | null;
    errorMessage: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): PipelineRunSummary {
    const input = (row.inputJson as Partial<StartPipelineRunDto>) ?? {};
    const steps = Array.isArray(row.stepsJson) ? (row.stepsJson as PipelineStepResult[]) : [];
    return {
      id: row.id,
      status: row.status,
      keyword: input.keyword ?? '',
      format: input.format ?? 'blog',
      brand_voice_id: input.brand_voice_id ?? null,
      site_id: input.site_id ?? null,
      article_id: row.articleId,
      publish_job_id: row.publishJobId,
      steps,
      error_message: row.errorMessage,
      started_at: row.startedAt ? row.startedAt.toISOString() : null,
      completed_at: row.completedAt ? row.completedAt.toISOString() : null,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    };
  }

  private encodeCursor(createdAt: Date): string {
    return Buffer.from(createdAt.toISOString()).toString('base64url');
  }

  private decodeCursor(cursor: string): { createdAt: Date } | null {
    try {
      const d = new Date(Buffer.from(cursor, 'base64url').toString('utf8'));
      return Number.isNaN(d.getTime()) ? null : { createdAt: d };
    } catch {
      return null;
    }
  }
}
