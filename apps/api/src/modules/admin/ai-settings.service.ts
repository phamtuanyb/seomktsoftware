import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/services/prisma.service';
import { CryptoService } from '../../common/services/crypto.service';
import { isPlaceholderKey } from '../content/providers/llm-provider.interface';
import type { AiProviderName, UpdateAiSettingsDto } from './dto/ai-settings.dto';

export interface AiSettingsResponse {
  default_provider: AiProviderName;
  providers: Record<AiProviderName, { configured: boolean; source: 'admin' | 'env' | 'missing' }>;
  updated_at: string | null;
}

@Injectable()
export class AiSettingsService implements OnModuleInit {
  private readonly logger = new Logger(AiSettingsService.name);
  private defaultProvider: AiProviderName = 'claude';
  private readonly adminKeys: Partial<Record<AiProviderName, string>> = {};

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly cfg: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refreshCache().catch((err) => {
      this.logger.warn(`Cannot preload AI settings: ${(err as Error).message}`);
    });
  }

  getCachedDefaultProvider(): AiProviderName {
    return this.defaultProvider;
  }

  hasConfiguredKey(provider: AiProviderName): boolean {
    return !isPlaceholderKey(this.adminKeys[provider] ?? this.envKey(provider));
  }

  async getApiKey(provider: AiProviderName): Promise<string | undefined> {
    if (!this.adminKeys[provider]) {
      await this.refreshCache();
    }
    const key = this.adminKeys[provider] ?? this.envKey(provider);
    return isPlaceholderKey(key) ? undefined : key;
  }

  async getSettings(): Promise<AiSettingsResponse> {
    await this.refreshCache();
    const defaultRow = await this.prisma.appSetting.findUnique({
      where: { key: 'ai.default_provider' },
    });
    return {
      default_provider: this.defaultProvider,
      providers: {
        claude: this.providerStatus('claude'),
        openai: this.providerStatus('openai'),
        gemini: this.providerStatus('gemini'),
      },
      updated_at: defaultRow?.updatedAt?.toISOString() ?? null,
    };
  }

  async updateSettings(adminId: string, dto: UpdateAiSettingsDto): Promise<AiSettingsResponse> {
    if (dto.default_provider) {
      await this.prisma.appSetting.upsert({
        where: { key: 'ai.default_provider' },
        create: {
          key: 'ai.default_provider',
          valueJson: { provider: dto.default_provider },
          updatedBy: adminId,
        },
        update: {
          valueJson: { provider: dto.default_provider },
          updatedBy: adminId,
        },
      });
    }

    await Promise.all([
      this.upsertSecret('claude', dto.claude_api_key, adminId),
      this.upsertSecret('openai', dto.openai_api_key, adminId),
      this.upsertSecret('gemini', dto.gemini_api_key, adminId),
    ]);

    await this.refreshCache();
    return this.getSettings();
  }

  private async upsertSecret(
    provider: AiProviderName,
    value: string | undefined,
    adminId: string,
  ): Promise<void> {
    if (value === undefined || value.trim() === '') return;
    await this.prisma.appSetting.upsert({
      where: { key: `ai.${provider}.api_key` },
      create: {
        key: `ai.${provider}.api_key`,
        encryptedValue: this.crypto.encrypt(value.trim()),
        updatedBy: adminId,
      },
      update: {
        encryptedValue: this.crypto.encrypt(value.trim()),
        updatedBy: adminId,
      },
    });
  }

  private async refreshCache(): Promise<void> {
    const rows = await this.prisma.appSetting.findMany({
      where: { key: { in: ['ai.default_provider', 'ai.claude.api_key', 'ai.openai.api_key', 'ai.gemini.api_key'] } },
    });
    const defaultRow = rows.find((r) => r.key === 'ai.default_provider');
    const configured = (defaultRow?.valueJson as { provider?: AiProviderName } | null)?.provider;
    if (configured === 'claude' || configured === 'openai' || configured === 'gemini') {
      this.defaultProvider = configured;
    }

    for (const provider of ['claude', 'openai', 'gemini'] as const) {
      const row = rows.find((r) => r.key === `ai.${provider}.api_key`);
      this.adminKeys[provider] = row?.encryptedValue ? this.crypto.decrypt(row.encryptedValue) : undefined;
    }
  }

  private providerStatus(provider: AiProviderName): AiSettingsResponse['providers'][AiProviderName] {
    if (!isPlaceholderKey(this.adminKeys[provider])) return { configured: true, source: 'admin' };
    if (!isPlaceholderKey(this.envKey(provider))) return { configured: true, source: 'env' };
    return { configured: false, source: 'missing' };
  }

  private envKey(provider: AiProviderName): string | undefined {
    if (provider === 'claude') return this.cfg.get<string>('ai.anthropicApiKey') ?? process.env.ANTHROPIC_API_KEY;
    if (provider === 'openai') return this.cfg.get<string>('ai.openaiApiKey') ?? process.env.OPENAI_API_KEY;
    return this.cfg.get<string>('ai.geminiApiKey') ?? process.env.GEMINI_API_KEY;
  }
}
