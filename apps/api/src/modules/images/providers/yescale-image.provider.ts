import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { AiSettingsService } from '../../admin/ai-settings.service';
import {
  aspectToDimensions,
  type ImageGenerateRequest,
  type ImageGenerateResult,
  type ImageModel,
  type ImageProvider,
} from './image-provider.interface';

const YESCALE_IMAGE_BASE_URL = 'https://api.yescale.vip/v1';
const YESCALE_IMAGE_MODEL = 'gpt-image-2';

@Injectable()
export class YescaleImageProvider implements ImageProvider {
  private readonly logger = new Logger(YescaleImageProvider.name);
  private readonly envKey: string;

  readonly model: ImageModel = 'yescale-gpt-image-2';

  get available(): boolean {
    return !this.isPlaceholder(this.envKey) || this.settings.hasConfiguredKey('yescale');
  }

  constructor(
    cfg: ConfigService,
    private readonly settings: AiSettingsService,
  ) {
    this.envKey = cfg.get<string>('ai.yescaleImageApiKey') ?? process.env.YESCALE_IMAGE_API_KEY ?? '';
    if (!this.available) {
      this.logger.warn(
        'YescaleImageProvider running in STUB mode - YESCALE_IMAGE_API_KEY / YESCALE_API_KEY is missing',
      );
    }
  }

  async generate(req: ImageGenerateRequest): Promise<ImageGenerateResult> {
    const started = Date.now();
    const { width, height } = aspectToDimensions(req.aspectRatio);
    const key = !this.isPlaceholder(this.envKey) ? this.envKey : await this.settings.getApiKey('yescale');

    if (!key) {
      return this.stub(req, started, 'no yescale key');
    }

    try {
      const client = new OpenAI({
        apiKey: key,
        baseURL: YESCALE_IMAGE_BASE_URL,
      });

      const images: ImageGenerateResult['images'] = [];
      const size = this.mapSize(req.aspectRatio);
      for (let i = 0; i < req.count; i += 1) {
        const response = await client.images.generate({
          model: YESCALE_IMAGE_MODEL,
          prompt: req.prompt,
          size,
        });
        const item = response.data?.[0];
        if (!item) continue;

        const url = item.url?.trim();
        const b64 = item.b64_json?.trim();
        if (url) {
          images.push({ source_url: url, width, height });
          continue;
        }
        if (b64) {
          const bytes = Buffer.from(b64, 'base64');
          images.push({
            source_url: `data:image/png;base64,${b64}`,
            width,
            height,
            bytes,
            file_size_bytes: bytes.length,
          });
        }
      }

      if (images.length === 0) {
        return this.stub(req, started, 'empty yescale image response');
      }

      return {
        images,
        model_used: YESCALE_IMAGE_MODEL,
        cost_usd: 0,
        is_stub: false,
        duration_ms: Date.now() - started,
      };
    } catch (err) {
      this.logger.warn(`Yescale image generation failed: ${(err as Error).message}`);
      return this.stub(req, started, (err as Error).message);
    }
  }

  private mapSize(
    ratio: ImageGenerateRequest['aspectRatio'],
  ): '1024x1024' | '1536x1024' | '1024x1536' {
    if (ratio === '1:1') return '1024x1024';
    if (ratio === '4:3') return '1536x1024';
    return '1536x1024';
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
      model_used: `${YESCALE_IMAGE_MODEL}-stub`,
      cost_usd: 0,
      is_stub: true,
      duration_ms: Date.now() - started,
      ...(error ? { error } : {}),
    };
  }

  private isPlaceholder(value: string | undefined): boolean {
    if (!value) return true;
    const trimmed = value.trim();
    if (trimmed.length === 0) return true;
    if (trimmed.endsWith('...')) return true;
    if (trimmed === 'sk-...') return true;
    return false;
  }
}
