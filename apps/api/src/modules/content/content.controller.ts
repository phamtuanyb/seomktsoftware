import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
import { ListArticlesQueryDto, UpdateArticleDto } from './dto/update-article.dto';
import { RegenerateSectionDto, RewriteDto } from './dto/rewrite-article.dto';
import { OutlineService } from './services/outline.service';
import { ArticleService } from './services/article.service';
import { ArticleEditorService } from './services/article-editor.service';
import type { OutlineWithMetadata } from './schemas/outline.schema';

/** Section 8 — TN3 outline (live) + TN4 article writer (live with SSE). */
@ApiTags('Content')
@ApiBearerAuth()
@Controller({ path: 'content', version: '1' })
export class ContentController {
  constructor(
    private readonly outlines: OutlineService,
    private readonly articles: ArticleService,
    private readonly editor: ArticleEditorService,
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
  @ApiOperation({
    summary: 'List articles (cursor pagination per Section 6 — cursor + limit, has_more)',
  })
  listArticles(@CurrentUser('id') userId: string, @Query() query: ListArticlesQueryDto) {
    return this.articles.list(userId, query);
  }

  @Get('articles/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Article detail (markdown + HTML + score breakdown).' })
  getArticle(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.articles.get(userId, id);
  }

  @Patch('articles/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Editor save — partial update. Setting content_markdown re-renders HTML + recomputes word_count.',
  })
  updateArticle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateArticleDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.articles.update(userId, id, dto);
  }

  @Delete('articles/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete article (status → deleted, deleted_at set).' })
  deleteArticle(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.articles.remove(userId, id);
  }

  // ----- Sprint 6.5 editor enhancements -----

  @Post('articles/:id/regenerate-section')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'TN4 — regenerate one ## H2 section in place. Keeps the heading, replaces the body via Claude.',
  })
  regenerateSection(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegenerateSectionDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.editor.regenerateSection(userId, id, dto);
  }

  @Post('articles/:id/rewrite')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'TN4 — rewrite selection or whole article. Actions: shorter, longer, tone, details, free.',
  })
  rewrite(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RewriteDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.editor.rewrite(userId, id, dto);
  }

  @Get('articles/:id/export')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Download article as md / html / docx (Word-compatible).' })
  async exportArticle(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Query('format') formatRaw: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const format = (formatRaw ?? 'md').toLowerCase();
    if (format !== 'md' && format !== 'html' && format !== 'docx') {
      res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'format phải là md / html / docx' },
      });
      return;
    }
    const out = await this.editor.export(userId, id, format);
    res.setHeader('Content-Type', out.mime);
    res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
    res.send(out.body);
  }
}
