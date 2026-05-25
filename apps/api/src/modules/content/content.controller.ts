import {
  Body,
  Controller,
  Get,
  NotImplementedException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GenerateOutlineDto } from './dto/generate-outline.dto';
import { OutlineService } from './services/outline.service';
import type { OutlineWithMetadata } from './schemas/outline.schema';

/** Section 8 — TN3 outline (live) + TN4 article (pending). */
@ApiTags('Content')
@ApiBearerAuth()
@Controller({ path: 'content', version: '1' })
export class ContentController {
  constructor(private readonly outlines: OutlineService) {}

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
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'TN4 — Write full article (SSE streaming when Accept: text/event-stream)',
  })
  article(@Body() _body: unknown): never {
    throw new NotImplementedException('Pending Sprint 5.5 — TN4');
  }

  @Get('articles')
  @UseGuards(JwtAuthGuard)
  listArticles(): never {
    throw new NotImplementedException('Pending Sprint 5.5');
  }

  @Get('articles/:id')
  @UseGuards(JwtAuthGuard)
  getArticle(@Param('id') _id: string): never {
    throw new NotImplementedException('Pending Sprint 5.5');
  }

  @Patch('articles/:id')
  @UseGuards(JwtAuthGuard)
  updateArticle(@Param('id') _id: string): never {
    throw new NotImplementedException('Pending Sprint 5.5');
  }
}
