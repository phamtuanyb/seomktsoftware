import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import { ErrorCode } from '@mkt-seo/shared';
import { PrismaService } from '../../common/services/prisma.service';
import { EventBusService } from '../../common/services/event-bus.service';
import type { CreateBrandVoiceDto, UpdateBrandVoiceDto } from './dto/create-brand-voice.dto';
import { ProfileTrainerService } from './services/profile-trainer.service';
import { UrlFetcherService } from './services/url-fetcher.service';
import type { ProfileMeta } from './schemas/profile.schema';

export interface BrandVoiceListItem {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  sample_count: number;
  trained_at: string;
  created_at: string;
  updated_at: string;
  /** Section 8 TN5 — surfaces 'claude-sonnet-4' vs 'placeholder-heuristic' badge in UI. */
  algorithm: ProfileMeta['algorithm'];
}

export interface BrandVoiceDetail extends BrandVoiceListItem {
  profile_json: Record<string, unknown>;
  reference_articles: Array<{ title?: string | null; content: string }>;
  meta: ProfileMeta;
}

const MIN_SAMPLE_WORDS = 3000;

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Section 8 TN5 — Brand Voice CRUD + Claude-based training.
 *
 * Pipeline on create / retrain:
 *   1. For each sample_article with `url` (and no inline content): fetch
 *      via UrlFetcherService (readability) → use extracted text.
 *   2. Drop articles still < 3000 words after step 1.
 *   3. Hand the cleaned articles to ProfileTrainerService → Claude
 *      Sonnet 4 returns a Zod-validated BrandVoiceProfile.
 *   4. Trainer also picks 3 reference articles (longest) so TN4 has
 *      substantive style to imitate.
 *   5. Persist profile + reference + meta (algorithm tag + tokens + cost).
 *
 * Multi-tenant: every read/write filters by user_id.
 */
@Injectable()
export class BrandVoicesService {
  private readonly logger = new Logger(BrandVoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly trainer: ProfileTrainerService,
    private readonly urlFetcher: UrlFetcherService,
  ) {}

  async list(userId: string): Promise<BrandVoiceListItem[]> {
    const rows = await this.prisma.brandVoice.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
    return rows.map((r) =>
      this.toListItem({
        id: r.id,
        name: r.name,
        description: r.description,
        isDefault: r.isDefault,
        referenceArticles: r.referenceArticles,
        metadataJson: r.metadataJson,
        trainedAt: r.trainedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }),
    );
  }

