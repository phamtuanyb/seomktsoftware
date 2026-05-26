import { Injectable, NotFoundException } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import { ErrorCode } from '@mkt-seo/shared';
import { PrismaService } from '../../../common/services/prisma.service';
import type { KeywordSourceName } from '../providers/keyword-source.interface';
import type { AddKeywordsDto, CreateProjectDto, UpdateProjectDto } from '../dto/project.dto';

export interface ProjectListItem {
  id: string;
  name: string;
  seed_keyword: string | null;
  language: string;
  country: string;
  keyword_count: number;
  created_at: string;
  updated_at: string;
}

export interface KeywordRow {
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

/**
 * CRUD over keyword_projects + keywords (Section 7). Every read/write is
 * scoped by user_id (Section 2 principle 5 — multi-tenant).
 */
@Injectable()
export class KeywordProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<ProjectListItem[]> {
    const rows = await this.prisma.keywordProject.findMany({
      where: { userId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { keywords: true } } },
    });
    return rows.map((r) => this.toListItem(r));
  }

  async create(userId: string, dto: CreateProjectDto): Promise<ProjectListItem> {
    const row = await this.prisma.keywordProject.create({
      data: {
        id: uuidv7(),
        userId,
        name: dto.name,
        seedKeyword: dto.seed_keyword ?? null,
        language: dto.language ?? 'vi',
        country: dto.country ?? 'VN',
      },
      include: { _count: { select: { keywords: true } } },
    });
    return this.toListItem(row);
  }

  async get(userId: string, id: string): Promise<ProjectListItem> {
    const row = await this.prisma.keywordProject.findFirst({
      where: { id, userId, deletedAt: null },
      include: { _count: { select: { keywords: true } } },
    });
    if (!row) throw this.notFound();
    return this.toListItem(row);
  }

  async update(userId: string, id: string, dto: UpdateProjectDto): Promise<ProjectListItem> {
    await this.get(userId, id);
    const row = await this.prisma.keywordProject.update({
      where: { id },
      data: {
        name: dto.name,
        seedKeyword: dto.seed_keyword,
      },
      include: { _count: { select: { keywords: true } } },
    });
    return this.toListItem(row);
  }

  async remove(userId: string, id: string): Promise<{ id: string }> {
    await this.get(userId, id);
    await this.prisma.keywordProject.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { id };
  }

  /**
   * Bulk-insert keywords into a project. Trims + dedupes against existing
   * rows in the same project (project_id + keyword unique-on-write).
   */
  async addKeywords(
    userId: string,
    projectId: string,
    dto: AddKeywordsDto,
  ): Promise<{ inserted: number; skipped: number }> {
    await this.get(userId, projectId);
    // Dedupe input case-insensitively while keeping the first-seen casing.
    const seenLc = new Set<string>();
    const normalized: string[] = [];
    for (const raw of dto.keywords) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const lc = trimmed.toLowerCase();
      if (seenLc.has(lc)) continue;
      seenLc.add(lc);
      normalized.push(trimmed);
    }
    if (normalized.length === 0) return { inserted: 0, skipped: 0 };

    const existing = await this.prisma.keyword.findMany({
      where: { projectId, userId },
      select: { keyword: true },
    });
    const existingSet = new Set(existing.map((e) => e.keyword.toLowerCase()));
    const fresh = normalized.filter((k) => !existingSet.has(k.toLowerCase()));

    // Skipped reflects everything the user submitted that did not land —
    // both duplicates within the input batch and rows already in DB.
    const inputDuplicates = dto.keywords.length - normalized.length;
    const dbSkipped = normalized.length - fresh.length;

    if (fresh.length === 0) {
      return { inserted: 0, skipped: inputDuplicates + dbSkipped };
    }

    await this.prisma.keyword.createMany({
      data: fresh.map((keyword) => ({
        id: uuidv7(),
        userId,
        projectId,
        keyword,
        source: (dto.source ?? 'manual') as KeywordSourceName | 'manual',
      })),
    });

    return { inserted: fresh.length, skipped: inputDuplicates + dbSkipped };
  }

  async listKeywords(userId: string, projectId: string): Promise<KeywordRow[]> {
    await this.get(userId, projectId);
    const rows = await this.prisma.keyword.findMany({
      where: { userId, projectId },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
    return rows.map(this.toKeywordRow);
  }

  async removeKeyword(
    userId: string,
    projectId: string,
    keywordId: string,
  ): Promise<{ id: string }> {
    await this.get(userId, projectId);
    const row = await this.prisma.keyword.findFirst({
      where: { id: keywordId, projectId, userId },
    });
    if (!row) throw this.notFound();
    await this.prisma.keyword.delete({ where: { id: keywordId } });
    return { id: keywordId };
  }

  private toListItem(row: {
    id: string;
    name: string;
    seedKeyword: string | null;
    language: string;
    country: string;
    createdAt: Date;
    updatedAt: Date;
    _count: { keywords: number };
  }): ProjectListItem {
    return {
      id: row.id,
      name: row.name,
      seed_keyword: row.seedKeyword,
      language: row.language,
      country: row.country,
      keyword_count: row._count.keywords,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    };
  }

  private toKeywordRow(row: {
    id: string;
    keyword: string;
    source: string | null;
    volume: number | null;
    keywordDifficulty: number | null;
    cpc: { toNumber(): number } | number | null;
    intent: string | null;
    intentConfidence: { toNumber(): number } | number | null;
    analyzedAt: Date | null;
    createdAt: Date;
  }): KeywordRow {
    return {
      id: row.id,
      keyword: row.keyword,
      source: row.source,
      volume: row.volume,
      keyword_difficulty: row.keywordDifficulty,
      cpc: row.cpc == null ? null : typeof row.cpc === 'number' ? row.cpc : row.cpc.toNumber(),
      intent: row.intent,
      intent_confidence:
        row.intentConfidence == null
          ? null
          : typeof row.intentConfidence === 'number'
            ? row.intentConfidence
            : row.intentConfidence.toNumber(),
      analyzed_at: row.analyzedAt?.toISOString() ?? null,
      created_at: row.createdAt.toISOString(),
    };
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: ErrorCode.RESOURCE_NOT_FOUND,
      message: 'Không tìm thấy keyword project',
    });
  }
}
