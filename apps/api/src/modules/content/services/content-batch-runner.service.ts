import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/services/prisma.service';
import { OutlineService } from './outline.service';
import { ArticleService } from './article.service';
import { QuotaService } from '../../../common/services/quota.service';
import { type OutlineFormat } from '../dto/generate-outline.dto';

@Injectable()
export class ContentBatchRunnerService {
  private readonly logger = new Logger(ContentBatchRunnerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outlines: OutlineService,
    private readonly articles: ArticleService,
    private readonly quotas: QuotaService,
  ) {}

  async run(batchJobId: string): Promise<void> {
    const batch = await this.prisma.contentBatchJob.findUnique({
      where: { id: batchJobId },
      include: { items: { orderBy: { orderIndex: 'asc' } } },
    });
    if (!batch || batch.status === 'cancelled') return;

    const config = (batch.configJson as {
      format?: OutlineFormat;
      target_word_count?: number;
      language?: string;
      brand_voice_id?: string | null;
    }) ?? { format: 'blog', target_word_count: 2000, language: 'vi' };

    await this.prisma.contentBatchJob.update({
      where: { id: batchJobId },
      data: { status: 'running', startedAt: batch.startedAt ?? new Date(), errorMessage: null },
    });

    let completed = 0;
    let failed = 0;
    let halted = false;

    for (const item of batch.items) {
      const freshJob = await this.prisma.contentBatchJob.findUnique({ where: { id: batchJobId } });
      if (!freshJob || freshJob.status === 'cancelled') {
        halted = true;
        break;
      }

      const quota = await this.quotas.checkQuota(batch.userId, 'articles', 1);
      if (!quota.allowed) {
        await this.prisma.contentBatchJobItem.updateMany({
          where: { batchJobId, status: 'pending' },
          data: {
            status: 'failed',
            errorMessage: `Het quota articles (${quota.used}/${quota.limit}).`,
            completedAt: new Date(),
          },
        });
        failed += batch.items.filter((row) => row.status === 'pending').length;
        halted = true;
        break;
      }

      try {
        await this.prisma.contentBatchJobItem.update({
          where: { id: item.id },
          data: {
            status: 'generating_outline',
            startedAt: item.startedAt ?? new Date(),
            errorMessage: null,
          },
        });

        const outline = await this.outlines.generate({
          keyword: item.keyword,
          format: config.format ?? 'blog',
          target_word_count: config.target_word_count ?? 2000,
          language: config.language ?? 'vi',
        });

        await this.prisma.contentBatchJobItem.update({
          where: { id: item.id },
          data: {
            status: 'writing_article',
            generatedOutlineJson: outline as unknown as object,
          },
        });

        const article = await this.articles.generate(
          {
            keyword: item.keyword,
            outline: {
              meta_title: outline.meta_title,
              meta_description: outline.meta_description,
              h1: outline.h1,
              sections: outline.sections,
            },
            brand_voice_id: config.brand_voice_id ?? undefined,
            format: config.format ?? 'blog',
            target_word_count: config.target_word_count ?? 2000,
            language: config.language ?? 'vi',
          },
          batch.userId,
        );

        await this.quotas.consumeQuota(batch.userId, 'articles', 1);

        await this.prisma.contentBatchJobItem.update({
          where: { id: item.id },
          data: {
            status: 'done',
            articleId: article.id,
            completedAt: new Date(),
          },
        });
        completed += 1;
      } catch (err) {
        failed += 1;
        this.logger.warn(`content batch item ${item.id} failed: ${(err as Error).message}`);
        await this.prisma.contentBatchJobItem.update({
          where: { id: item.id },
          data: {
            status: 'failed',
            errorMessage: (err as Error).message,
            completedAt: new Date(),
          },
        });
      }
    }

    const finalStatus =
      halted && completed === 0 && failed > 0
        ? 'failed'
        : failed > 0 && completed > 0
          ? 'partial'
          : failed > 0
            ? 'failed'
            : halted
              ? 'cancelled'
              : 'succeeded';

    await this.prisma.contentBatchJob.update({
      where: { id: batchJobId },
      data: {
        status: finalStatus,
        completedAt: new Date(),
        errorMessage: finalStatus === 'failed' ? 'Mot hoac nhieu item that bai.' : null,
      },
    });
  }
}
