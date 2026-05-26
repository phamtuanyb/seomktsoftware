import { api } from './client';

export type PublishStatus = 'draft' | 'publish' | 'future';
export type SeoPlugin = 'yoast' | 'rankmath' | 'seopress' | 'none';

export interface SiteSummary {
  id: string;
  url: string;
  name: string | null;
  username: string | null;
  type: string;
  status: string;
  plugin_seo_detected: SeoPlugin | null;
  last_check_at: string | null;
  last_publish_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSiteRequest {
  url: string;
  name?: string;
  username: string;
  application_password: string;
  type?: 'wordpress';
}

export interface UpdateSiteRequest {
  url?: string;
  name?: string;
  username?: string;
  application_password?: string;
}

export interface PublishWordpressRequest {
  article_id: string;
  site_id: string;
  status?: PublishStatus;
  scheduled_at?: string;
  categories?: string[];
  tags?: string[];
  featured_image_id?: string;
}

export interface PublishJobSummary {
  id: string;
  article_id: string;
  site_id: string;
  status: string;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  wp_post_id: number | null;
  published_url: string | null;
  retry_count: number;
  error_message: string | null;
  error_code: string | null;
  created_at: string;
}

export interface TestConnectionResult {
  ok: boolean;
  reason?: string;
  seo_plugin?: SeoPlugin;
  site_info?: { name?: string; description?: string; timezone?: string };
}

export const publisherApi = {
  listSites: () => api.get<SiteSummary[]>('/publisher/sites'),
  createSite: (body: CreateSiteRequest) => api.post<SiteSummary>('/publisher/sites', body),
  updateSite: (id: string, body: UpdateSiteRequest) =>
    api.patch<SiteSummary>(`/publisher/sites/${id}`, body),
  deleteSite: (id: string) => api.delete<{ id: string }>(`/publisher/sites/${id}`),
  testSite: (id: string) => api.post<TestConnectionResult>(`/publisher/sites/${id}/test`),

  publish: (body: PublishWordpressRequest) =>
    api.post<PublishJobSummary>('/publisher/wordpress', body),

  listJobs: (filters: { status?: string; site_id?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.site_id) params.set('site_id', filters.site_id);
    const qs = params.toString();
    return api.get<PublishJobSummary[]>(`/publisher/jobs${qs ? `?${qs}` : ''}`);
  },
  cancelJob: (id: string) => api.delete<PublishJobSummary>(`/publisher/jobs/${id}`),
};
