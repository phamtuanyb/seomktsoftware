import { api } from './client';

export interface AdminUserListItem {
  id: string;
  email: string;
  name: string | null;
  role: 'user' | 'admin';
  plan: string;
  email_verified: boolean;
  created_at: string;
  deleted_at: string | null;
  stats: {
    articles: number;
    keywords: number;
    sites: number;
    brand_voices: number;
    images: number;
  };
}

export interface AdminUserDetail extends AdminUserListItem {
  phone: string | null;
  avatar_url: string | null;
  preferences_json: Record<string, unknown>;
  updated_at: string;
  subscriptions: Array<{
    id: string;
    plan: string;
    status: string;
    started_at: string;
    expires_at: string | null;
    created_at: string;
  }>;
  quotas: Array<{
    resource: string;
    period: string;
    limit_value: number;
    used: number;
    reset_at: string | null;
  }>;
  recent_audit_logs: Array<{
    action: string;
    resource_type: string | null;
    resource_id: string | null;
    created_at: string;
    metadata_json: Record<string, unknown> | null;
  }>;
}

export interface AdminStats {
  users: { total: number; active_last_30d: number; deleted: number };
  plans: Record<string, number>;
  articles: { total: number; last_30d: number };
  publish_jobs: { total: number; succeeded: number; failed: number; pending: number };
}

export type AiProviderName = 'claude' | 'openai' | 'gemini';

export interface AiSettings {
  default_provider: AiProviderName;
  providers: Record<AiProviderName, { configured: boolean; source: 'admin' | 'env' | 'missing' }>;
  updated_at: string | null;
}

export interface ListUsersResponse {
  items: AdminUserListItem[];
  cursor: string | null;
  has_more: boolean;
}

export const adminApi = {
  stats: () => api.get<AdminStats>('/admin/stats'),
  getAiSettings: () => api.get<AiSettings>('/admin/ai-settings'),
  updateAiSettings: (body: Partial<{
    default_provider: AiProviderName;
    claude_api_key: string;
    openai_api_key: string;
    gemini_api_key: string;
  }>) => api.patch<AiSettings>('/admin/ai-settings', body),

  listUsers: (query?: {
    cursor?: string;
    limit?: number;
    q?: string;
    role?: 'user' | 'admin';
    plan?: string;
  }) => {
    const qs = new URLSearchParams();
    if (query?.cursor) qs.set('cursor', query.cursor);
    if (query?.limit) qs.set('limit', String(query.limit));
    if (query?.q) qs.set('q', query.q);
    if (query?.role) qs.set('role', query.role);
    if (query?.plan) qs.set('plan', query.plan);
    const suffix = qs.toString();
    return api.get<ListUsersResponse>(`/admin/users${suffix ? `?${suffix}` : ''}`);
  },

  getUser: (id: string) => api.get<AdminUserDetail>(`/admin/users/${id}`),

  updateUser: (
    id: string,
    body: Partial<{ role: 'user' | 'admin'; email_verified: boolean; soft_delete: boolean }>,
  ) => api.patch<AdminUserDetail>(`/admin/users/${id}`, body),

  overrideSubscription: (
    id: string,
    body: {
      plan: string;
      status?: 'active' | 'cancelled' | 'expired' | 'paused';
      expires_at?: string;
      metadata?: Record<string, unknown>;
    },
  ) => api.post<AdminUserDetail>(`/admin/users/${id}/subscription`, body),

  overrideQuota: (
    id: string,
    body: {
      resource: 'articles' | 'keywords' | 'sites' | 'brand_voices' | 'images';
      period: 'monthly' | 'lifetime';
      limit_value: number;
      reset_used?: boolean;
    },
  ) => api.post<AdminUserDetail>(`/admin/users/${id}/quotas`, body),
};
