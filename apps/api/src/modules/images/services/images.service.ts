import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import { ErrorCode } from '@mkt-seo/shared';
import { PrismaService } from '../../../common/services/prisma.service';
import { EventBusService } from '../../../common/services/event-bus.service';
import { AiSettingsService } from '../../admin/ai-settings.service';
import { StorageService } from '../storage/storage.service';
import { ImageProcessor } from '../storage/image-processor.service';
import { ImageSafetyService } from './image-safety.service';
import { AltTextService } from './alt-text.service';
import {
  IMAGE_PROVIDER_DALLE,
  IMAGE_PROVIDER_FLUX,
  IMAGE_PROVIDER_YESCALE,
  STYLE_PRESETS,
  resolveImageModel,
  type GeneratedImage,
  type ImageAspectRatio,
  type ImageGenerateResult,
  type ImageModel,
  type ImageProvider,
  type ImageStyle,
} from '../providers/image-provider.interface';
import type { GenerateForArticleDto, GenerateImageDto } from '../dto/generate-image.dto';

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

export interface GenerateFromPromptSuggestion {
  prompt: string;
  alt_text?: string;
}

/**
 * Section 8 TN6 — pipeline orchestrator.
 *
 * Per spec the flow is:
 *   1. Safety check prompt (no NSFW / no real-person likeness).
 *   2. Augment prompt with the style preset.
 *   3. Call image provider (Flux default, DALL-E premium).
 *   4. Download bytes → resize via Sharp (featured 1200×630, in-content 800×450).
 *   5. Upload to Cloudflare R2.
 *   6. Generate alt text via Claude Haiku.
 *   7. Persist image row + return.
 *
 * Stub flow stays meaningful end-to-end: placehold.co URLs flow through
 * Storage's stub mode (returns the URL unchanged) so callers get a real
 * `images.url` they can render in the browser.
 */
@Injectable()
export class ImagesService {
  private readonly logger = new Logger(ImagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly settings: AiSettingsService,
    private readonly storage: StorageService,
    private readonly processor: ImageProcessor,
    private readonly safety: ImageSafetyService,
    private readonly altText: AltTextService,
    @Inject(IMAGE_PROVIDER_FLUX) private readonly flux: ImageProvider,
    @Inject(IMAGE_PROVIDER_DALLE) private readonly dalle: ImageProvider,
    @Inject(IMAGE_PROVIDER_YESCALE) private readonly yescale: ImageProvider,
  ) {}

