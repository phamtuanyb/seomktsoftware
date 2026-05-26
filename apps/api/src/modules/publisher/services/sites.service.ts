import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import { ErrorCode } from '@mkt-seo/shared';
import { PrismaService } from '../../../common/services/prisma.service';
import { CryptoService } from '../../../common/services/crypto.service';
import { QuotaService } from '../../../common/services/quota.service';
import { WordPressAdapter } from '../adapters/wordpress.adapter';
import {
  PUBLISHER_ADAPTERS,
  type PublisherAdapter,
  type PublisherType,
  type SiteCredentials,
  type TestConnectionResult,
} from '../adapters/publisher.interface';
import type { CreateSiteDto, UpdateSiteDto } from '../dto/site.dto';

export interface SiteSummary {
  id: string;
  url: string;
  name: string | null;
  username: string | null;
  type: string;
  status: string;
  plugin_seo_detected: string | null;
  last_check_at: string | null;
  last_publish_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Section 8 TN8 — Sites management.
 *
 * Credential lifecycle:
 *   - Plaintext WP Application Password arrives in the request → encrypted
 *     via CryptoService (AES-256-GCM, Section 17) → stored in
 *     sites.credentials_encrypted.
 *   - On every publish/test we decrypt + build SiteCredentials and pass
 *     into the adapter. Plaintext never crosses module boundaries.
 *
 * Quotas: spec Section 10 caps `sites` per plan tier. Enforced on create.
 */
@Injectable()
export class SitesService {
  private readonly logger = new Logger(SitesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly quotas: QuotaService,
    private readonly wp: WordPressAdapter,
    @Inject(PUBLISHER_ADAPTERS) private readonly registry: PublisherAdapter[],
  ) {}

  async list(userId: string): Promise<SiteSummary[]> {
    const rows = await this.prisma.site.findMany({
      where: { userId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(this.toSummary);
  }

  async get(userId: string, id: string): Promise<SiteSummary> {
    const row = await this.prisma.site.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Không tìm thấy site',
      });
    }
    return this.toSummary(row);
  }

  async create(userId: string, dto: CreateSiteDto): Promise<SiteSummary> {
    // Quota gate.
    const quotaCheck = await this.quotas.checkQuota(userId, 'sites', 1);
    if (!quotaCheck.allowed) {
      throw new ForbiddenException({
        code: ErrorCode.QUOTA_EXCEEDED,
        message: `Đã đạt hạn mức sites (${quotaCheck.used}/${quotaCheck.limit}).`,
      });
    }

    const credsPayload = JSON.stringify({
      username: dto.username,
      application_password: dto.application_password,
    });
    const credentialsEncrypted = this.crypto.encrypt(credsPayload);

    // Run a connection probe so the user sees the SEO plugin info right
    // away (best-effort — failure becomes status='error' but the row is
    // still created so the user can fix and retry).
    const probe = await this.runProbe({
      url: dto.url,
      username: dto.username,
      application_password: dto.application_password,
    });

    const row = await this.prisma.site.create({
      data: {
        id: uuidv7(),
        userId,
        url: dto.url,
        type: dto.type ?? 'wordpress',
        username: dto.username,
        credentialsEncrypted,
        status: probe.ok ? 'active' : 'error',
        pluginSeoDetected: probe.seo_plugin ?? null,
        metadataJson: {
          site_name: probe.site_info?.name ?? dto.name ?? null,
          probe_reason: probe.reason ?? null,
        },
        lastCheckAt: new Date(),
      },
    });
    await this.quotas.consumeQuota(userId, 'sites', 1);
    return this.toSummary(row);
  }

  async update(userId: string, id: string, dto: UpdateSiteDto): Promise<SiteSummary> {
    const existing = await this.prisma.site.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!existing) throw this.notFound();

