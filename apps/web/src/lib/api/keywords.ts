import { api } from './client';

// ---- TN1 ----

export type KeywordSource = 'google_suggest' | 'bing_suggest' | 'paa' | 'manual';

export interface KeywordSuggestion {
  keyword: string;
  source: KeywordSource;
  rank?: number;
}

export interface SuggestionResult {
  seed: string;
  language: string;
  country: string;
  sources_used: KeywordSource[];
  keywords: KeywordSuggestion[];
  stats: {
    total_returned: number;
    total_raw: number;
    dedupe_rate: number;
    duration_ms: number;
    by_source: Record<
      KeywordSource,
      { count: number; duration_ms: number; is_stub: boolean; error?: string }
    >;
    cached: boolean;
  };
}

export interface SuggestRequest {
  seed: string;
  sources?: KeywordSource[];
  language?: string;
  country?: string;
  limit?: number;
}

// ---- TN2 ----

export type Intent = 'info' | 'commercial' | 'transactional' | 'navigational';

export interface AnalyzedRow {
  keyword: string;
  volume: number | null;
  cpc: number | null;
  competition: 'low' | 'medium' | 'high' | null;
  keyword_difficulty: number;
  kd_notes: string[];
  intent: Intent | null;
  intent_confidence: number | null;
  intent_method: 'ai' | 'rule' | null;
  cached: boolean;
}

export interface AnalysisResult {
  rows: AnalyzedRow[];
  stats: {
    total: number;
    cached: number;
    duration_ms: number;
    cost_usd: number;
    volume_provider_stub: boolean;
    intent_provider_stub: boolean;
    intent_analyzed: boolean;
  };
}

export interface AnalyzeRequest {
  keywords: string[];
  analyze_intent?: boolean;
  language?: string;
  country?: string;
  project_id?: string;
}

// ---- Projects ----

export interface KeywordProject {
  id: string;
  name: string;
  seed_keyword: string | null;
  language: string;
  country: string;
  keyword_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectKeyword {
  id: string;
  keyword: string;
  source: string | null;
  volume: number | null;
  keyword_difficulty: number | null;
  cpc: number | null;
  intent: string | null;
  intent_confidence: number | null;
  analyzed_at: string | null;
  created_at: string;
}

export interface CreateProjectRequest {
  name: string;
  seed_keyword?: string;
  language?: string;
  country?: string;
}

export interface AddKeywordsRequest {
  keywords: string[];
  source?: KeywordSource | 'manual';
}

export const keywordsApi = {
  suggest: (body: SuggestRequest) => api.post<SuggestionResult>('/keywords/suggest', body),
  analyze: (body: AnalyzeRequest) => api.post<AnalysisResult>('/keywords/analyze', body),

  listProjects: () => api.get<KeywordProject[]>('/keywords/projects'),
  createProject: (body: CreateProjectRequest) =>
    api.post<KeywordProject>('/keywords/projects', body),
  getProject: (id: string) => api.get<KeywordProject>(`/keywords/projects/${id}`),
  deleteProject: (id: string) => api.delete<{ id: string }>(`/keywords/projects/${id}`),

  listProjectKeywords: (id: string) =>
    api.get<ProjectKeyword[]>(`/keywords/projects/${id}/keywords`),
  addProjectKeywords: (id: string, body: AddKeywordsRequest) =>
    api.post<{ inserted: number; skipped: number }>(`/keywords/projects/${id}/keywords`, body),
  removeProjectKeyword: (id: string, kid: string) =>
    api.delete<{ id: string }>(`/keywords/projects/${id}/keywords/${kid}`),

  /** Returns the same-origin download URL (cookie attaches automatically). */
  exportProjectUrl: (id: string, format: 'csv' | 'excel'): string =>
    `/api/proxy/v1/keywords/projects/${id}/export?format=${format}`,
};