  async get(userId: string, id: string): Promise<BrandVoiceDetail> {
    const row = await this.prisma.brandVoice.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Không tìm thấy brand voice',
      });
    }
    return this.toDetail(row);
  }

  async create(userId: string, dto: CreateBrandVoiceDto): Promise<BrandVoiceDetail> {
    const articles = await this.collectArticles(dto.sample_articles);
    if (articles.length === 0) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: `Cần ít nhất 1 sample article có content ≥${MIN_SAMPLE_WORDS} từ (sau khi fetch URL nếu có).`,
      });
    }

    const now = new Date();
    let profileJson: Record<string, unknown>;
    let referenceArticles: Array<{ title: string | null; content: string }>;
    let meta: ProfileMeta;

    if (dto.profile_json) {
      // Caller supplied a hand-crafted profile — skip training but still
      // pick references via the trainer's longest-articles rule.
      const result = await this.trainer.train(articles);
      profileJson = dto.profile_json;
      referenceArticles = result.reference_articles;
      meta = {
        algorithm: 'placeholder-heuristic',
        upgraded_to_real_at: null,
        sample_count: articles.length,
        trained_at: now.toISOString(),
      };
    } else {
      const result = await this.trainer.train(articles);
      profileJson = result.profile as unknown as Record<string, unknown>;
      referenceArticles = result.reference_articles;
      meta = result.meta;
    }

    if (dto.is_default) {
      await this.prisma.brandVoice.updateMany({
        where: { userId, deletedAt: null, isDefault: true },
        data: { isDefault: false },
      });
    }

    const created = await this.prisma.brandVoice.create({
      data: {
        id: uuidv7(),
        userId,
        name: dto.name,
        description: dto.description ?? null,
        profileJson: profileJson as unknown as object,
        referenceArticles: referenceArticles as unknown as object,
        isDefault: dto.is_default ?? false,
        trainedAt: now,
        metadataJson: meta as unknown as object,
      },
    });

    await this.eventBus.emit('brand_voice.trained', {
      brand_voice_id: created.id,
      user_id: userId,
      sample_count: articles.length,
      algorithm: meta.algorithm,
    });

    return this.toDetail(created);
  }

  async update(userId: string, id: string, dto: UpdateBrandVoiceDto): Promise<BrandVoiceDetail> {
    await this.get(userId, id);
    if (dto.is_default === true) {
      await this.prisma.brandVoice.updateMany({
        where: { userId, deletedAt: null, isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
    }
    const updated = await this.prisma.brandVoice.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        isDefault: dto.is_default,
        profileJson:
          dto.profile_json !== undefined ? (dto.profile_json as unknown as object) : undefined,
      },
    });
    return this.toDetail(updated);
  }

  async remove(userId: string, id: string): Promise<{ id: string }> {
    await this.get(userId, id);
    await this.prisma.brandVoice.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { id };
  }

  /** Section 8 TN5 — re-train an existing brand voice from its current reference articles. */
  async retrain(userId: string, id: string): Promise<BrandVoiceDetail> {
    const row = await this.prisma.brandVoice.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Không tìm thấy brand voice',
      });
    }
    const articles = Array.isArray(row.referenceArticles)
      ? (row.referenceArticles as Array<{ title?: string | null; content: string }>)
      : [];
    if (articles.length === 0) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Brand voice không còn reference article để retrain.',
      });
    }

    const result = await this.trainer.train(articles);
    const updated = await this.prisma.brandVoice.update({
      where: { id },
      data: {
        profileJson: result.profile as unknown as object,
        referenceArticles: result.reference_articles as unknown as object,
        trainedAt: new Date(),
        metadataJson: result.meta as unknown as object,
      },
    });
    await this.eventBus.emit('brand_voice.trained', {
      brand_voice_id: id,
      user_id: userId,
      sample_count: articles.length,
      algorithm: result.meta.algorithm,
      retrain: true,
    });
    return this.toDetail(updated);
  }

  // ----- helpers -----

  /**
   * Section 8 TN5 step 1 — for each sample_article: prefer inline content,
   * else fetch URL via readability. Articles still empty after both paths
   * are silently dropped (the count cap is enforced at the controller).
   */
  private async collectArticles(
    samples: Array<{ title?: string; content?: string; url?: string }>,
  ): Promise<Array<{ title: string | null; content: string }>> {
    const out: Array<{ title: string | null; content: string }> = [];
    for (const sample of samples) {
      let content = (sample.content ?? '').trim();
      let title = sample.title?.trim() ?? null;
      if ((!content || countWords(content) < MIN_SAMPLE_WORDS) && sample.url) {
        try {
          const fetched = await this.urlFetcher.fetch(sample.url);
          content = fetched.content;
          if (!title) title = fetched.title;
        } catch (err) {
          this.logger.warn(`URL fetch failed for ${sample.url}: ${(err as Error).message}`);
        }
      }
      if (countWords(content) >= MIN_SAMPLE_WORDS) {
        out.push({ title, content });
      }
    }
    return out;
  }

  private toListItem(row: {
    id: string;
    name: string;
    description: string | null;
    isDefault: boolean;
    referenceArticles: unknown;
    metadataJson?: unknown;
    trainedAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }): BrandVoiceListItem {
    const samples = Array.isArray(row.referenceArticles) ? row.referenceArticles.length : 0;
    const meta = (row.metadataJson as ProfileMeta | null) ?? null;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      is_default: row.isDefault,
      sample_count: samples,
      trained_at: row.trainedAt.toISOString(),
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
      algorithm: meta?.algorithm ?? 'placeholder-heuristic',
    };
  }

  private toDetail(row: {
    id: string;
    name: string;
    description: string | null;
    isDefault: boolean;
    profileJson: unknown;
    referenceArticles: unknown;
    metadataJson: unknown;
    trainedAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }): BrandVoiceDetail {
    const meta = (row.metadataJson as ProfileMeta | null) ?? {
      algorithm: 'placeholder-heuristic',
      upgraded_to_real_at: null,
      sample_count: 0,
      trained_at: row.trainedAt.toISOString(),
    };
    return {
      ...this.toListItem(row),
      profile_json: (row.profileJson as Record<string, unknown>) ?? {},
      reference_articles: Array.isArray(row.referenceArticles)
        ? (row.referenceArticles as Array<{ title?: string | null; content: string }>)
        : [],
      meta,
    };
  }
}
