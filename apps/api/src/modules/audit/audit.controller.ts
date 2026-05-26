import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from './services/audit.service';
import { AutoFixService } from './services/auto-fix.service';
import { AutoFixDto, ScoreContentDto } from './dto/score.dto';

/** Section 8 — TN7 Content Score (12 rules via Chain of Responsibility). */
@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'audit', version: '1' })
export class AuditController {
  constructor(
    private readonly audits: AuditService,
    private readonly fixer: AutoFixService,
  ) {}

  @Post('score')
  @ApiOperation({
    summary:
      'TN7 — Compute 0-100 SEO content score across 12 rules. Accepts article_id OR inline (title + content). Persists back to article row when article_id supplied.',
  })
  score(@Body() dto: ScoreContentDto, @CurrentUser('id') userId: string) {
    return this.audits.score(dto, userId);
  }

  @Post('auto-fix')
  @ApiOperation({
    summary:
      'TN7 — Auto-fix rules scoring <80 via Claude. Rewrites article markdown targeted at the failing rules; only persists when post-rewrite score improves.',
  })
  autoFix(@Body() dto: AutoFixDto, @CurrentUser('id') userId: string) {
    return this.fixer.fix(dto, userId);
  }
}
