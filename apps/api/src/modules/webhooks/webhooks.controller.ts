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

/** Section 2 principle 6 — outgoing webhooks exposed from MVP. */
@ApiTags('Webhooks')
@ApiBearerAuth()
@Controller({ path: 'webhooks', version: '1' })
export class WebhooksController {
  @Get()
  list(): never {
    throw new NotImplementedException('Pending Sprint 6');
  }

  @Post()
  @ApiOperation({ summary: 'Register outgoing webhook URL + event subscriptions' })
  create(@Body() _body: unknown): never {
    throw new NotImplementedException('Pending Sprint 6');
  }

  @Get(':id')
  get(@Param('id') _id: string): never {
    throw new NotImplementedException('Pending Sprint 6');
  }

  @Delete(':id')
  delete(@Param('id') _id: string): never {
    throw new NotImplementedException('Pending Sprint 6');
  }

  @Post(':id/test')
  test(@Param('id') _id: string): never {
    throw new NotImplementedException('Pending Sprint 6');
  }
}
