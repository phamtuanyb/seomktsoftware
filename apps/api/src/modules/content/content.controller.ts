import { Body, Controller, Get, NotImplementedException, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

/** Section 8 — TN3 outline + TN4 full article (streaming). Implemented in Sprint 4. */
@ApiTags('Content')
@ApiBearerAuth()
@Controller({ path: 'content', version: '1' })
export class ContentController {
  @Post('outline')
  @ApiOperation({ summary: 'TN3 — AI outline from keyword + SERP analysis' })
  outline(@Body() _body: unknown): never {
    throw new NotImplementedException('Pending Sprint 4 — TN3');
  }

  @Post('article')
  @ApiOperation({
    summary: 'TN4 — Write full article (SSE streaming when Accept: text/event-stream)',
  })
  article(@Body() _body: unknown): never {
    throw new NotImplementedException('Pending Sprint 4 — TN4');
  }

  @Get('articles')
  listArticles(): never {
    throw new NotImplementedException('Pending Sprint 4');
  }

  @Get('articles/:id')
  getArticle(@Param('id') _id: string): never {
    throw new NotImplementedException('Pending Sprint 4');
  }

  @Patch('articles/:id')
  updateArticle(@Param('id') _id: string): never {
    throw new NotImplementedException('Pending Sprint 4');
  }
}
