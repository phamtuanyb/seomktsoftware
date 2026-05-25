import { Body, Controller, NotImplementedException, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

/** Section 8 — TN7 Content Score (12 rules via Chain of Responsibility). Sprint 5. */
@ApiTags('Audit')
@ApiBearerAuth()
@Controller({ path: 'audit', version: '1' })
export class AuditController {
  @Post('score')
  @ApiOperation({ summary: 'TN7 — Compute 0-100 SEO content score' })
  score(@Body() _body: unknown): never {
    throw new NotImplementedException('Pending Sprint 5 — TN7');
  }

  @Post('auto-fix')
  @ApiOperation({ summary: 'TN7 — Auto-fix rules scoring < 80 via AI' })
  autoFix(@Body() _body: unknown): never {
    throw new NotImplementedException('Pending Sprint 5 — TN7');
  }
}
