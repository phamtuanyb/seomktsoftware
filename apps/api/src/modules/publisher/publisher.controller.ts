import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SitesService } from './services/sites.service';
import { PublisherService } from './services/publisher.service';
import { BulkPublishDto, CreateSiteDto, PublishWordpressDto, UpdateSiteDto } from './dto';

/** Section 8 TN8 — sites CRUD + publish + bulk + jobs. */
@ApiTags('Publisher')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'publisher', version: '1' })
export class PublisherController {
  constructor(
    private readonly sites: SitesService,
    private readonly publisher: PublisherService,
  ) {}

  // ----- Sites CRUD -----

  @Get('sites')
  listSites(@CurrentUser('id') userId: string) {
    return this.sites.list(userId);
  }

  @Post('sites')
  @ApiOperation({
    summary: 'TN8 — Connect site (encrypt creds AES-256-GCM, probe + SEO plugin detect).',
  })
  createSite(@Body() dto: CreateSiteDto, @CurrentUser('id') userId: string) {
    return this.sites.create(userId, dto);
  }

  @Get('sites/:id')
  getSite(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.sites.get(userId, id);
  }

  @Patch('sites/:id')
  updateSite(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSiteDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.sites.update(userId, id, dto);
  }

  @Delete('sites/:id')
  @HttpCode(HttpStatus.OK)
  deleteSite(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.sites.remove(userId, id);
  }

  @Post('sites/:id/test')
  @ApiOperation({
    summary: 'Probe connection + refresh SEO plugin detection (yoast/rankmath/seopress).',
  })
  testSite(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.sites.test(userId, id);
  }

  // ----- Publish -----

  @Post('wordpress')
  @ApiOperation({
    summary:
      'TN8 — Publish article to WordPress (or schedule with status="future" + scheduled_at). BullMQ-backed with retry 3× exponential backoff.',
  })
  publishOne(@Body() dto: PublishWordpressDto, @CurrentUser('id') userId: string) {
    return this.publisher.enqueueOne(dto, userId);
  }

  @Post('bulk')
  @ApiOperation({
    summary:
      'TN8 — Bulk publish (rate-limited 10 bài/site/giờ, random delay 2-15s giữa các lần publish trên cùng site).',
  })
  bulkPublish(@Body() dto: BulkPublishDto, @CurrentUser('id') userId: string) {
    return this.publisher.enqueueBulk(dto, userId);
  }

  // ----- Jobs -----

  @Get('jobs')
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'site_id', required: false })
  listJobs(
    @CurrentUser('id') userId: string,
    @Query('status') status?: string,
    @Query('site_id') siteId?: string,
  ) {
    return this.publisher.list(userId, { status, site_id: siteId });
  }

  @Get('jobs/:id')
  getJob(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.publisher.get(userId, id);
  }

  @Delete('jobs/:id')
  @HttpCode(HttpStatus.OK)
  cancelJob(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.publisher.cancel(userId, id);
  }
}
