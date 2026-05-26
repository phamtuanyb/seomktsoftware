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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateWebhookDto, ListDeliveriesQueryDto, UpdateWebhookDto } from './dto/webhook.dto';
import { WebhooksService } from './services/webhooks.service';

/** Section 6 — outgoing webhook subscriptions. HMAC-signed payloads. */
@ApiTags('Webhooks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'webhooks', version: '1' })
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get()
  @ApiOperation({ summary: 'List my webhook subscriptions' })
  list(@CurrentUser('id') userId: string) {
    return this.webhooks.list(userId);
  }

  @Post()
  @ApiOperation({
    summary:
      'Register a new webhook. If secret omitted, server generates whsec_… and returns it ONCE.',
  })
  create(@Body() dto: CreateWebhookDto, @CurrentUser('id') userId: string) {
    return this.webhooks.create(userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Webhook detail (secret not exposed after create).' })
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.webhooks.get(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update url / events / secret rotation / enable+disable.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWebhookDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.webhooks.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hard-delete webhook + cascade deliveries.' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.webhooks.remove(userId, id);
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Fire a synthetic webhook.test delivery to verify the endpoint.' })
  test(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.webhooks.sendTest(userId, id);
  }

  @Get(':id/deliveries')
  @ApiOperation({ summary: 'Recent delivery attempts (newest first, default 50, max 200).' })
  listDeliveries(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Query() query: ListDeliveriesQueryDto,
  ) {
    return this.webhooks.listDeliveries(userId, id, query.limit ?? 50);
  }
}
