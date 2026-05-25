import {
  Body,
  Controller,
  Delete,
  Get,
  NotImplementedException,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

/** Section 8 — TN1 (Keyword Suggestion) + TN2 (Analysis). Implemented in Sprint 3. */
@ApiTags('Keywords')
@ApiBearerAuth()
@Controller({ path: 'keywords', version: '1' })
export class KeywordsController {
  @Post('suggest')
  @ApiOperation({ summary: 'TN1 — Suggest keywords from a seed (Google/Bing/PAA)' })
  suggest(@Body() _body: unknown): never {
    throw new NotImplementedException('Pending Sprint 3 — TN1');
  }

  @Post('analyze')
  @ApiOperation({ summary: 'TN2 — Volume + KD + Intent batch analysis' })
  analyze(@Body() _body: unknown): never {
    throw new NotImplementedException('Pending Sprint 3 — TN2');
  }

  @Get('projects')
  @ApiOperation({ summary: 'List keyword projects' })
  listProjects(): never {
    throw new NotImplementedException('Pending Sprint 3');
  }

  @Post('projects')
  @ApiOperation({ summary: 'Create keyword project' })
  createProject(): never {
    throw new NotImplementedException('Pending Sprint 3');
  }

  @Get('projects/:id')
  getProject(@Param('id') _id: string): never {
    throw new NotImplementedException('Pending Sprint 3');
  }

  @Delete('projects/:id')
  deleteProject(@Param('id') _id: string): never {
    throw new NotImplementedException('Pending Sprint 3');
  }
}
