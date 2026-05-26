import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './services/webhooks.service';
import { WebhookDispatcherService } from './services/webhook-dispatcher.service';
import { WebhookDeliveryRunner } from './services/webhook-delivery-runner.service';
import { WebhookDeliveryQueue } from './workers/webhook-delivery.queue';
import { WebhookDeliveryProcessor } from './workers/webhook-delivery.processor';

/**
 * Section 6 — outgoing webhooks.
 *
 * The processor resolves WebhookDeliveryRunner via ModuleRef under the
 * explicit token (mirrors the publisher module pattern).
 */
@Module({
  controllers: [WebhooksController],
  providers: [
    WebhooksService,
    WebhookDispatcherService,
    WebhookDeliveryRunner,
    { provide: 'WebhookDeliveryRunner', useExisting: WebhookDeliveryRunner },
    WebhookDeliveryQueue,
    WebhookDeliveryProcessor,
  ],
  exports: [WebhooksService],
})
export class WebhooksModule {}
