/**
 * Section 8 TN6 — Image generation provider abstraction.
 * Strategy pattern (Section 5) so we can swap Flux ↔ DALL-E at runtime
 * via the `model` parameter.
 */

export type ImageModel = 'flux-schnell' | 'dalle-3' | 'yescale-gpt-image-2' | 'stub';
export type ImageStyle =
  | 'realistic'
  | 'illustration'
  | '3d'
  | 'minimalist'
  | 'infographic'
  | 'mkt-brand';
export type ImageAspectRatio = '16:9' | '4:3' | '1:1';

export interface ImageGenerateRequest {
  /** Augmented prompt (after style preset injection). */
  prompt: string;
  style: ImageStyle;
  aspectRatio: ImageAspectRatio;
  count: number;
  /** Optional per-call model override. */
  model?: ImageModel;
}

export interface GeneratedImage {
  /** Source URL returned by the provider (may be temporary). */
  source_url: string;
  width: number;
  height: number;
  /** Bytes in the original PNG/JPEG. */
  file_size_bytes?: number;
  /** Optional raw bytes when the provider returned them inline (PNG/JPEG). */
  bytes?: Buffer;
}

export interface ImageGenerateResult {
  images: GeneratedImage[];
  model_used: string;
  cost_usd: number;
  is_stub: boolean;
  duration_ms: number;
  /** Set when the provider hit an error and fell back to stub. */
  error?: string;
}

export interface ImageProvider {
  readonly model: ImageModel;
  /** True only when a real API key is wired AND the call path is enabled. */
  readonly available: boolean;
  generate(req: ImageGenerateRequest): Promise<ImageGenerateResult>;
}

export const IMAGE_PROVIDER_FLUX = Symbol('IMAGE_PROVIDER_FLUX');
export const IMAGE_PROVIDER_DALLE = Symbol('IMAGE_PROVIDER_DALLE');
export const IMAGE_PROVIDER_YESCALE = Symbol('IMAGE_PROVIDER_YESCALE');

/** Maps the spec's `model` string to an internal provider key. */
export function resolveImageModel(
  model?: ImageModel,
):
  | typeof IMAGE_PROVIDER_FLUX
  | typeof IMAGE_PROVIDER_DALLE
  | typeof IMAGE_PROVIDER_YESCALE {
  if (model === 'dalle-3') return IMAGE_PROVIDER_DALLE;
  if (model === 'yescale-gpt-image-2') return IMAGE_PROVIDER_YESCALE;
  return IMAGE_PROVIDER_FLUX;
}

/** Returns true when the env var is missing or still the .env.example placeholder. */
export function isPlaceholderToken(value: string | undefined): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  if (trimmed === 'r8_...' || trimmed === 'sk-...') return true;
  if (trimmed.endsWith('...')) return true;
  return false;
}

/** Section 8 TN6 — style preset → prompt suffix that gets concatenated. */
export const STYLE_PRESETS: Record<ImageStyle, string> = {
  realistic: 'photorealistic, DSLR shot, sharp focus, natural lighting',
  illustration: 'flat 2D illustration, clean lines, pastel palette',
  '3d': '3D render, isometric, soft shadows, modern',
  minimalist: 'minimalist, lots of whitespace, monochrome accent',
  infographic: 'infographic style, data viz, icons, neat layout',
  'mkt-brand':
    'modern marketing illustration, brand colors #1F4E79 (blue) and #E97132 (orange), clean composition',
};

/** Converts the spec ratio string to {width, height} for Flux's `aspect_ratio` param. */
export function aspectToDimensions(
  ratio: ImageAspectRatio,
  longSide = 1280,
): { width: number; height: number } {
  if (ratio === '1:1') return { width: longSide, height: longSide };
  if (ratio === '4:3') return { width: longSide, height: Math.round((longSide * 3) / 4) };
  // 16:9 default
  return { width: longSide, height: Math.round((longSide * 9) / 16) };
}
