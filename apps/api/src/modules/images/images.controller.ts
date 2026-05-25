import { Body, Controller, Get, NotImplementedException, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

/** Section 8 — TN6 AI image generation. Implemented in Sprint 5. */
@ApiTags('Images')
@ApiBearerAuth()
@Controller({ path: 'images', version: '1' })
export class ImagesController {
  @Post('generate')
  @ApiOperation({ summary: 'TN6 — Generate image (Flux Schnell default, DALL-E 3 premium)' })
  generate(@Body() _body: unknown): never {
    throw new NotImplementedException('Pending Sprint 5 — TN6');
  }

  @Post('generate-for-article')
  @ApiOperation({ summary: 'TN6 — Bulk generate images for an article (featured + in-content)' })
  generateForArticle(@Body() _body: unknown): never {
    throw new NotImplementedException('Pending Sprint 5 — TN6');
  }

  @Get()
  list(): never {
    throw new NotImplementedException('Pending Sprint 5');
  }
}
