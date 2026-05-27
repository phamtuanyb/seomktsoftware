'use client';

import { useEffect, useState } from 'react';
import { Eye, Loader2, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  brandVoicesApi,
  type BrandVoiceDetail,
  type BrandVoiceListItem,
  type CreateBrandVoiceRequest,
} from '@/lib/api/content';

interface SampleArticleInput {
  title: string;
  content: string;
  url: string;
}

const MIN_SAMPLE_WORDS = 3000;

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function emptySamples(): SampleArticleInput[] {
  return [
    { title: '', content: '', url: '' },
    { title: '', content: '', url: '' },
    { title: '', content: '', url: '' },
  ];
}

export default function BrandVoicesPage() {
  const [items, setItems] = useState<BrandVoiceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [samples, setSamples] = useState<SampleArticleInput[]>(emptySamples());
  const [submitting, setSubmitting] = useState(false);
  const [retrainingId, setRetrainingId] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<BrandVoiceDetail | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handlePreview(id: string) {
    setPreviewLoading(true);
    try {
      const detail = await brandVoicesApi.get(id);
      setPreviewing(detail);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPreviewLoading(false);
    }
  }

  function refresh() {
    setLoading(true);
    brandVoicesApi
      .list()
      .then(setItems)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const incompleteSamples = samples
        .map((s, index) => ({ index, content: s.content.trim(), url: s.url.trim() }))
        .filter((s) => s.content && !s.url && countWords(s.content) < MIN_SAMPLE_WORDS);
      if (incompleteSamples.length > 0) {
        const first = incompleteSamples[0]!;
        throw new Error(
          `Bài mẫu ${first.index + 1} mới có ${countWords(first.content)}/${MIN_SAMPLE_WORDS} từ. Hãy nhập đủ ${MIN_SAMPLE_WORDS} từ hoặc dùng URL để hệ thống fetch.`,
        );
      }

      const cleaned = samples
        .map((s) => {
          const content = s.content.trim();
          return {
            title: s.title.trim() || undefined,
            content: countWords(content) >= MIN_SAMPLE_WORDS ? content : undefined,
            url: s.url.trim() || undefined,
          };
        })
        .filter((s) => s.content || s.url);

      if (cleaned.length < 3) {
        throw new Error(
          `Cần ≥3 bài mẫu. Mỗi bài hoặc nhập content ≥${MIN_SAMPLE_WORDS} từ, hoặc paste URL để hệ thống fetch.`,
        );
      }
      const body: CreateBrandVoiceRequest = {
        name: name.trim(),
        description: description.trim() || undefined,
        sample_articles: cleaned,
      };
      const created = await brandVoicesApi.create(body);
      const tag =
        created.meta.algorithm === 'claude-sonnet-4' ? 'Claude Sonnet 4' : 'heuristic stub';
      setSuccess(`Đã tạo brand voice "${created.name}" (${tag}, ${created.sample_count} bài mẫu).`);
      setName('');
      setDescription('');
      setSamples(emptySamples());
      refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Xoá brand voice này?')) return;
    try {
      await brandVoicesApi.remove(id);
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleRetrain(id: string) {
    setRetrainingId(id);
    setError(null);
    setSuccess(null);
    try {
      const bv = await brandVoicesApi.retrain(id);
      const tag = bv.meta.algorithm === 'claude-sonnet-4' ? 'Claude Sonnet 4' : 'heuristic stub';
      setSuccess(`Đã re-train "${bv.name}" (${tag}).`);
      refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRetrainingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Brand Voice</h1>
        <p className="text-sm text-muted-foreground">
          Section 8 TN5 — học phong cách brand từ 3-20 bài mẫu. Hệ thống gọi Claude Sonnet 4 để
          trích Profile JSON; khi không có API key sẽ fallback heuristic deterministic.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách brand voice</CardTitle>
          <CardDescription>{items.length} brand voice đang hoạt động</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có brand voice nào.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {items.map((bv) => (
                <li key={bv.id} className="flex items-start justify-between p-3">
                  <div>
                    <p className="font-medium">
                      {bv.name}
                      {bv.is_default && (
                        <span className="ml-2 rounded bg-brand/10 px-2 py-0.5 text-xs text-brand">
                          mặc định
                        </span>
                      )}
                      <span
                        className={`ml-2 rounded px-2 py-0.5 text-xs ${
                          bv.algorithm === 'claude-sonnet-4'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                        title={
                          bv.algorithm === 'claude-sonnet-4'
                            ? 'Profile được trích bằng Claude Sonnet 4.'
                            : 'Stub heuristic — chưa có ANTHROPIC_API_KEY hợp lệ.'
                        }
                      >
                        {bv.algorithm === 'claude-sonnet-4' ? 'Claude Sonnet 4' : 'heuristic'}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {bv.sample_count} sample · trained {new Date(bv.trained_at).toLocaleString()}
                    </p>
                    {bv.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{bv.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePreview(bv.id)}
                      disabled={previewLoading}
                      aria-label="Xem chi tiết"
                      title="Xem profile + bài mẫu"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRetrain(bv.id)}
                      disabled={retrainingId === bv.id}
                      aria-label="Re-train"
                      title="Re-train từ reference articles hiện tại"
                    >
                      {retrainingId === bv.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(bv.id)}
                      aria-label="Xoá"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tạo brand voice mới</CardTitle>
          <CardDescription>
            Nhập ít nhất 3 bài mẫu (mỗi bài ≥{MIN_SAMPLE_WORDS} từ HOẶC paste URL — hệ thống tự fetch
            qua Readability). Tốn 1 quota brand_voices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Tên brand voice</Label>
              <Input
                id="name"
                required
                minLength={2}
                maxLength={255}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Tech blog tone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Mô tả (tuỳ chọn)</Label>
              <Input
                id="desc"
                maxLength={1000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <Label>Bài mẫu (3+)</Label>
              {samples.map((s, i) => (
                <div key={i} className="space-y-2 rounded-md border bg-muted/30 p-3">
                  <Input
                    placeholder={`Bài mẫu ${i + 1} — tiêu đề (tuỳ chọn)`}
                    value={s.title}
                    onChange={(e) => {
                      const next = [...samples];
                      next[i] = { ...next[i]!, title: e.target.value };
                      setSamples(next);
                    }}
                  />
                  <Input
                    placeholder="URL bài viết (tuỳ chọn — hệ thống sẽ fetch nếu để trống content)"
                    type="url"
                    value={s.url}
                    onChange={(e) => {
                      const next = [...samples];
                      next[i] = { ...next[i]!, url: e.target.value };
                      setSamples(next);
                    }}
                  />
                  <Textarea
                    placeholder={`Hoặc paste nội dung bài ${i + 1} (≥${MIN_SAMPLE_WORDS} từ)`}
                    rows={6}
                    value={s.content}
                    onChange={(e) => {
                      const next = [...samples];
                      next[i] = { ...next[i]!, content: e.target.value };
                      setSamples(next);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    {s.url.trim()
                      ? 'Sẽ fetch URL nếu content trống.'
                      : `${countWords(s.content)}/${MIN_SAMPLE_WORDS} từ tối thiểu`}
                  </p>
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={samples.length >= 20}
                onClick={() => setSamples([...samples, { title: '', content: '', url: '' }])}
              >
                <Plus className="mr-2 h-4 w-4" /> Thêm bài mẫu
              </Button>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && <p className="text-sm text-green-700">{success}</p>}

            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang train (Claude Sonnet 4)...
                </>
              ) : (
                'Tạo brand voice'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {previewing && <PreviewModal voice={previewing} onClose={() => setPreviewing(null)} />}
    </div>
  );
}

function PreviewModal({ voice, onClose }: { voice: BrandVoiceDetail; onClose: () => void }) {
  const profile = voice.profile_json as {
    tone?: { primary?: string; secondary?: string[]; confidence?: number };
    sentence_structure?: {
      avg_words_per_sentence?: number;
      short_sentences_pct?: number;
      long_sentences_pct?: number;
    };
    addressing?: { primary?: string; formality?: string };
    signature_phrases?: string[];
    vocabulary?: { complexity?: string; domain_terms?: string[] };
    emoji_usage?: { enabled?: boolean; density?: string; common_emojis?: string[] };
    patterns?: { opening_style?: string; closing_style?: string; cta_style?: string };
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b bg-background p-4">
          <div>
            <h2 className="text-lg font-bold">{voice.name}</h2>
            <p className="text-xs text-muted-foreground">
              {voice.algorithm === 'claude-sonnet-4' ? 'Claude Sonnet 4' : 'heuristic stub'} ·{' '}
              {voice.sample_count} bài mẫu · {new Date(voice.trained_at).toLocaleString()}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Đóng">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 p-4 text-sm">
          {voice.description && <p className="text-muted-foreground">{voice.description}</p>}

          <Section title="Tone">
            <p>
              <strong>{profile.tone?.primary ?? '(chưa rõ)'}</strong>
              {profile.tone?.confidence !== undefined && (
                <span className="ml-2 text-xs text-muted-foreground">
                  confidence {(profile.tone.confidence * 100).toFixed(0)}%
                </span>
              )}
            </p>
            {profile.tone?.secondary && profile.tone.secondary.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Phụ: {profile.tone.secondary.join(', ')}
              </p>
            )}
          </Section>

          <Section title="Cấu trúc câu">
            <ul className="space-y-1 text-xs">
              <li>
                Trung bình: <strong>{profile.sentence_structure?.avg_words_per_sentence}</strong>{' '}
                từ/câu
              </li>
              <li>Câu ngắn (≤10 từ): {profile.sentence_structure?.short_sentences_pct}%</li>
              <li>Câu dài (≥25 từ): {profile.sentence_structure?.long_sentences_pct}%</li>
            </ul>
          </Section>

          <Section title="Xưng hô">
            <p>
              <strong>{profile.addressing?.primary}</strong>{' '}
              {profile.addressing?.formality && (
                <span className="text-xs text-muted-foreground">
                  ({profile.addressing.formality})
                </span>
              )}
            </p>
          </Section>

          {profile.signature_phrases && profile.signature_phrases.length > 0 && (
            <Section title="Cụm từ đặc trưng">
              <div className="flex flex-wrap gap-1">
                {profile.signature_phrases.map((p, i) => (
                  <code key={i} className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {p}
                  </code>
                ))}
              </div>
            </Section>
          )}

          <Section title="Vocabulary">
            <p>
              Độ phức tạp: <strong>{profile.vocabulary?.complexity}</strong>
            </p>
            {profile.vocabulary?.domain_terms && profile.vocabulary.domain_terms.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {profile.vocabulary.domain_terms.map((t, i) => (
                  <span key={i} className="rounded bg-muted/60 px-1.5 py-0.5 text-xs">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </Section>

          <Section title="Emoji">
            <p>
              {profile.emoji_usage?.enabled ? (
                <>
                  Có dùng — mật độ <strong>{profile.emoji_usage.density}</strong>{' '}
                  {profile.emoji_usage.common_emojis &&
                    profile.emoji_usage.common_emojis.length > 0 && (
                      <span className="ml-1">{profile.emoji_usage.common_emojis.join(' ')}</span>
                    )}
                </>
              ) : (
                <span className="text-muted-foreground">Không dùng emoji</span>
              )}
            </p>
          </Section>

          <Section title="Patterns">
            <ul className="space-y-1 text-xs">
              <li>
                <strong>Mở bài:</strong> {profile.patterns?.opening_style}
              </li>
              <li>
                <strong>Kết bài:</strong> {profile.patterns?.closing_style}
              </li>
              <li>
                <strong>CTA:</strong> {profile.patterns?.cta_style}
              </li>
            </ul>
          </Section>

          <Section title={`Bài mẫu reference (${voice.reference_articles.length})`}>
            <ul className="space-y-2">
              {voice.reference_articles.map((a, i) => (
                <li key={i} className="rounded border p-2">
                  {a.title && <p className="font-medium">{a.title}</p>}
                  <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
                    {a.content.slice(0, 300)}
                    {a.content.length > 300 && '...'}
                  </p>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}
