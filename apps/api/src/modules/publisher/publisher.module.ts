import { Module } from '@nestjs/common';
import { PublisherController } from './publisher.controller';
import { SitesService } from './services/sites.service';
import { PublisherService } from './services/publisher.service';
import { WordPressAdapter } from './adapters/wordpress.adapter';
import { PUBLISHER_ADAPTERS } from './adapters/publisher.interface';
import { PublishQueue } from './workers/publish.queue';
import { PublishProcessor } from './workers/publish.processor';

/**
 * Section 8 TN8 — WordPress publisher module.
 *
 * The PublisherService is registered under the explicit "PublisherService"
 * token (in addition to its class token) so the BullMQ worker can resolve
 * it via ModuleRef without a hard import cycle.
 */
@Module({
  controllers: [PublisherController],
  providers: [
    WordPressAdapter,
    {
      provide: PUBLISHER_ADAPTERS,
      useFactory: (wp: WordPressAdapter) => [wp],
      inject: [WordPressAdapter],
    },
    SitesService,
    PublisherService,
    { provide: 'PublisherService', useExisting: PublisherService },
    PublishQueue,
    PublishProcessor,
  ],
  exports: [SitesService, PublisherService],
})
export class PublisherModule {}
