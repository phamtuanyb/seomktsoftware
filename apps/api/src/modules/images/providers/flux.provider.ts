import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Replicate from 'replicate';
import {
  aspectToDimensions,
  isPlaceholderToken,
  type ImageGenerateRequest,
  type ImageGenerateResult,
  type ImageProvider,
  type ImageModel,
} from './image-provider.interface';

const FLUX_SCHNELL_MODEL = 'black-forest-labs/flux-schnell';

/**
 * Section 8 TN6 — Replicate Flux Schnell.
 *
 * Default for the MVP because it's cheap (≈ $0.003 per image) and fast
 * (~1-2 s per image). Auto-falls back to stub when REPLICATE_API_TOKEN is
 * missing or still the .env.example placeholder.
 *
 * Stub mode points at placehold.co with the brand colours so the rest of
 * the pipeline (storage, alt-text gen, DB persist) gets exercised without
 * burning Replicate credit.
 */
@Injectable()
export class FluxProvider implements ImageProvider {
  readonly model: ImageModel = 'flux-schnell';
  private readonly logger = new Logger(FluxProvider.name);

  private readonly client: Replicate | null;
  readonly available: boolean;

  constructor(cfg: ConfigService) {
    const token = cfg.get<string>('ai.replicateApiToken') ?? process.env.REPLICATE_API_TOKEN;
    this.available = !isPlaceholderToken(token);
    this.client = this.available ? new Replicate({ auth: token! }) : null;
    if (!this.available) {
      this.logger.warn(
        'FluxProvider running in STUB mode — REPLICATE_API_TOKEN missing or placeholder',
      );
    }
  }

  async generate(req: ImageGenerateRequest): Promise<ImageGenerateResult> {
    const started = Date.now();
    const { width, height } = aspectToDimensions(req.aspectRatio);

    if (!this.client || !this.available) {
      return this.stub(req, started, 'no real token');
    }

    try {
      // Run sequentially because Flux Schnell is already <2s per image and
      // Replicate enforces concurrency limits on free accounts.
      const images: ImageGenerateResult['images'] = [];
      for (let i = 0; i < req.count; i++) {
        const output = (await this.client.run(FLUX_SCHNELL_MODEL, {
          input: {
            prompt: req.prompt,
            aspect_ratio: req.aspectRatio,
            num_outputs: 1,
            output_format: 'png',
            output_quality: 90,
          },
        })) as unknown;
        const url = this.firstUrl(output);
        if (!url) continue;
        images.push({ source_url: url, width, height });
      }
      if (images.length === 0) return this.stub(req, started, 'empty replicate response');

      return {
        images,
        model_used: FLUX_SCHNELL_MODEL,
        // Replicate published price for flux-schnell: $0.003 per image.
        cost_usd: images.length * 0.003,
        is_stub: false,
        duration_ms: Date.now() - started,
      };
    } catch (err) {
      this.logger.warn(`Flux live generation failed: ${(err as Error).message}`);
      return this.stub(req, started, (err as Error).message);
    }
  }

  /** Replicate returns either a string URL or an array of URLs depending on the model. */
  private firstUrl(output: unknown): string | null {
    if (typeof output === 'string') return output;
    if (Array.isArray(output) && typeof output[0] === 'string') return output[0];
    if (output && typeof output === 'object' && 'url' in output && typeof output.url === 'string') {
      return output.url;
    }
    return null;
  }

  private stub(req: ImageGenerateRequest, started: number, error?: string): ImageGenerateResult {
    const { width, height } = aspectToDimensions(req.aspectRatio);
    // placehold.co works without auth and lets us pass title via query string.
    const slug = encodeURIComponent(this.truncate(req.prompt, 60));
    const palette = req.style === 'mkt-brand' ? '1F4E79/E97132' : '0F172A/F8FAFC';
    return {
      images: Array.from({ length: req.count }, () => ({
        source_url: `https://placehold.co/${width}x${height}/${palette}/png?text=${slug}`,
        width,
        height,
      })),
      model_used: `${this.model}-stub`,
      cost_usd: 0,
      is_stub: true,
      duration_ms: Date.now() - started,
      ...(error ? { error } : {}),
    };
  }

  private truncate(value: string, max: number): string {
    return value.length <= max ? value : value.slice(0, max - 1) + '…';
  }
}
