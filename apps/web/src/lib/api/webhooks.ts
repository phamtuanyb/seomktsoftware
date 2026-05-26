import { api } from './client';

export const WEBHOOK_EVENTS = [
  'article.created',
  'article.completed',
  'article.published',
  'publish.failed',
  'brand_voice.trained',
  'image.generated',
  'keywords.suggested',
  'user.registered',
  'quota.warning',
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface WebhookListItem {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WebhookDetail extends WebhookListItem {
  /** Returned only on create + secret rotation. */
  secret?: string;
  has_secret: boolean;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event: string;
  payload_json: unknown;
  response_status: number | null;
  response_body: string | null;
  attempt_count: number;
  delivered_at: string | null;
  created_at: string;
}

export const webhooksApi = {
  list: () => api.get<WebhookListItem[]>('/webhooks'),
  get: (id: string) => api.get<WebhookDetail>(`/webhooks/${id}`),
  create: (body: { url: string; events: WebhookEvent[]; secret?: string }) =>
    api.post<WebhookDetail>('/webhooks', body),
  update: (
    id: string,
    body: Partial<{ url: string; events: WebhookEvent[]; secret: string; is_active: boolean }>,
  ) => api.patch<WebhookDetail>(`/webhooks/${id}`, body),
  remove: (id: string) => api.delete<{ id: string }>(`/webhooks/${id}`),
  test: (id: string) => api.post<{ delivery_id: string }>(`/webhooks/${id}/test`, {}),
  deliveries: (id: string, limit = 50) =>
    api.get<WebhookDelivery[]>(`/webhooks/${id}/deliveries?limit=${limit}`),
};
