import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/services/prisma.service';
import { CryptoService } from '../../common/services/crypto.service';
import {
  defaultModelForProvider,
  isPlaceholderKey,
  PROVIDER_MODEL_OPTIONS,
  resolveModel,
  type LlmModel,
  type ProviderModel,
} from '../content/providers/llm-provider.interface';
import {
  type AiProviderConfigDto,
  type AiProviderName,
  type UpdateAiSettingsDto,
} from './dto/ai-settings.dto';

interface StoredProviderMeta {
  id: string;
  label: string;
  model: ProviderModel;
  is_default: boolean;
  key_preview: string;
  updated_at: string;
}

interface StoredProviderSecret {
  id: string;
  api_key: string;
}

export interface AiProviderConfigResponse {
  id: string;
  label: string;
  model: ProviderModel;
  model_label: string;
  is_default: boolean;
  configured: boolean;
  source: 'admin' | 'env';
  key_preview: string;
  editable: boolean;
  deletable: boolean;
  updated_at: string | null;
}

export interface AiSettingsResponse {
  default_provider: AiProviderName;
  providers: Record<
    AiProviderName,
    {
      configured: boolean;
      source: 'admin' | 'env' | 'missing';
      configs: AiProviderConfigResponse[];
    }
  >;
  updated_at: string | null;
}

interface RuntimeProviderConfig {
  model: ProviderModel;
  apiKey?: string;
}

