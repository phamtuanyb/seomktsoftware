import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireQuota } from '../../common/decorators/require-quota.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { QuotaGuard } from '../../common/guards/quota.guard';
import { QuotaService } from '../../common/services/quota.service';
import { ListRunsQueryDto, StartPipelineRunDto } from './dto/pipeline.dto';
import { PipelineService } from './services/pipeline.service';

/**
 * Sprint 15 — Section 3 end-to-end pipeline orchestrator.
 *
 * Charges 1 article quota up-front (the chain always produces an article).
 * Image/publish steps consume their own resources only if they actually
 * run — those services apply their own quota checks at execution time.
 */
@ApiTags('Pipeline')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'pipeline', version: '1' })
export class PipelineController {
  constructor(
    private readonly pipeline: PipelineService,
    private readonly quotas: QuotaService,
  ) {}

  @Post('runs')
  @UseGuards(QuotaGuard)
  @RequireQuota('articles', 1)
  @ApiOperation({
    summary:
      'Start an end-to-end pipeline run: outline → article → audit → images → publish. Async — poll GET /pipeline/runs/:id for progress.',
  })
  async start(@Body() dto: StartPipelineRunDto, @CurrentUser('id') userId: string) {
    const run = await this.pipeline.start(userId, dto);
    await this.quotas.consumeQuota(userId, 'articles', 1);
    return run;
  }

  @Get('runs')
  @ApiOperation({ summary: 'List my pipeline runs (cursor pagination, status filter).' })
  list(@CurrentUser('id') userId: string, @Query() query: ListRunsQueryDto) {
    return this.pipeline.list(userId, query);
  }

  @Get('runs/:id')
  @ApiOperation({ summary: 'Pipeline run detail — per-step status + output refs.' })
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.pipeline.get(userId, id);
  }

  @Post('runs/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Cancel a running pipeline. Best-effort: an in-flight step may finish before the worker checks status.',
  })
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.pipeline.cancel(userId, id);
  }
}
