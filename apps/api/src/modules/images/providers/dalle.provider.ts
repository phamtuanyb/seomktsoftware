import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  aspectToDimensions,
  isPlaceholderToken,
  type ImageGenerateRequest,
  type ImageGenerateResult,
  type ImageProvider,
  type ImageModel,
} from './image-provider.interface';

/**
 * Section 8 TN6 — DALL-E 3 premium provider. OpenAI's image API only
 * accepts a fixed set of sizes (1024×1024, 1792×1024, 1024×1792). We map
 * the spec's aspect ratios to the closest supported size.
 *
 * Pricing (HD): $0.080 per image. Stub mode mirrors FluxProvider.
 */
@Injectable()
export class DalleProvider implements ImageProvider {
  readonly model: ImageModel = 'dalle-3';
  private readonly logger = new Logger(DalleProvider.name);

  private readonly client: OpenAI | null;
  readonly available: boolean;

  constructor(cfg: ConfigService) {
    const key = cfg.get<string>('ai.openaiApiKey') ?? process.env.OPENAI_API_KEY;
    this.available = !isPlaceholderToken(key);
    this.client = this.available ? new OpenAI({ apiKey: key }) : null;
    if (!this.available) {
      this.logger.warn(
        'DalleProvider running in STUB mode — OPENAI_API_KEY missing or placeholder',
      );
    }
  }

  async generate(req: ImageGenerateRequest): Promise<ImageGenerateResult> {
    const started = Date.now();
    const { width: targetW, height: targetH } = aspectToDimensions(req.aspectRatio);

    if (!this.client || !this.available) {
      return this.stub(req, started, 'no real key');
    }

    const size = this.mapSize(req.aspectRatio);
    try {
      const images: ImageGenerateResult['images'] = [];
      // DALL-E 3 accepts n=1 per call — loop for multi-image.
      for (let i = 0; i < req.count; i++) {
        const response = await this.client.images.generate({
          model: 'dall-e-3',
          prompt: req.prompt,
          n: 1,
          size,
          quality: 'hd',
          response_format: 'url',
        });
        const url = response.data?.[0]?.url;
        if (!url) continue;
        images.push({ source_url: url, width: targetW, height: targetH });
      }
      if (images.length === 0) return this.stub(req, started, 'empty dalle response');

      return {
        images,
        model_used: 'dall-e-3',
        cost_usd: images.length * 0.08,
        is_stub: false,
        duration_ms: Date.now() - started,
      };
    } catch (err) {
      this.logger.warn(`DALL-E live generation failed: ${(err as Error).message}`);
      return this.stub(req, started, (err as Error).message);
    }
  }

  private mapSize(
    ratio: ImageGenerateRequest['aspectRatio'],
  ): '1024x1024' | '1792x1024' | '1024x1792' {
    if (ratio === '1:1') return '1024x1024';
    if (ratio === '4:3') return '1792x1024'; // DALL-E doesn't do 4:3, closest landscape.
    return '1792x1024'; // 16:9 → use widest landscape.
  }

  private stub(req: ImageGenerateRequest, started: number, error?: string): ImageGenerateResult {
    const { width, height } = aspectToDimensions(req.aspectRatio);
    const slug = encodeURIComponent(req.prompt.slice(0, 60));
    return {
      images: Array.from({ length: req.count }, () => ({
        source_url: `https://placehold.co/${width}x${height}/1F4E79/E97132/png?text=${slug}`,
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
}