    let credentialsEncrypted: string | undefined;
    let username = dto.username ?? existing.username;
    if (dto.application_password) {
      credentialsEncrypted = this.crypto.encrypt(
        JSON.stringify({
          username: username ?? existing.username,
          application_password: dto.application_password,
        }),
      );
    } else if (dto.username && dto.username !== existing.username) {
      // Username rotated without password change — re-encrypt with the
      // existing decrypted password to keep both consistent.
      const current = JSON.parse(this.crypto.decrypt(existing.credentialsEncrypted)) as {
        application_password?: string;
      };
      credentialsEncrypted = this.crypto.encrypt(
        JSON.stringify({
          username: dto.username,
          application_password: current.application_password,
        }),
      );
      username = dto.username;
    }

    const updated = await this.prisma.site.update({
      where: { id },
      data: {
        url: dto.url ?? undefined,
        username: dto.username ?? undefined,
        credentialsEncrypted: credentialsEncrypted ?? undefined,
        metadataJson: dto.name
          ? { ...(existing.metadataJson as object | null), site_name: dto.name }
          : undefined,
      },
    });
    return this.toSummary(updated);
  }

  async remove(userId: string, id: string): Promise<{ id: string }> {
    await this.get(userId, id);
    await this.prisma.site.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id };
  }

  /** Decrypt + probe the site; persist updated status / detected plugin. */
  async test(userId: string, id: string): Promise<TestConnectionResult> {
    const row = await this.prisma.site.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!row) throw this.notFound();
    const creds = this.loadCredentials(row.credentialsEncrypted, row.url);
    const result = await this.runProbe(creds, row.type);

    await this.prisma.site.update({
      where: { id },
      data: {
        status: result.ok ? 'active' : 'error',
        pluginSeoDetected: result.seo_plugin ?? null,
        lastCheckAt: new Date(),
        metadataJson: {
          ...(row.metadataJson as object | null),
          probe_reason: result.reason ?? null,
          site_name: result.site_info?.name ?? null,
        },
      },
    });
    return result;
  }

  /** Used by PublisherService — returns ({ adapter, credentials }). */
  async loadForPublish(
    userId: string,
    siteId: string,
  ): Promise<{
    adapter: PublisherAdapter;
    credentials: SiteCredentials;
    site: { id: string; type: string; pluginSeoDetected: string | null };
  }> {
    const row = await this.prisma.site.findFirst({
      where: { id: siteId, userId, deletedAt: null },
    });
    if (!row) throw this.notFound();
    const credentials = this.loadCredentials(row.credentialsEncrypted, row.url);
    const adapter = this.pickAdapter(row.type);
    return { adapter, credentials, site: row };
  }

  // ----- internals -----

  private pickAdapter(type: string): PublisherAdapter {
    const match = this.registry.find((a) => a.type === type);
    if (match) return match;
    // Fallback for legacy rows.
    return this.wp;
  }

  private loadCredentials(encrypted: string, url: string): SiteCredentials {
    const parsed = JSON.parse(this.crypto.decrypt(encrypted)) as {
      username?: string;
      application_password?: string;
    };
    return {
      url,
      username: parsed.username,
      application_password: parsed.application_password,
    };
  }

  private async runProbe(
    creds: SiteCredentials,
    type: PublisherType | string = 'wordpress',
  ): Promise<TestConnectionResult> {
    try {
      const adapter = this.pickAdapter(type);
      return await adapter.testConnection(creds);
    } catch (err) {
      this.logger.warn(`Probe failed: ${(err as Error).message}`);
      return { ok: false, reason: (err as Error).message };
    }
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: ErrorCode.RESOURCE_NOT_FOUND,
      message: 'Không tìm thấy site',
    });
  }

  private toSummary(row: {
    id: string;
    url: string;
    type: string;
    username: string | null;
    status: string;
    pluginSeoDetected: string | null;
    lastCheckAt: Date | null;
    lastPublishAt: Date | null;
    metadataJson: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): SiteSummary {
    const meta = (row.metadataJson as { site_name?: string } | null) ?? null;
    return {
      id: row.id,
      url: row.url,
      name: meta?.site_name ?? null,
      username: row.username,
      type: row.type,
      status: row.status,
      plugin_seo_detected: row.pluginSeoDetected,
      last_check_at: row.lastCheckAt?.toISOString() ?? null,
      last_publish_at: row.lastPublishAt?.toISOString() ?? null,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    };
  }
}
