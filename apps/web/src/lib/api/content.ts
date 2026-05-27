import { api, ApiError } from './client';

// ----- types -----

export interface OutlineSubsection {
  h3: string;
  bullets: string[];
}

export interface OutlineSection {
  h2: string;
  subsections: OutlineSubsection[];
}

export interface OutlineWithMetadata {
  h1: string;
  sections: OutlineSection[];
  metadata: {
    based_on_serps: string[];
    ai_model: string;
    tokens_used: { input: number; output: number };
    cost_usd: number;
    is_stub: boolean;
    target_word_count: number;
    intent: string;
    format: string;
    language: string;
    cached: boolean;
    generated_at: string;
  };
}

export type ArticleTone = 'expert' | 'friendly' | 'sales' | 'educational' | 'storytelling';

export type OutlineIntent = 'info' | 'commercial' | 'transactional' | 'navigational';
export type OutlineFormat =
  | 'blog'
  | 'listicle'
  | 'how-to'
  | 'review'
  | 'comparison'
  | 'faq'
  | 'landing'
  | 'product';

export interface GenerateOutlineRequest {
  keyword: string;
  intent?: OutlineIntent;
  format?: OutlineFormat;
  target_word_count?: number;
  language?: string;
}

export interface ArticleResult {
  id: string;
  title: string;
  slug: string;
  content_markdown: string;
  content_html: string;
  meta_title: string;
  meta_description: string;
  target_keyword: string;
  word_count: number;
  content_score: number;
  content_score_breakdown: Record<
    string,
    {
      score: number;
      passed?: boolean;
      status?: 'good' | 'warning' | 'fail';
      name?: string;
      message?: string;
      note?: string;
      suggestions?: Array<{ text: string; action: 'manual' | 'auto-fixable' }>;
    }
  >;
  ai_model: string;
  ai_cost_usd: number;
  is_stub: boolean;
  brand_voice_id?: string | null;
}

export interface GenerateArticleRequest {
  keyword: string;
  outline: { h1: string; sections: OutlineSection[] };
  brand_voice_id?: string;
  tone?: 'expert' | 'friendly' | 'sales' | 'educational' | 'storytelling';
  format?: OutlineFormat;
  target_word_count?: number;
  model?:
    | 'claude-sonnet-4'
    | 'claude-haiku'
    | 'gpt-4o'
    | 'gpt-4o-mini'
    | 'gemini-1.5-pro'
    | 'gemini-1.5-flash';
  enable_schema_markup?: boolean;
}

export type ArticleStreamEvent =
  | { type: 'token'; content: string }
  | { type: 'section_complete'; section_id: string; section_title: string }
  | {
      type: 'complete';
      article_id: string;
      content_score: number;
      content_score_breakdown: ArticleResult['content_score_breakdown'];
      word_count: number;
      meta_title: string;
      meta_description: string;
      ai_model: string;
      cost_usd: number;
      is_stub: boolean;
    }
  | { type: 'error'; code: string; message: string };

// ----- API -----