  async generate(dto: GenerateImageDto, userId: string): Promise<GenerateImageResponse> {
    const started = Date.now();
    const style: ImageStyle = dto.style ?? 'mkt-brand';
    const aspectRatio: ImageAspectRatio = dto.aspect_ratio ?? '16:9';
    const count = dto.count ?? 1;
    const model = dto.model ?? this.defaultModel();

    // Step 1 — safety check.
    const safety = await this.safety.check(dto.prompt);
    if (!safety.safe) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: safety.reason ?? 'Prompt không hợp lệ',
        details: { flags: safety.flags },
      });
    }

    // Step 2 — augment prompt with style preset.
    const augmentedPrompt = `${safety.cleaned_prompt}. ${STYLE_PRESETS[style]}`.slice(0, 1000);

    // Step 3 — call provider.
    const provider = this.pickProvider(model);
    const genResult = await provider.generate({
      prompt: augmentedPrompt,
      style,
      aspectRatio,
      count,
      model,
    });

    let articleContext: { id: string; title: string; keyword: string | null } | null = null;
    if (dto.article_id) {
      const article = await this.prisma.article.findFirst({
        where: { id: dto.article_id, userId, deletedAt: null },
        select: { id: true, title: true, targetKeyword: true },
      });
      if (!article) {
        throw new NotFoundException({
          code: ErrorCode.RESOURCE_NOT_FOUND,
          message: 'Không tìm thấy article_id',
        });
      }
      articleContext = { id: article.id, title: article.title, keyword: article.targetKeyword };
    }

    // Steps 4-7 — per-image resize + upload + alt + persist.
    const persisted: ImageRecord[] = [];
    let storageStub = !this.storage.available;
    for (const img of genResult.images) {
      const record = await this.processSingleImage({
        userId,
        img,
        prompt: augmentedPrompt,
        style,
        aspectRatio,
        modelUsed: genResult.model_used,
        cost: genResult.cost_usd / Math.max(1, genResult.images.length),
        article: articleContext,
        variant: 'in-content',
        altOverride: dto.alt_text,
      });
      persisted.push(record);
      if (!record.url.startsWith('stub://')) storageStub = false;
    }

    return {
      images: persisted,
      stats: {
        count: persisted.length,
        cost_usd: genResult.cost_usd,
        duration_ms: Date.now() - started,
        provider_stub: genResult.is_stub,
        storage_stub: storageStub,
        safety_method: safety.method,
      },
    };
  }

  async generateForArticle(
    dto: GenerateForArticleDto,
    userId: string,
  ): Promise<GenerateForArticleResponse> {
    const started = Date.now();
    const article = await this.prisma.article.findFirst({
      where: { id: dto.article_id, userId, deletedAt: null },
    });
    if (!article) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Không tìm thấy bài viết',
      });
    }

    const style: ImageStyle = dto.style ?? 'mkt-brand';
    const includeFeatured = dto.include_featured !== false;
    const maxInContent = dto.max_in_content ?? 4;
    const model = dto.model ?? this.defaultModel();
    const keyword = article.targetKeyword ?? '';

    // Build the prompt list — featured uses the title, in-content one per H2.
    const outline = (article.outlineJson as { sections?: { h2: string }[] } | null) ?? null;
    const h2s = (outline?.sections ?? []).map((s) => s.h2).slice(0, maxInContent);

    const tasks: Array<{
      prompt: string;
      variant: 'featured' | 'in-content';
      aspect: ImageAspectRatio;
    }> = [];
    if (includeFeatured) {
      tasks.push({
        prompt: `${article.title} — ảnh featured cho bài viết SEO`,
        variant: 'featured',
        aspect: '16:9',
      });
    }
    for (const h2 of h2s) {
      tasks.push({
        prompt: `${article.title} — minh hoạ section "${h2}"`,
        variant: 'in-content',
        aspect: '16:9',
      });
    }

    const provider = this.pickProvider(model);
    let storageStub = !this.storage.available;
    let totalCost = 0;
    let providerStub = false;
    const records: ImageRecord[] = [];
    let featuredId: string | null = null;

    for (const task of tasks) {
      const safety = await this.safety.check(task.prompt);
      if (!safety.safe) {
        this.logger.warn(`Skipping unsafe prompt for ${task.variant}: ${safety.reason}`);
        continue;
      }
      const augmented = `${safety.cleaned_prompt}. ${STYLE_PRESETS[style]}`.slice(0, 1000);
      const genResult: ImageGenerateResult = await provider.generate({
        prompt: augmented,
        style,
        aspectRatio: task.aspect,
        count: 1,
        model,
      });
      totalCost += genResult.cost_usd;
      providerStub = providerStub || genResult.is_stub;

      for (const img of genResult.images) {
        const record = await this.processSingleImage({
          userId,
          img,
          prompt: augmented,
          style,
          aspectRatio: task.aspect,
          modelUsed: genResult.model_used,
          cost: genResult.cost_usd,
          article: { id: article.id, title: article.title, keyword },
          variant: task.variant,
        });
        records.push(record);
        if (!record.url.startsWith('stub://')) storageStub = false;
        if (task.variant === 'featured' && !featuredId) featuredId = record.id;
      }
    }

    // Persist featured_image_id on the article (Section 7 column).
    if (featuredId) {
      await this.prisma.article.update({
        where: { id: article.id },
        data: { featuredImageId: featuredId },
      });
    }

    return {
      article_id: article.id,
      featured_image_id: featuredId,
      images: records,
      stats: {
        count: records.length,
        cost_usd: totalCost,
        duration_ms: Date.now() - started,
        provider_stub: providerStub,
        storage_stub: storageStub,
        safety_method: 'rule',
      },
    };
  }

  async generateFromPromptSuggestions(
    args: {
      article_id: string;
      prompts: GenerateFromPromptSuggestion[];
      style?: ImageStyle;
      model?: ImageModel;
    },
    userId: string,
  ): Promise<GenerateImageResponse> {
    const started = Date.now();
    const article = await this.prisma.article.findFirst({
      where: { id: args.article_id, userId, deletedAt: null },
    });
    if (!article) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Khong tim thay bai viet',
      });
    }

    const style: ImageStyle = args.style ?? 'mkt-brand';
    const model = args.model ?? this.defaultModel();
    const prompts = args.prompts
      .map((item) => ({
        prompt: item.prompt.trim(),
        alt_text: item.alt_text?.trim() || undefined,
      }))
      .filter((item) => item.prompt.length >= 5)
      .slice(0, 6);

    const provider = this.pickProvider(model);
    let storageStub = !this.storage.available;
    let totalCost = 0;
    let providerStub = false;
    const records: ImageRecord[] = [];

    for (const item of prompts) {
      const enrichedPrompt = `${item.prompt}. Minh hoa cho bai viet "${article.title}"${
        article.targetKeyword ? `, xoay quanh chu de ${article.targetKeyword}` : ''
      }`;
      const safety = await this.safety.check(enrichedPrompt);
      if (!safety.safe) {
        this.logger.warn(`Skipping unsafe prompt suggestion: ${safety.reason}`);
        continue;
      }

      const augmented = `${safety.cleaned_prompt}. ${STYLE_PRESETS[style]}`.slice(0, 1000);
      const genResult = await provider.generate({
        prompt: augmented,
        style,
        aspectRatio: '16:9',
        count: 1,
        model,
      });
      totalCost += genResult.cost_usd;
      providerStub = providerStub || genResult.is_stub;

      for (const img of genResult.images) {
        const record = await this.processSingleImage({
          userId,
          img,
          prompt: augmented,
          style,
          aspectRatio: '16:9',
          modelUsed: genResult.model_used,
          cost: genResult.cost_usd,
          article: { id: article.id, title: article.title, keyword: article.targetKeyword },
          variant: 'in-content',
          altOverride: item.alt_text,
        });
        records.push(record);
        if (!record.url.startsWith('stub://')) storageStub = false;
      }
    }

    return {
      images: records,
      stats: {
        count: records.length,
        cost_usd: totalCost,
        duration_ms: Date.now() - started,
        provider_stub: providerStub,
        storage_stub: storageStub,
        safety_method: 'rule',
      },
    };
  }

  async list(userId: string, articleId?: string): Promise<ImageRecord[]> {
    const rows = await this.prisma.image.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(articleId ? { articleId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map(this.toRecord);
  }

  async get(userId: string, id: string): Promise<ImageRecord> {
    const row = await this.prisma.image.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Không tìm thấy ảnh',
      });
    }
    return this.toRecord(row);
  }

  async remove(userId: string, id: string): Promise<{ id: string }> {
    await this.get(userId, id);
    await this.prisma.image.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { id };
  }

  // ----- internals -----

  private pickProvider(model: ImageModel): ImageProvider {
    const resolved = resolveImageModel(model);
    if (resolved === IMAGE_PROVIDER_DALLE) return this.dalle;
    if (resolved === IMAGE_PROVIDER_YESCALE) return this.yescale;
    return this.flux;
  }

  private defaultModel(): ImageModel {
    return this.yescale.available ? 'yescale-gpt-image-2' : 'flux-schnell';
  }

  private async processSingleImage(opts: {
    userId: string;
    img: GeneratedImage;
    prompt: string;
    style: ImageStyle;
    aspectRatio: ImageAspectRatio;
    modelUsed: string;
    cost: number;
    article: { id: string; title: string; keyword: string | null } | null;
    variant: 'featured' | 'in-content';
    altOverride?: string;
  }): Promise<ImageRecord> {
    // 4) Resize if we have bytes. When the provider only gave us a source
    //    URL, we *could* fetch & resize but stub mode (default for dev)
    //    already serves placehold.co at the right size — skip the round-trip
    //    unless storage is available + we have bytes.
    let bytes: Buffer | undefined = opts.img.bytes;
    let width = opts.img.width;
    let height = opts.img.height;

    if (bytes && this.storage.available) {
      const processed = await this.processor.resize(bytes, opts.variant, opts.aspectRatio);
      bytes = processed.bytes;
      width = processed.width;
      height = processed.height;
    }

    // 5) Upload (or pass through in stub mode).
    const key = `images/${opts.userId}/${uuidv7()}.png`;
    const upload = await this.storage.upload({
      bytes: bytes ?? Buffer.alloc(0),
      key,
      contentType: 'image/png',
      fallbackUrl: opts.img.source_url,
    });

    // 6) Alt text.
    const altResult = opts.altOverride
      ? { alt_text: opts.altOverride, cost_usd: 0, is_stub: false, method: 'rule' as const }
      : await this.altText.generate({
          prompt: opts.prompt,
          keyword: opts.article?.keyword ?? undefined,
          context: opts.article?.title,
        });

    // 7) Persist.
    const row = await this.prisma.image.create({
      data: {
        id: uuidv7(),
        userId: opts.userId,
        articleId: opts.article?.id ?? null,
        url: upload.url,
        thumbnailUrl: null,
        prompt: opts.prompt,
        altText: altResult.alt_text,
        style: opts.style,
        aspectRatio: opts.aspectRatio,
        width,
        height,
        fileSizeBytes: upload.size_bytes,
        modelUsed: opts.modelUsed,
        costUsd: opts.cost,
        metadataJson: {
          variant: opts.variant,
          provider_is_stub: !this.flux.available && opts.modelUsed.startsWith('flux'),
          storage_is_stub: upload.is_stub,
          alt_method: altResult.method,
        },
      },
    });

    await this.eventBus.emit('image.generated', {
      image_id: row.id,
      user_id: opts.userId,
      article_id: opts.article?.id ?? null,
      variant: opts.variant,
    });

    return this.toRecord(row);
  }

  private toRecord(row: {
    id: string;
    url: string;
    thumbnailUrl: string | null;
    prompt: string | null;
    altText: string | null;
    style: string | null;
    aspectRatio: string | null;
    width: number | null;
    height: number | null;
    fileSizeBytes: number | null;
    modelUsed: string | null;
    costUsd: { toNumber(): number } | number | null;
    articleId: string | null;
    createdAt: Date;
  }): ImageRecord {
    return {
      id: row.id,
      url: row.url,
      thumbnail_url: row.thumbnailUrl,
      prompt: row.prompt,
      alt_text: row.altText,
      style: row.style,
      aspect_ratio: row.aspectRatio,
      width: row.width,
      height: row.height,
      file_size_bytes: row.fileSizeBytes,
      model_used: row.modelUsed,
      cost_usd: typeof row.costUsd === 'number' ? row.costUsd : (row.costUsd?.toNumber?.() ?? 0),
      article_id: row.articleId,
      created_at: row.createdAt.toISOString(),
    };
  }

  // Hint for callers that ForbiddenException is exported here too (Section 11).
  static readonly _Forbidden = ForbiddenException;
}