@Injectable()
export class AiSettingsService implements OnModuleInit {
  private readonly logger = new Logger(AiSettingsService.name);
  private defaultProvider: AiProviderName = 'claude';
  private readonly adminConfigs: Record<
    AiProviderName,
    Array<{
      id: string;
      label: string;
      model: ProviderModel;
      is_default: boolean;
      key: string;
      key_preview: string;
      updated_at: string;
    }>
  > = {
    claude: [],
    openai: [],
    gemini: [],
    yescale: [],
  };

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
    return Boolean(this.pickAdminConfig(provider)?.key) || !isPlaceholderKey(this.envKey(provider));
  }

  async getApiKey(provider: AiProviderName): Promise<string | undefined> {
    return (await this.getRuntimeConfig(provider)).apiKey;
  }

  async getRuntimeConfig(
    provider: AiProviderName,
    requestedModel?: LlmModel,
  ): Promise<RuntimeProviderConfig> {
    if (this.adminConfigs[provider].length === 0) {
      await this.refreshCache();
    }
    const selected = this.pickAdminConfig(provider);
    const apiKey = selected?.key ?? this.validEnvKey(provider);
    return {
      model:
        requestedModel && requestedModel !== 'stub'
          ? requestedModel
          : (selected?.model ?? defaultModelForProvider(provider)),
      apiKey,
    };
  }

  async getSettings(): Promise<AiSettingsResponse> {
    await this.refreshCache();
    const defaultRow = await this.prisma.appSetting.findUnique({
      where: { key: 'ai.default_provider' },
    });
    return {
      default_provider: this.defaultProvider,
      providers: {
        claude: this.providerState('claude'),
        openai: this.providerState('openai'),
        gemini: this.providerState('gemini'),
        yescale: this.providerState('yescale'),
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
      this.replaceProviderConfigs('claude', dto.claude_configs, adminId),
      this.replaceProviderConfigs('openai', dto.openai_configs, adminId),
      this.replaceProviderConfigs('gemini', dto.gemini_configs, adminId),
      this.replaceProviderConfigs('yescale', dto.yescale_configs, adminId),
    ]);

    await this.refreshCache();
    return this.getSettings();
  }

  private async replaceProviderConfigs(
    provider: AiProviderName,
    incoming: AiProviderConfigDto[] | undefined,
    adminId: string,
  ): Promise<void> {
    if (!incoming) return;

    const existing = this.adminConfigs[provider].length
      ? this.adminConfigs[provider]
      : await this.loadProviderConfigs(provider);

    const allowedModels = new Set(PROVIDER_MODEL_OPTIONS[provider]);
    const normalized = incoming.map((entry, index) => {
      const id = entry.id?.trim() || `cfg_${provider}_${Date.now()}_${index}`;
      const existingRow = existing.find((cfg) => cfg.id === id);
      const apiKey = entry.api_key?.trim() || existingRow?.key;
      if (!allowedModels.has(entry.model)) {
        throw new BadRequestException(`Model ${entry.model} khong hop le cho provider ${provider}`);
      }
      if (!apiKey) {
        throw new BadRequestException(
          `Config ${entry.label || id} cua ${provider} can api_key khi tao moi`,
        );
      }
      return {
        id,
        label: entry.label.trim(),
        model: entry.model,
        is_default: Boolean(entry.is_default),
        key: apiKey,
        key_preview: this.maskKey(apiKey),
        updated_at: new Date().toISOString(),
      };
    });

    if (normalized.length > 1 && normalized.filter((entry) => entry.is_default).length > 1) {
      throw new BadRequestException(`Provider ${provider} chi duoc co 1 config mac dinh`);
    }
    if (normalized.length > 0 && normalized.every((entry) => !entry.is_default)) {
      normalized[0]!.is_default = true;
    }

    const meta: StoredProviderMeta[] = normalized.map(
      ({ id, label, model, is_default, key_preview, updated_at }) => ({
        id,
        label,
        model,
        is_default,
        key_preview,
        updated_at,
      }),
    );
    const secrets: StoredProviderSecret[] = normalized.map(({ id, key }) => ({ id, api_key: key }));

    await this.prisma.appSetting.upsert({
      where: { key: `ai.${provider}.configs` },
      create: {
        key: `ai.${provider}.configs`,
        valueJson: { configs: meta },
        encryptedValue: this.crypto.encrypt(JSON.stringify(secrets)),
        updatedBy: adminId,
      },
      update: {
        valueJson: { configs: meta },
        encryptedValue: this.crypto.encrypt(JSON.stringify(secrets)),
        updatedBy: adminId,
      },
    });
  }

  private async refreshCache(): Promise<void> {
    const rows = await this.prisma.appSetting.findMany({
      where: {
        key: {
          in: [
            'ai.default_provider',
            'ai.claude.configs',
            'ai.claude.api_key',
            'ai.openai.configs',
            'ai.openai.api_key',
            'ai.gemini.configs',
            'ai.gemini.api_key',
            'ai.yescale.configs',
            'ai.yescale.api_key',
          ],
        },
      },
    });

    const defaultRow = rows.find((r) => r.key === 'ai.default_provider');
    const configured = (defaultRow?.valueJson as { provider?: AiProviderName } | null)?.provider;
    if (
      configured === 'claude' ||
      configured === 'openai' ||
      configured === 'gemini' ||
      configured === 'yescale'
    ) {
      this.defaultProvider = configured;
    }

    for (const provider of ['claude', 'openai', 'gemini', 'yescale'] as const) {
      const row = rows.find((r) => r.key === `ai.${provider}.configs`);
      const legacyRow = rows.find((r) => r.key === `ai.${provider}.api_key`);
      this.adminConfigs[provider] = this.deserializeConfigs(
        provider,
        row?.valueJson,
        row?.encryptedValue,
        legacyRow?.encryptedValue,
      );
    }
  }

  private async loadProviderConfigs(
    provider: AiProviderName,
  ): Promise<
    Array<{
      id: string;
      label: string;
      model: ProviderModel;
      is_default: boolean;
      key: string;
      key_preview: string;
      updated_at: string;
    }>
  > {
    const rows = await this.prisma.appSetting.findMany({
      where: { key: { in: [`ai.${provider}.configs`, `ai.${provider}.api_key`] } },
    });
    const row = rows.find((item) => item.key === `ai.${provider}.configs`);
    const legacyRow = rows.find((item) => item.key === `ai.${provider}.api_key`);
    return this.deserializeConfigs(
      provider,
      row?.valueJson,
      row?.encryptedValue,
      legacyRow?.encryptedValue,
    );
  }

  private deserializeConfigs(
    provider: AiProviderName,
    valueJson: unknown,
    encryptedValue: string | null | undefined,
    legacyEncryptedValue?: string | null | undefined,
  ): Array<{
    id: string;
    label: string;
    model: ProviderModel;
    is_default: boolean;
    key: string;
    key_preview: string;
    updated_at: string;
  }> {
    const meta = ((valueJson as { configs?: StoredProviderMeta[] } | null)?.configs ?? []).filter(
      (item): item is StoredProviderMeta =>
        Boolean(item?.id && item?.label && item?.model && item?.updated_at),
    );

    if (!encryptedValue) {
      const legacyKey = legacyEncryptedValue
        ? this.decryptLegacyKey(legacyEncryptedValue)
        : undefined;
      if (!legacyKey) return [];
      return [
        {
          id: `legacy-${provider}`,
          label: 'Legacy key',
          model: defaultModelForProvider(provider),
          is_default: true,
          key: legacyKey,
          key_preview: this.maskKey(legacyKey),
          updated_at: new Date().toISOString(),
        },
      ];
    }

    let secrets: StoredProviderSecret[] = [];
    try {
      secrets = JSON.parse(this.crypto.decrypt(encryptedValue)) as StoredProviderSecret[];
    } catch (err) {
      this.logger.warn(`Cannot decrypt AI config list: ${(err as Error).message}`);
      return [];
    }
    const secretById = new Map(secrets.map((secret) => [secret.id, secret.api_key]));

    return meta
      .map((item) => ({
        id: item.id,
        label: item.label,
        model: item.model,
        is_default: item.is_default,
        key: secretById.get(item.id) ?? '',
        key_preview: item.key_preview,
        updated_at: item.updated_at,
      }))
      .filter((item) => !isPlaceholderKey(item.key));
  }

  private decryptLegacyKey(encryptedValue: string): string | undefined {
    try {
      const key = this.crypto.decrypt(encryptedValue);
      return isPlaceholderKey(key) ? undefined : key;
    } catch (err) {
      this.logger.warn(`Cannot decrypt legacy AI key: ${(err as Error).message}`);
      return undefined;
    }
  }

  private providerState(provider: AiProviderName): AiSettingsResponse['providers'][AiProviderName] {
    const adminConfigs = this.adminConfigs[provider].map((config) => ({
      id: config.id,
      label: config.label,
      model: config.model,
      model_label: this.modelLabel(config.model),
      is_default: config.is_default,
      configured: true,
      source: 'admin' as const,
      key_preview: config.key_preview,
      editable: true,
      deletable: true,
      updated_at: config.updated_at,
    }));

    if (adminConfigs.length > 0) {
      return { configured: true, source: 'admin', configs: adminConfigs };
    }

    const envKey = this.validEnvKey(provider);
    if (envKey) {
      return {
        configured: true,
        source: 'env',
        configs: [
          {
            id: `env-${provider}`,
            label: 'ENV fallback',
            model: defaultModelForProvider(provider),
            model_label: this.modelLabel(defaultModelForProvider(provider)),
            is_default: true,
            configured: true,
            source: 'env',
            key_preview: this.maskKey(envKey),
            editable: false,
            deletable: false,
            updated_at: null,
          },
        ],
      };
    }

    return { configured: false, source: 'missing', configs: [] };
  }

  private pickAdminConfig(provider: AiProviderName) {
    return (
      this.adminConfigs[provider].find((config) => config.is_default) ??
      this.adminConfigs[provider][0]
    );
  }

  private validEnvKey(provider: AiProviderName): string | undefined {
    const key = this.envKey(provider);
    return isPlaceholderKey(key) ? undefined : key;
  }

  private envKey(provider: AiProviderName): string | undefined {
    if (provider === 'claude') {
      return this.cfg.get<string>('ai.anthropicApiKey') ?? process.env.ANTHROPIC_API_KEY;
    }
    if (provider === 'openai') {
      return this.cfg.get<string>('ai.openaiApiKey') ?? process.env.OPENAI_API_KEY;
    }
    if (provider === 'gemini') {
      return this.cfg.get<string>('ai.geminiApiKey') ?? process.env.GEMINI_API_KEY;
    }
    return this.cfg.get<string>('ai.yescaleApiKey') ?? process.env.YESCALE_API_KEY;
  }

  private maskKey(value: string): string {
    const trimmed = value.trim();
    if (trimmed.length <= 10) return `${trimmed.slice(0, 3)}***`;
    return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
  }

  private modelLabel(model: ProviderModel): string {
    const { apiModel } = resolveModel(model);
    return apiModel;
  }
}
