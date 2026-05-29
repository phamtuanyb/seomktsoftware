import { api } from './client';

export type ImageStyle =
  | 'realistic'
  | 'illustration'
  | '3d'
  | 'minimalist'
  | 'infographic'
  | 'mkt-brand';
export type ImageAspectRatio = '16:9' | '4:3' | '1:1';
export type ImageModel = 'flux-schnell' | 'dalle-3' | 'yescale-gpt-image-1';

export interface ImageRecord {
  id: string;
  url: string;
  thumbnail_url: string | null;
  prompt: string | null;
  alt_text: string | null;
  style: string | null;
  aspect_ratio: string | null;
  width: number | null;
  height: number | null;
  file_size_bytes: number | null;
  model_used: string | null;
  cost_usd: number;
  article_id: string | null;
  created_at: string;
}

export interface GenerateImageRequest {
  prompt: string;
  style?: ImageStyle;
  aspect_ratio?: ImageAspectRatio;
  count?: number;
  model?: ImageModel;
  article_id?: string;
  alt_text?: string;
}

export interface GenerateForArticleRequest {
  article_id: string;
  include_featured?: boolean;
  style?: ImageStyle;
  model?: ImageModel;
  max_in_content?: number;
}

export interface GenerateImageResponse {
  images: ImageRecord[];
  stats: {
    count: number;
    cost_usd: number;
    duration_ms: number;
    provider_stub: boolean;
    storage_stub: boolean;
    safety_method: 'ai' | 'rule';
  };
}

export interface GenerateForArticleResponse extends GenerateImageResponse {
  article_id: string;
  featured_image_id: string | null;
}

export const imagesApi = {
  generate: (body: GenerateImageRequest) =>
    api.post<GenerateImageResponse>('/images/generate', body),
  generateForArticle: (body: GenerateForArticleRequest) =>
    api.post<GenerateForArticleResponse>('/images/generate-for-article', body),
  list: (articleId?: string) =>
    api.get<ImageRecord[]>(`/images${articleId ? `?article_id=${articleId}` : ''}`),
  get: (id: string) => api.get<ImageRecord>(`/images/${id}`),
  remove: (id: string) => api.delete<{ id: string }>(`/images/${id}`),
};
