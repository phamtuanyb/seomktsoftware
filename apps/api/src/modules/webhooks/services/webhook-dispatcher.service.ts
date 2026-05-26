import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WEBHOOK_EVENTS } from '../dto/webhook.dto';
import { WebhooksService } from './webhooks.service';

/**
 * Section 6 — bridges in-process EventBus events to webhook deliveries.
 *
 * Each business module emits via EventBusService.emit('article.completed', …).
 * EventBusService runs both local emitter + Redis Pub/Sub so this handler
 * fires once per emit. We forward to WebhooksService.dispatchEvent which
 * resolves subscribers + enqueues BullMQ jobs.
 *
 * Naming: one handler per event keeps the listener metadata explicit.
 * NestJS event-emitter handles dedup so this is fine.
 */
@Injectable()
export class WebhookDispatcherService {
  constructor(private readonly webhooks: WebhooksService) {}

  @OnEvent('article.created')
  onArticleCreated(payload: unknown) {
    return this.webhooks.dispatchEvent('article.created', payload);
  }

  @OnEvent('article.completed')
  onArticleCompleted(payload: unknown) {
    return this.webhooks.dispatchEvent('article.completed', payload);
  }

  @OnEvent('article.published')
  onArticlePublished(payload: unknown) {
    return this.webhooks.dispatchEvent('article.published', payload);
  }

  @OnEvent('publish.failed')
  onPublishFailed(payload: unknown) {
    return this.webhooks.dispatchEvent('publish.failed', payload);
  }

  @OnEvent('brand_voice.trained')
  onBrandVoiceTrained(payload: unknown) {
    return this.webhooks.dispatchEvent('brand_voice.trained', payload);
  }

  @OnEvent('image.generated')
  onImageGenerated(payload: unknown) {
    return this.webhooks.dispatchEvent('image.generated', payload);
  }

  @OnEvent('keywords.suggested')
  onKeywordsSuggested(payload: unknown) {
    return this.webhooks.dispatchEvent('keywords.suggested', payload);
  }

  @OnEvent('user.registered')
  onUserRegistered(payload: unknown) {
    return this.webhooks.dispatchEvent('user.registered', payload);
  }

  @OnEvent('quota.warning')
  onQuotaWarning(payload: unknown) {
    return this.webhooks.dispatchEvent('quota.warning', payload);
  }

  /** Compile-time check: keep WEBHOOK_EVENTS in sync with the listeners above. */
  static readonly KNOWN_EVENTS = WEBHOOK_EVENTS;
}
