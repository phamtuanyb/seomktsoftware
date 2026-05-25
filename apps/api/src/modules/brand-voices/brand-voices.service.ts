import { Injectable, NotFoundException } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import { ErrorCode } from '@mkt-seo/shared';
import { PrismaService } from '../../common/services/prisma.service';
import { EventBusService } from '../../common/services/event-bus.service';
import type { CreateBrandVoiceDto, UpdateBrandVoiceDto } from './dto/create-brand-voice.dto';

export interface BrandVoiceListItem {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  sample_count: number;
  trained_at: string;
  created_at: string;
  updated_at: string;
}

export interface BrandVoiceDetail extends BrandVoiceListItem {
  profile_json: Record<string, unknown>;
  reference_articles: Array<{ title?: string; content: string }>;
}

/**
 * Section 8 TN5 — Brand Voice CRUD (read + create + update + delete + setDefault).
 *
 * The full training algorithm (Claude profile extraction from sample articles)
 * lands in a later sprint. For Sprint 5.6 we accept either:
 *   - a `profile_json` payload from the client (pre-built or manually crafted), OR
 *   - sample_articles only — in which case we persist a minimal placeholder
 *     profile so TN4 can still inject the reference articles for tone matching.
 *
 * Every read/write filters by user_id (Section 2 principle 5 — multi-tenant).
 */
@Injectable()
export class BrandVoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async list(userId: string): Promise<BrandVoiceListItem[]> {
    const rows = await this.prisma.brandVoice.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
    return rows.map((r) => this.toListItem(r));
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
    // Note: spec TN5 logic step 1 (fetch URLs) is wired in a later sprint.
    // For now we keep articles that have inline `content` and drop URL-only
    // ones so the row at least has *something* to reference.
    const articles = dto.sample_articles
      .filter((a) => typeof a.content === 'string' && a.content.length >= 500)
      .map((a) => ({ title: a.title?.trim() ?? null, content: a.content as string }));

    if (articles.length === 0) {
      throw new NotFoundException({
        code: ErrorCode.VALIDATION_ERROR,
        message:
          'Cần ít nhất 1 sample article có content ≥500 ký tự (URL fetching wired ở sprint sau).',
      });
    }

    const now = new Date();
    const profile = dto.profile_json ?? this.buildPlaceholderProfile(articles);

    // If is_default, unset other defaults first.
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
        profileJson: profile as unknown as object,
        referenceArticles: articles as unknown as object,
        isDefault: dto.is_default ?? false,
        trainedAt: now,
      },
    });

    await this.eventBus.emit('brand_voice.trained', {
      brand_voice_id: created.id,
      user_id: userId,
      sample_count: articles.length,
    });

    return this.toDetail(created);
  }

  async update(userId: string, id: string, dto: UpdateBrandVoiceDto): Promise<BrandVoiceDetail> {
    await this.get(userId, id); // existence + ownership check
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

  // ----- helpers -----

  private buildPlaceholderProfile(
    articles: Array<{ title: string | null; content: string }>,
  ): Record<string, unknown> {
    // Heuristic profile so TN4 has something to inject. The real Claude-based
    // analyzer is Sprint 7+.
    const sample = articles[0]?.content ?? '';
    const sentences = sample.split(/[.!?]\s+/).filter(Boolean);
    const totalWords = sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0);
    const avgWordsPerSentence =
      sentences.length > 0 ? Math.round(totalWords / sentences.length) : 18;
    const usesEmoji = /\p{Extended_Pictographic}/u.test(sample);

    return {
      tone: { primary: 'neutral-professional', secondary: [], confidence: 0.5 },
      sentence_structure: {
        avg_words_per_sentence: avgWordsPerSentence,
        short_sentences_pct: 30,
        long_sentences_pct: 30,
      },
      addressing: { primary: /\bbạn\b/i.test(sample) ? 'bạn' : 'người đọc', formality: 'medium' },
      signature_phrases: [],
      vocabulary: { complexity: 'medium', domain_terms: [] },
      emoji_usage: {
        enabled: usesEmoji,
        density: usesEmoji ? 'sparse' : 'none',
        common_emojis: [],
      },
      patterns: {
        opening_style: 'hook-then-context',
        closing_style: 'summary-cta',
        cta_style: 'soft',
      },
      _meta: {
        algorithm: 'placeholder-heuristic',
        upgraded_to_real_at: null,
      },
    };
  }

  private toListItem(row: {
    id: string;
    name: string;
    description: string | null;
    isDefault: boolean;
    referenceArticles: unknown;
    trainedAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }): BrandVoiceListItem {
    const samples = Array.isArray(row.referenceArticles) ? row.referenceArticles.length : 0;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      is_default: row.isDefault,
      sample_count: samples,
      trained_at: row.trainedAt.toISOString(),
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    };
  }

  private toDetail(row: {
    id: string;
    name: string;
    description: string | null;
    isDefault: boolean;
    profileJson: unknown;
    referenceArticles: unknown;
    trainedAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }): BrandVoiceDetail {
    return {
      ...this.toListItem(row),
      profile_json: (row.profileJson as Record<string, unknown>) ?? {},
      reference_articles: Array.isArray(row.referenceArticles)
        ? (row.referenceArticles as Array<{ title?: string; content: string }>)
        : [],
    };
  }
}
