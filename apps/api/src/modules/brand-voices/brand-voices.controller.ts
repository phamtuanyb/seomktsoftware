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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireQuota } from '../../common/decorators/require-quota.decorator';
import { QuotaGuard } from '../../common/guards/quota.guard';
import { QuotaService } from '../../common/services/quota.service';
import { BrandVoicesService } from './brand-voices.service';
import { CreateBrandVoiceDto, UpdateBrandVoiceDto } from './dto/create-brand-voice.dto';

/** Section 8 TN5 — Brand Voice CRUD. Training algorithm lands in Sprint 7+. */
@ApiTags('Brand Voices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'brand-voices', version: '1' })
export class BrandVoicesController {
  constructor(
    private readonly brandVoices: BrandVoicesService,
    private readonly quotas: QuotaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List my brand voices' })
  list(@CurrentUser('id') userId: string) {
    return this.brandVoices.list(userId);
  }

  @Post()
  @UseGuards(QuotaGuard)
  @RequireQuota('brand_voices', 1)
  @ApiOperation({
    summary: 'Create brand voice from 3-20 sample articles. Consumes 1 brand_voices quota.',
  })
  async create(@Body() dto: CreateBrandVoiceDto, @CurrentUser('id') userId: string) {
    const created = await this.brandVoices.create(userId, dto);
    await this.quotas.consumeQuota(userId, 'brand_voices', 1);
    return created;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get brand voice detail (profile + reference articles)' })
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.brandVoices.get(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update name/description/default flag/profile' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBrandVoiceDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.brandVoices.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete brand voice' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.brandVoices.remove(userId, id);
  }

  @Post(':id/train')
  @ApiOperation({ summary: 'Re-run training (placeholder — full algorithm lands Sprint 7+)' })
  retrain(@Param('id', ParseUUIDPipe) _id: string): never {
    throw new NotImplementedException(
      'Full training algorithm pending Sprint 7. For now use POST /brand-voices with profile_json.',
    );
  }
}
