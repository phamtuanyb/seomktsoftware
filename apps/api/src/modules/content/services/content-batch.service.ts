import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import { ErrorCode } from '@mkt-seo/shared';
import { PrismaService } from '../../../common/services/prisma.service';
import {
  CreateContentBatchJobDto,
  ListContentBatchJobsQueryDto,
} from '../dto/content-batch.dto';
import { ContentBatchQueue } from '../workers/content-batch.queue';

export interface ContentBatchJobItemSummary {
  id: string;
  order_index: number;
  keyword: string;
  status: string;
  article_id: string | null;
  error_message: string | null;
  generated_outline_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ContentBatchJobSummary {
  id: string;
  mode: string;
  status: string;
  config: Record<string, unknown>;
  total_items: number;
  completed_items: number;
  failed_items: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  items: ContentBatchJobItemSummary[];
}

@Injectable()
export class ContentBatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: ContentBatchQueue,
  ) {}

  async create(userId: string, dto: CreateContentBatchJobDto): Promise<ContentBatchJobSummary> {
    const keywords = Array.from(
      new Set(
        dto.keywords_text
          .split(/\r?\n/)
          .map((keyword) => keyword.trim())
          .filter(Boolean),
      ),
    );

    if (keywords.length === 0) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Can it nhat 1 keyword hop le.',
      });
    }
    if (keywords.length > 50) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Moi batch toi da 50 keyword.',
      });
    }

    const id = uuidv7();
    const config = {
      format: dto.format ?? 'blog',
      target_word_count: dto.target_word_count ?? 2000,
      language: dto.language ?? 'vi',
      brand_voice_id: dto.brand_voice_id ?? null,
    };

    await this.prisma.contentBatchJob.create({
      data: {
        id,
        userId,
        mode: 'keyword_list',
        status: 'pending',
        configJson: config,
        items: {
          create: keywords.map((keyword, index) => ({
            id: uuidv7(),
            orderIndex: index,
            keyword,
          })),
        },
      },
    });

    await this.queue.enqueue({ batch_job_id: id, user_id: userId });
    return this.get(userId, id);
  }

  async list(
    userId: string,
    query: ListContentBatchJobsQueryDto,
  ): Promise<{ items: ContentBatchJobSummary[]; cursor: string | null; has_more: boolean }> {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 50);
    const decoded = query.cursor ? this.decodeCursor(query.cursor) : null;

    const rows = await this.prisma.contentBatchJob.findMany({
      where: {
        userId,
        ...(query.status ? { status: query.status } : {}),
        ...(decoded ? { createdAt: { lt: decoded.createdAt } } : {}),
      },
      include: {
        items: {
          orderBy: { orderIndex: 'asc' },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page.at(-1);

    return {
      items: page.map((row) => this.toSummary(row)),
      cursor: hasMore && last ? this.encodeCursor(last.createdAt) : null,
      has_more: hasMore,
    };
  }

  async get(userId: string, id: string): Promise<ContentBatchJobSummary> {
    const row = await this.prisma.contentBatchJob.findFirst({
      where: { id, userId },
      include: { items: { orderBy: { orderIndex: 'asc' } } },
    });
    if (!row) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Khong tim thay content batch job',
      });
    }
    return this.toSummary(row);
  }

  async cancel(userId: string, id: string): Promise<ContentBatchJobSummary> {
    const row = await this.prisma.contentBatchJob.findFirst({ where: { id, userId } });
    if (!row) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Khong tim thay content batch job',
      });
    }
    if (['succeeded', 'failed', 'partial', 'cancelled'].includes(row.status)) {
      return this.get(userId, id);
    }

    await this.queue.cancel(id);
    await this.prisma.$transaction([
      this.prisma.contentBatchJob.update({
        where: { id },
        data: { status: 'cancelled', completedAt: new Date() },
      }),
      this.prisma.contentBatchJobItem.updateMany({
        where: { batchJobId: id, status: 'pending' },
        data: { status: 'cancelled', completedAt: new Date() },
      }),
    ]);

    return this.get(userId, id);
  }

  private toSummary(row: {
    id: string;
    mode: string;
    status: string;
    configJson: unknown;
    errorMessage: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    items: Array<{
      id: string;
      orderIndex: number;
      keyword: string;
      status: string;
      articleId: string | null;
      errorMessage: string | null;
      generatedOutlineJson: unknown;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }): ContentBatchJobSummary {
    const completedItems = row.items.filter((item) => item.status === 'done').length;
    const failedItems = row.items.filter((item) => item.status === 'failed').length;

    return {
      id: row.id,
      mode: row.mode,
      status: row.status,
      config: (row.configJson as Record<string, unknown>) ?? {},
      total_items: row.items.length,
      completed_items: completedItems,
      failed_items: failedItems,
      error_message: row.errorMessage,
      started_at: row.startedAt ? row.startedAt.toISOString() : null,
      completed_at: row.completedAt ? row.completedAt.toISOString() : null,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
      items: row.items.map((item) => ({
        id: item.id,
        order_index: item.orderIndex,
        keyword: item.keyword,
        status: item.status,
        article_id: item.articleId,
        error_message: item.errorMessage,
        generated_outline_json: (item.generatedOutlineJson as Record<string, unknown> | null) ?? null,
        created_at: item.createdAt.toISOString(),
        updated_at: item.updatedAt.toISOString(),
      })),
    };
  }

  private encodeCursor(createdAt: Date): string {
    return Buffer.from(createdAt.toISOString()).toString('base64url');
  }

  private decodeCursor(cursor: string): { createdAt: Date } | null {
    try {
      const createdAt = new Date(Buffer.from(cursor, 'base64url').toString('utf8'));
      return Number.isNaN(createdAt.getTime()) ? null : { createdAt };
    } catch {
      return null;
    }
  }
}
