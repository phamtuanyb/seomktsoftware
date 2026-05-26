import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { QuotaGuard } from '../../common/guards/quota.guard';
import { RequireQuota } from '../../common/decorators/require-quota.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { QuotaService } from '../../common/services/quota.service';
import { GenerateForArticleDto, GenerateImageDto } from './dto/generate-image.dto';
import { ImagesService } from './services/images.service';

/** Section 8 — TN6 AI image generation. */
@ApiTags('Images')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'images', version: '1' })
export class ImagesController {
  constructor(
    private readonly images: ImagesService,
    private readonly quotas: QuotaService,
  ) {}

  @Post('generate')
  @UseGuards(QuotaGuard)
  @RequireQuota('images', 1)
  @ApiOperation({
    summary:
      'TN6 — Generate image (Flux Schnell default, DALL-E 3 premium). Consumes 1 quota per returned image.',
  })
  async generate(@Body() dto: GenerateImageDto, @CurrentUser('id') userId: string) {
    const result = await this.images.generate(dto, userId);
    await this.quotas.consumeQuota(userId, 'images', result.images.length);
    return result;
  }

  @Post('generate-for-article')
  @UseGuards(QuotaGuard)
  @RequireQuota('images', 1)
  @ApiOperation({
    summary:
      'TN6 — Bulk generate (featured + 1 per H2). Sets article.featured_image_id automatically.',
  })
  async generateForArticle(@Body() dto: GenerateForArticleDto, @CurrentUser('id') userId: string) {
    const result = await this.images.generateForArticle(dto, userId);
    if (result.images.length > 0) {
      await this.quotas.consumeQuota(userId, 'images', result.images.length);
    }
    return result;
  }

  @Get()
  @ApiQuery({ name: 'article_id', required: false })
  @ApiOperation({ summary: 'List my images (optional filter by article_id).' })
  list(@CurrentUser('id') userId: string, @Query('article_id') articleId?: string) {
    return this.images.list(userId, articleId);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.images.get(userId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.images.remove(userId, id);
  }
}
