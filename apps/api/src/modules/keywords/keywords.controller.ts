import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotImplementedException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { QuotaService } from '../../common/services/quota.service';
import { AddKeywordsDto, CreateProjectDto, SuggestKeywordsDto, UpdateProjectDto } from './dto';
import { SuggestionService } from './services/suggestion.service';
import { KeywordProjectsService } from './services/projects.service';
import { KeywordExportService, type ExportFormat } from './services/export.service';

/**
 * Section 8 — TN1 (suggest), TN2 (analyze, pending Sprint 6.4) +
 * projects CRUD + export. All endpoints behind JwtAuthGuard.
 */
@ApiTags('Keywords')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'keywords', version: '1' })
export class KeywordsController {
  constructor(
    private readonly suggestions: SuggestionService,
    private readonly projects: KeywordProjectsService,
    private readonly exporter: KeywordExportService,
    private readonly quotas: QuotaService,
  ) {}

  // ---- TN1 ----

  @Post('suggest')
  @ApiOperation({
    summary:
      'TN1 — Suggest keywords from a seed across Google/Bing/PAA (7-day cache). Consumes 1 quota per returned keyword.',
  })
  async suggest(@Body() dto: SuggestKeywordsDto, @CurrentUser('id') userId: string) {
    const limit = dto.limit ?? 500;
    const quotaCheck = await this.quotas.checkQuota(userId, 'keywords', limit);
    if (!quotaCheck.allowed) {
      // Section 11 — surface a quota error.
      throw new (await import('@nestjs/common')).ForbiddenException({
        code: 'QUOTA_EXCEEDED',
        message: `Bạn còn ${quotaCheck.remaining} keyword quota — yêu cầu ${limit}.`,
        details: quotaCheck,
      });
    }
    const result = await this.suggestions.suggest(dto);
    // Only the returned (deduped) count counts against quota.
    if (!result.stats.cached) {
      await this.quotas.consumeQuota(userId, 'keywords', result.stats.total_returned);
    }
    return result;
  }

  // ---- TN2 placeholder ----

  @Post('analyze')
  @ApiOperation({ summary: 'TN2 — Volume + KD + Intent batch analysis (Sprint 6.4)' })
  analyze(): never {
    throw new NotImplementedException('Pending Sprint 6.4 — TN2');
  }

  // ---- Projects CRUD ----

  @Get('projects')
  listProjects(@CurrentUser('id') userId: string) {
    return this.projects.list(userId);
  }

  @Post('projects')
  createProject(@Body() dto: CreateProjectDto, @CurrentUser('id') userId: string) {
    return this.projects.create(userId, dto);
  }

  @Get('projects/:id')
  getProject(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.projects.get(userId, id);
  }

  @Patch('projects/:id')
  updateProject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.projects.update(userId, id, dto);
  }

  @Delete('projects/:id')
  @HttpCode(HttpStatus.OK)
  deleteProject(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.projects.remove(userId, id);
  }

  // ---- Project keywords ----

  @Post('projects/:id/keywords')
  @ApiOperation({ summary: 'Attach keywords to a project (dedupe against existing)' })
  addKeywords(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddKeywordsDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.projects.addKeywords(userId, id, dto);
  }

  @Get('projects/:id/keywords')
  listProjectKeywords(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.projects.listKeywords(userId, id);
  }

  @Delete('projects/:id/keywords/:kid')
  @HttpCode(HttpStatus.OK)
  removeProjectKeyword(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('kid', ParseUUIDPipe) kid: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.projects.removeKeyword(userId, id, kid);
  }

  // ---- Export ----

  @Get('projects/:id/export')
  @ApiOperation({ summary: 'Download keywords as CSV (default) or Excel' })
  @ApiQuery({ name: 'format', required: false, enum: ['csv', 'excel'] })
  async exportProject(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('format') format: string | undefined,
    @CurrentUser('id') userId: string,
    @Res() res: Response,
  ): Promise<void> {
    const fmt: ExportFormat = format === 'excel' ? 'excel' : 'csv';
    const project = await this.projects.get(userId, id);
    const rows = await this.projects.listKeywords(userId, id);
    const payload = await this.exporter.export(project.name, rows, fmt);
    res.setHeader('Content-Type', payload.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${payload.filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(payload.buffer);
  }
}
