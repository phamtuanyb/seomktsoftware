'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  adminApi,
  type AdminStats,
  type AiProviderConfig,
  type AiProviderConfigInput,
  type AiProviderName,
  type AiSettings,
  type ProviderModel,
} from '@/lib/api/admin';

type EditableProviderConfig = {
  id?: string;
  label: string;
  model: ProviderModel;
  api_key: string;
  is_default: boolean;
  editable: boolean;
  deletable: boolean;
  source: 'admin' | 'env';
  key_preview?: string;
  updated_at?: string | null;
};

const PROVIDER_LABELS: Record<AiProviderName, string> = {
  claude: 'Claude',
  openai: 'OpenAI',
  gemini: 'Gemini',
  yescale: 'Yescale',
};

const MODEL_OPTIONS: Record<AiProviderName, Array<{ value: ProviderModel; label: string }>> = {
  claude: [
    { value: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
    { value: 'claude-haiku', label: 'Claude Haiku' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  ],
  gemini: [
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  ],
  yescale: [{ value: 'yescale-gpt-4.1-mini', label: 'Yescale GPT-4.1 Mini' }],
};

const DEFAULT_MODEL: Record<AiProviderName, ProviderModel> = {
  claude: 'claude-sonnet-4',
  openai: 'gpt-4o',
  gemini: 'gemini-1.5-pro',
  yescale: 'yescale-gpt-4.1-mini',
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [aiSettings, setAiSettings] = useState<AiSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingAi, setSavingAi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiSuccess, setAiSuccess] = useState<string | null>(null);
  const [defaultProvider, setDefaultProvider] = useState<AiProviderName>('claude');
  const [configsByProvider, setConfigsByProvider] = useState<
    Record<AiProviderName, EditableProviderConfig[]>
  >({
    claude: [],
    openai: [],
    gemini: [],
    yescale: [],
  });

  useEffect(() => {
    Promise.all([adminApi.stats(), adminApi.getAiSettings()])
      .then(([statsRes, aiRes]) => {
        setStats(statsRes);
        applyAiSettings(aiRes);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  function applyAiSettings(next: AiSettings) {
    setAiSettings(next);
    setDefaultProvider(next.default_provider);
    setConfigsByProvider({
      claude: toEditableConfigs(next.providers.claude.configs),
      openai: toEditableConfigs(next.providers.openai.configs),
      gemini: toEditableConfigs(next.providers.gemini.configs),
      yescale: toEditableConfigs(next.providers.yescale.configs),
    });
  }

  async function saveAiSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingAi(true);
    setError(null);
    setAiSuccess(null);
    try {
      const updated = await adminApi.updateAiSettings({
        default_provider: defaultProvider,
        claude_configs: toPayload(configsByProvider.claude),
        openai_configs: toPayload(configsByProvider.openai),
        gemini_configs: toPayload(configsByProvider.gemini),
        yescale_configs: toPayload(configsByProvider.yescale),
      });
      applyAiSettings(updated);
      setAiSuccess('Đã lưu danh sách API key và model cho các provider.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingAi(false);
    }
  }

  function updateConfig(
    provider: AiProviderName,
    index: number,
    patch: Partial<EditableProviderConfig>,
  ) {
    setConfigsByProvider((current) => ({
      ...current,
      [provider]: current[provider].map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  }

  function addConfig(provider: AiProviderName) {
    setConfigsByProvider((current) => ({
      ...current,
      [provider]: [
        ...current[provider].filter((item) => item.source === 'admin'),
        {
          label: '',
          model: DEFAULT_MODEL[provider],
          api_key: '',
          is_default: current[provider].filter((item) => item.source === 'admin').length === 0,
          editable: true,
          deletable: true,
          source: 'admin',
        },
        ...current[provider].filter((item) => item.source !== 'admin'),
      ],
    }));
  }

  function deleteConfig(provider: AiProviderName, index: number) {
    setConfigsByProvider((current) => {
      const kept = current[provider].filter((_, itemIndex) => itemIndex !== index);
      const adminOnly = kept.filter((item) => item.source === 'admin');
      if (adminOnly.length > 0 && adminOnly.every((item) => !item.is_default)) {
        adminOnly[0] = { ...adminOnly[0], is_default: true };
      }
      return {
        ...current,
        [provider]: [...adminOnly, ...kept.filter((item) => item.source !== 'admin')],
      };
    });
  }

  function markDefault(provider: AiProviderName, index: number) {
    setConfigsByProvider((current) => ({
      ...current,
      [provider]: current[provider].map((item, itemIndex) =>
        item.source === 'admin' ? { ...item, is_default: itemIndex === index } : item,
      ),
    }));
  }

  const providerCards = useMemo(
    () =>
      (['claude', 'openai', 'gemini', 'yescale'] as const).map((provider) => ({
        provider,
        label: PROVIDER_LABELS[provider],
        status: aiSettings?.providers[provider],
        configs: configsByProvider[provider],
      })),
    [aiSettings, configsByProvider],
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }
  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Quản lý provider AI, danh sách API key và model dùng cho luồng outline/viết bài.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/users">
            Quản lý người dùng <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Người dùng"
          value={stats.users.total}
          sub={`${stats.users.deleted} đã xoá`}
        />
        <StatCard
          title="Hoạt động (30 ngày)"
          value={stats.users.active_last_30d}
          sub="user đã tạo bài viết"
        />
        <StatCard
          title="Bài viết"
          value={stats.articles.total}
          sub={`+${stats.articles.last_30d} trong 30 ngày`}
        />
        <StatCard
          title="Publish jobs"
          value={stats.publish_jobs.total}
          sub={`${stats.publish_jobs.succeeded} ok · ${stats.publish_jobs.failed} fail · ${stats.publish_jobs.pending} pending`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cấu hình AI viết bài</CardTitle>
          <CardDescription>
            Mỗi provider có thể lưu nhiều key-model. Bạn có thể đặt config mặc định, sửa model, thêm
            key mới hoặc xoá config cũ.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveAiSettings} className="space-y-6">
            <div className="max-w-sm space-y-2">
              <label htmlFor="ai-provider" className="text-sm font-medium">
                Provider mặc định
              </label>
              <select
                id="ai-provider"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={defaultProvider}
                onChange={(e) => setDefaultProvider(e.target.value as AiProviderName)}
              >
                <option value="claude">Claude</option>
                <option value="openai">OpenAI</option>
                <option value="gemini">Gemini</option>
                <option value="yescale">Yescale</option>
              </select>
            </div>

            <div className="space-y-4">
              {providerCards.map(({ provider, label, status, configs }) => (
                <Card key={provider} className="border-dashed">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-lg">{label}</CardTitle>
                        <CardDescription>
                          {status?.configured
                            ? `Đã cấu hình (${status.source})`
                            : 'Chưa có key khả dụng'}
                        </CardDescription>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addConfig(provider)}
                      >
                        <Plus className="mr-2 h-4 w-4" /> Thêm key
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {configs.length === 0 ? (
                      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                        Chưa có config nào.
                      </div>
                    ) : (
                      configs.map((config, index) => (
                        <div
                          key={config.id ?? `${provider}-${index}`}
                          className="rounded-lg border p-4"
                        >
                          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1.4fr_auto]">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Tên key</label>
                              <Input
                                value={config.label}
                                onChange={(e) =>
                                  updateConfig(provider, index, { label: e.target.value })
                                }
                                disabled={!config.editable}
                                placeholder="Ví dụ: Team SEO 1"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Model</label>
                              <select
                                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                value={config.model}
                                onChange={(e) =>
                                  updateConfig(provider, index, {
                                    model: e.target.value as ProviderModel,
                                  })
                                }
                                disabled={!config.editable}
                              >
                                {MODEL_OPTIONS[provider].map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">
                                {config.source === 'admin' ? 'API key mới / thay key' : 'API key'}
                              </label>
                              <Input
                                type="password"
                                value={config.api_key}
                                onChange={(e) =>
                                  updateConfig(provider, index, { api_key: e.target.value })
                                }
                                disabled={!config.editable}
                                placeholder={
                                  config.source === 'admin'
                                    ? config.key_preview
                                      ? `${config.key_preview} · để trống nếu giữ nguyên`
                                      : 'Nhập API key'
                                    : config.key_preview
                                }
                                autoComplete="off"
                              />
                            </div>
                            <div className="flex items-end gap-2">
                              <Button
                                type="button"
                                variant={config.is_default ? 'default' : 'outline'}
                                size="sm"
                                disabled={!config.editable}
                                onClick={() => markDefault(provider, index)}
                              >
                                Mặc định
                              </Button>
                              {config.deletable ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => deleteConfig(provider, index)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              ) : null}
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>Model runtime: {modelLabel(provider, config.model)}</span>
                            {config.key_preview ? <span>Key: {config.key_preview}</span> : null}
                            {config.updated_at ? (
                              <span>
                                Cập nhật: {new Date(config.updated_at).toLocaleString('vi-VN')}
                              </span>
                            ) : null}
                            {!config.editable ? (
                              <span>Config từ biến môi trường, chỉ đọc.</span>
                            ) : null}
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {aiSuccess && <p className="text-sm text-emerald-700">{aiSuccess}</p>}
            <Button type="submit" disabled={savingAi}>
              {savingAi ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang lưu...
                </>
              ) : (
                'Lưu cấu hình AI'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Phân bố plan</CardTitle>
          <CardDescription>Active subscription / số user.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y rounded-md border text-sm">
            {Object.entries(stats.plans)
              .sort((a, b) => b[1] - a[1])
              .map(([plan, count]) => {
                const pct = stats.users.total > 0 ? (count / stats.users.total) * 100 : 0;
                return (
                  <li key={plan} className="flex items-center gap-4 p-3">
                    <span className="w-24 font-medium capitalize">{plan}</span>
                    <div className="flex-1">
                      <div className="h-2 w-full rounded bg-muted">
                        <div className="h-full rounded bg-brand" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <span className="w-20 text-right tabular-nums text-muted-foreground">
                      {count} · {pct.toFixed(1)}%
                    </span>
                  </li>
                );
              })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function toEditableConfigs(configs: AiProviderConfig[]): EditableProviderConfig[] {
  if (configs.length > 0) {
    return configs.map((config) => ({
      id: config.id,
      label: config.label,
      model: config.model,
      api_key: '',
      is_default: config.is_default,
      editable: config.editable,
      deletable: config.deletable,
      source: config.source,
      key_preview: config.key_preview,
      updated_at: config.updated_at,
    }));
  }
  return [];
}

function toPayload(configs: EditableProviderConfig[]): AiProviderConfigInput[] {
  return configs
    .filter((config) => config.source === 'admin')
    .map((config) => ({
      id: config.id,
      label: config.label.trim(),
      model: config.model,
      api_key: config.api_key.trim() || undefined,
      is_default: config.is_default,
    }))
    .filter((config) => config.label.length > 0);
}

function modelLabel(provider: AiProviderName, model: ProviderModel): string {
  return MODEL_OPTIONS[provider].find((option) => option.value === model)?.label ?? model;
}

function StatCard({ title, value, sub }: { title: string; value: number; sub: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}
