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

/** Section 8 — TN5 Brand Voice training. Implemented in Sprint 4. */
@ApiTags('Brand Voices')
@ApiBearerAuth()
@Controller({ path: 'brand-voices', version: '1' })
export class BrandVoicesController {
  @Get()
  list(): never {
    throw new NotImplementedException('Pending Sprint 4 — TN5');
  }

  @Post()
  @ApiOperation({ summary: 'TN5 — Create brand voice from 3-20 sample articles' })
  create(@Body() _body: unknown): never {
    throw new NotImplementedException('Pending Sprint 4 — TN5');
  }

  @Get(':id')
  get(@Param('id') _id: string): never {
    throw new NotImplementedException('Pending Sprint 4');
  }

  @Patch(':id')
  update(@Param('id') _id: string): never {
    throw new NotImplementedException('Pending Sprint 4');
  }

  @Delete(':id')
  delete(@Param('id') _id: string): never {
    throw new NotImplementedException('Pending Sprint 4');
  }
}
