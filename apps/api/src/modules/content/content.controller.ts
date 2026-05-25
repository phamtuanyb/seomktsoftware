import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  NotImplementedException,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireQuota } from '../../common/decorators/require-quota.decorator';
import { QuotaGuard } from '../../common/guards/quota.guard';
import { QuotaService } from '../../common/services/quota.service';
import { GenerateOutlineDto } from './dto/generate-outline.dto';
import { GenerateArticleDto } from './dto/generate-article.dto';
import { OutlineService } from './services/outline.service';
import { ArticleService } from './services/article.service';
import type { OutlineWithMetadata } from './schemas/outline.schema';
import type { ArticleResult } from './services/article.service';

/** Section 8 — TN3 outline (live) + TN4 article writer (live with SSE). */
@ApiTags('Content')
@ApiBearerAuth()
@Controller({ path: 'content', version: '1' })
export class ContentController {
  constructor(
    private readonly outlines: OutlineService,
    private readonly articles: ArticleService,
    private readonly quotas: QuotaService,
  ) {}

  @Post('outline')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'TN3 — AI outline from keyword + SERP analysis (24h SERP cache + 30d outline cache)',
  })
  @ApiBody({ type: GenerateOutlineDto })
  @ApiOkResponse({
    description: 'JSON outline with h1, sections[h2,subsections[h3,bullets]], metadata',
  })
  generateOutline(
    @Body() dto: GenerateOutlineDto,
    @CurrentUser('id') _userId: string,
  ): Promise<OutlineWithMetadata> {
    return this.outlines.generate(dto);
  }

  @Post('article')
  @UseGuards(JwtAuthGuard, QuotaGuard)
  @RequireQuota('articles', 1)
  @ApiOperation({
    summary:
      'TN4 — Write full article. Streams SSE when Accept: text/event-stream, else returns JSON. Consumes 1 article quota.',
  })
  @ApiBody({ type: GenerateArticleDto })
  async generateArticle(
    @Body() dto: GenerateArticleDto,
    @CurrentUser('id') userId: string,
    @Req() req: Request,
    @Res() res: Response,
    @Headers('accept') acceptHeader?: string,
  ): Promise<void> {
    const wantsSSE = (acceptHeader ?? req.headers.accept ?? '')
      .toString()
      .includes('text/event-stream');

    if (wantsSSE) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      let completed = false;
      try {
        for await (const event of this.articles.generateStream(dto, userId)) {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
          if (event.type === 'complete') {
            completed = true;
            await this.quotas.consumeQuota(userId, 'articles', 1);
          }
        }
      } catch (err) {
        res.write(
          `data: ${JSON.stringify({
            type: 'error',
            code: 'INTERNAL_ERROR',
            message: (err as Error).message,
          })}\n\n`,
        );
      } finally {
        if (!completed) {
          res.write(
            `data: ${JSON.stringify({
              type: 'error',
              code: 'INTERNAL_ERROR',
              message: 'Stream ended without complete',
            })}\n\n`,
          );
        }
        res.end();
      }
      return;
    }

    const article = await this.articles.generate(dto, userId);
    await this.quotas.consumeQuota(userId, 'articles', 1);
    res.json({ success: true, data: article });
  }

  @Get('articles')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List articles (cursor pagination per Section 6)' })
  async listArticles(@CurrentUser('id') userId: string): Promise<ArticleResult[]> {
    // Sprint 5.7 / Sprint 6 brings cursor pagination + filters. MVP: most-recent 50.
    const rows = await this.articles['prisma'].article.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((r) =>
      this.articles['toResult'](r as Parameters<ArticleService['toResult']>[0], false),
    );
  }

  @Get('articles/:id')
  @UseGuards(JwtAuthGuard)
  async getArticle(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<ArticleResult> {
    const row = await this.articles['prisma'].article.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!row) {
      throw new NotImplementedException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Không tìm thấy bài viết',
      });
    }
    return this.articles['toResult'](row as Parameters<ArticleService['toResult']>[0], false);
  }

  @Patch('articles/:id')
  @UseGuards(JwtAuthGuard)
  updateArticle(@Param('id') _id: string): never {
    throw new NotImplementedException('Editor save endpoint pending Sprint 5.7');
  }

  @Delete('articles/:id')
  @UseGuards(JwtAuthGuard)
  deleteArticle(@Param('id') _id: string): never {
    throw new NotImplementedException('Delete endpoint pending Sprint 5.7');
  }
}