export const contentApi = {
  generateOutline: (body: GenerateOutlineRequest) =>
    api.post<OutlineWithMetadata>('/content/outline', body),

  /** Non-streaming article generation — returns full ArticleResult. */
  generateArticle: (body: GenerateArticleRequest) =>
    api.post<ArticleResult>('/content/article', body),

  listArticles: (query?: {
    cursor?: string;
    limit?: number;
    status?: 'draft' | 'ready' | 'published';
    q?: string;
    min_score?: number;
    max_score?: number;
  }) => {
    const qs = new URLSearchParams();
    if (query?.cursor) qs.set('cursor', query.cursor);
    if (query?.limit) qs.set('limit', String(query.limit));
    if (query?.status) qs.set('status', query.status);
    if (query?.q) qs.set('q', query.q);
    if (query?.min_score !== undefined) qs.set('min_score', String(query.min_score));
    if (query?.max_score !== undefined) qs.set('max_score', String(query.max_score));
    const suffix = qs.toString();
    return api.get<{ items: ArticleResult[]; cursor: string | null; has_more: boolean }>(
      `/content/articles${suffix ? `?${suffix}` : ''}`,
    );
  },
  getArticle: (id: string) => api.get<ArticleResult>(`/content/articles/${id}`),
  updateArticle: (
    id: string,
    body: Partial<{
      title: string;
      slug: string;
      content_markdown: string;
      meta_title: string;
      meta_description: string;
      status: 'draft' | 'ready' | 'published';
      word_count: number;
    }>,
  ) => api.patch<ArticleResult>(`/content/articles/${id}`, body),
  deleteArticle: (id: string) => api.delete<{ id: string }>(`/content/articles/${id}`),

  /** Sprint 6.5 — regenerate ONE H2 section in place, returns the full updated article. */
  regenerateSection: (
    id: string,
    body: { section_heading: string; instructions?: string; tone?: ArticleTone },
  ) => api.post<ArticleResult>(`/content/articles/${id}/regenerate-section`, body),

  /** Sprint 6.5 — rewrite selection or whole article. */
  rewrite: (
    id: string,
    body: {
      action: 'shorter' | 'longer' | 'tone' | 'details' | 'free';
      text?: string;
      tone?: ArticleTone;
      instructions?: string;
      apply?: number;
    },
  ) =>
    api.post<{ rewritten: string; article?: ArticleResult }>(
      `/content/articles/${id}/rewrite`,
      body,
    ),

  /** Sprint 6.5 — download article as md / html / docx. Triggers a browser download. */
  exportUrl: (id: string, format: 'md' | 'html' | 'docx') =>
    `/api/proxy/v1/content/articles/${id}/export?format=${format}`,

  /**
   * Streaming article generation. Hits the same endpoint with
   * `Accept: text/event-stream` and yields ArticleStreamEvent over time.
   * Goes via the /api/proxy/v1 path so the httpOnly cookie still attaches.
   */
  async *streamArticle(body: GenerateArticleRequest): AsyncIterable<ArticleStreamEvent> {
    const res = await fetch('/api/proxy/v1/content/article', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(body),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new ApiError(
        res.status,
        err?.error?.code ?? 'STREAM_FAILED',
        err?.error?.message ?? `Streaming failed: ${res.status}`,
      );
    }
    if (!res.body) throw new ApiError(res.status, 'STREAM_FAILED', 'No response body');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // SSE event boundary = blank line.
        let idx;
        while ((idx = buf.indexOf('\n\n')) !== -1) {
          const raw = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const dataLine = raw.split('\n').find((l) => l.startsWith('data:'));
          if (!dataLine) continue;
          const json = dataLine.slice(5).trim();
          if (!json) continue;
          try {
            yield JSON.parse(json) as ArticleStreamEvent;
          } catch {
            // Skip malformed chunks.
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },
};

// ----- brand voices -----

export interface BrandVoiceListItem {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  sample_count: number;
  trained_at: string;
  created_at: string;
  updated_at: string;
  algorithm: 'claude-sonnet-4' | 'placeholder-heuristic';
}

/** Section 8 TN5 — profile training meta (algorithm + tokens + cost). */
export interface BrandVoiceMeta {
  algorithm: 'claude-sonnet-4' | 'placeholder-heuristic';
  upgraded_to_real_at: string | null;
  sample_count: number;
  trained_at: string;
  tokens_used?: { input: number; output: number };
  cost_usd?: number;
}

export interface BrandVoiceDetail extends BrandVoiceListItem {
  profile_json: Record<string, unknown>;
  reference_articles: Array<{ title?: string | null; content: string }>;
  meta: BrandVoiceMeta;
}

export interface CreateBrandVoiceRequest {
  name: string;
  description?: string;
  is_default?: boolean;
  sample_articles: Array<{ title?: string; content?: string; url?: string }>;
  profile_json?: Record<string, unknown>;
}

export const brandVoicesApi = {
  list: () => api.get<BrandVoiceListItem[]>('/brand-voices'),
  get: (id: string) => api.get<BrandVoiceDetail>(`/brand-voices/${id}`),
  create: (body: CreateBrandVoiceRequest) => api.post<BrandVoiceDetail>('/brand-voices', body),
  update: (id: string, body: Partial<CreateBrandVoiceRequest>) =>
    api.patch<BrandVoiceDetail>(`/brand-voices/${id}`, body),
  remove: (id: string) => api.delete<{ id: string }>(`/brand-voices/${id}`),
  retrain: (id: string) => api.post<BrandVoiceDetail>(`/brand-voices/${id}/train`, {}),
};
