import { api } from './client';

export type PipelineStepName = 'outline' | 'article' | 'audit' | 'images' | 'publish';
export type PipelineStepStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
export type PipelineRunStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface PipelineStep {
  step: PipelineStepName;
  status: PipelineStepStatus;
  started_at?: string;
  finished_at?: string;
  output_ref?: string;
  error_message?: string;
  details?: Record<string, unknown>;
}

export interface PipelineRun {
  id: string;
  status: PipelineRunStatus;
  keyword: string;
  format: string;
  brand_voice_id: string | null;
  site_id: string | null;
  article_id: string | null;
  publish_job_id: string | null;
  steps: PipelineStep[];
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StartPipelineRequest {
  keyword: string;
  format?: 'blog' | 'listicle' | 'how-to' | 'review' | 'comparison' | 'faq' | 'landing' | 'product';
  target_word_count?: number;
  brand_voice_id?: string;
  model?: 'claude-sonnet-4' | 'claude-haiku' | 'gpt-4o';
  generate_images?: boolean;
  site_id?: string;
  publish_status?: 'draft' | 'publish';
}

export const pipelineApi = {
  start: (body: StartPipelineRequest) => api.post<PipelineRun>('/pipeline/runs', body),
  list: (query?: { cursor?: string; limit?: number; status?: PipelineRunStatus }) => {
    const qs = new URLSearchParams();
    if (query?.cursor) qs.set('cursor', query.cursor);
    if (query?.limit) qs.set('limit', String(query.limit));
    if (query?.status) qs.set('status', query.status);
    const suffix = qs.toString();
    return api.get<{ items: PipelineRun[]; cursor: string | null; has_more: boolean }>(
      `/pipeline/runs${suffix ? `?${suffix}` : ''}`,
    );
  },
  get: (id: string) => api.get<PipelineRun>(`/pipeline/runs/${id}`),
  cancel: (id: string) => api.post<PipelineRun>(`/pipeline/runs/${id}/cancel`, {}),
};
