import {
  Body,
  Controller,
  Delete,
  Get,
  NotImplementedException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

/** Section 8 — TN8 WordPress publisher (Adapter pattern, Shopify Phase 2). Sprint 6. */
@ApiTags('Publisher')
@ApiBearerAuth()
@Controller({ path: 'publisher', version: '1' })
export class PublisherController {
  @Get('sites')
  listSites(): never {
    throw new NotImplementedException('Pending Sprint 6 — TN8');
  }

  @Post('sites')
  @ApiOperation({ summary: 'TN8 — Connect site (encrypt creds AES-256-GCM)' })
  connectSite(@Body() _body: unknown): never {
    throw new NotImplementedException('Pending Sprint 6 — TN8');
  }

  @Get('sites/:id')
  getSite(@Param('id') _id: string): never {
    throw new NotImplementedException('Pending Sprint 6');
  }

  @Patch('sites/:id')
  updateSite(@Param('id') _id: string): never {
    throw new NotImplementedException('Pending Sprint 6');
  }

  @Delete('sites/:id')
  deleteSite(@Param('id') _id: string): never {
    throw new NotImplementedException('Pending Sprint 6');
  }

  @Post('sites/:id/test')
  @ApiOperation({ summary: 'Smoke-test the connected site' })
  testSite(@Param('id') _id: string): never {
    throw new NotImplementedException('Pending Sprint 6');
  }

  @Post('wordpress')
  @ApiOperation({ summary: 'TN8 — Publish article to WordPress' })
  publishWordpress(@Body() _body: unknown): never {
    throw new NotImplementedException('Pending Sprint 6 — TN8');
  }

  @Post('bulk')
  @ApiOperation({ summary: 'TN8 — Bulk publish (rate-limited 10/site/hour)' })
  bulkPublish(@Body() _body: unknown): never {
    throw new NotImplementedException('Pending Sprint 6 — TN8');
  }
}
