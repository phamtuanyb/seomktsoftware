'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  Download,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { contentApi, type ArticleResult, type ArticleTone } from '@/lib/api/content';
import { auditApi } from '@/lib/api/audit';

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
type RewriteAction = 'shorter' | 'longer' | 'tone' | 'details' | 'free';

interface OutlineSection {
  heading: string;
  level: 2 | 3;
}

interface HistorySnapshot {
  label: string;
  markdown: string;
  at: number;
}

const TONES: ArticleTone[] = ['expert', 'friendly', 'sales', 'educational', 'storytelling'];

const AUTO_SAVE_INTERVAL_MS = 30_000;
const LIVE_SCORE_DEBOUNCE_MS = 5_000;
const HISTORY_MAX = 10;

/**
 * Sprint 6.5 — TN4 3-column editor.
 *
 * Left column: outline (parsed from markdown headings) — click to scroll to that
 * section in the middle editor.
 * Middle column: markdown editor (textarea, preserves whitespace) with title +
 * meta fields.
 * Right column: AI Assistant — regenerate the section the caret is in, rewrite
 * selected text with 5 actions, export to md / html / docx.
 */
export default function ArticleDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [article, setArticle] = useState<ArticleResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [status, setStatus] = useState<'draft' | 'ready' | 'published'>('draft');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [tone, setTone] = useState<ArticleTone>('friendly');
  const [freeInstructions, setFreeInstructions] = useState('');

  // Sprint 6.6 — realtime score preview
  const [liveScore, setLiveScore] = useState<number | null>(null);
  const [liveScoring, setLiveScoring] = useState(false);

  // Sprint 6.6 — undo stack for AI-driven changes (regenerate, rewrite, apply).
  const [history, setHistory] = useState<HistorySnapshot[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveScoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSnapshot = useRef<string>('');

  // ----- load -----
  useEffect(() => {
    if (!params?.id) return;
    setLoading(true);
    contentApi
      .getArticle(params.id)
      .then((a) => {
        setArticle(a);
        setTitle(a.title);
        setMarkdown(a.content_markdown);
        setMetaTitle(a.meta_title);
        setMetaDescription(a.meta_description);
        lastSavedSnapshot.current = JSON.stringify({
          title: a.title,
          markdown: a.content_markdown,
          metaTitle: a.meta_title,
          metaDescription: a.meta_description,
          status: 'draft',
        });
        setSaveState('idle');
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [params?.id]);

  // ----- outline parsed from markdown -----
  const outline: OutlineSection[] = useMemo(() => {
    const result: OutlineSection[] = [];
    for (const line of markdown.split('\n')) {
      const h2 = /^##\s+(.+?)\s*$/.exec(line);
      const h3 = /^###\s+(.+?)\s*$/.exec(line);
      if (h2) result.push({ heading: h2[1]!, level: 2 });
      else if (h3) result.push({ heading: h3[1]!, level: 3 });
    }
    return result;
  }, [markdown]);

  // ----- dirty tracking + auto-save -----
  const currentSnapshot = useMemo(
    () => JSON.stringify({ title, markdown, metaTitle, metaDescription, status }),
    [title, markdown, metaTitle, metaDescription, status],
  );
  const isDirty = currentSnapshot !== lastSavedSnapshot.current;

  useEffect(() => {
    if (saveState === 'saving') return;
    if (isDirty) setSaveState('dirty');
    else if (saveState === 'dirty') setSaveState('idle');
  }, [isDirty, saveState]);

  const save = useCallback(async () => {
    if (!article) return;
    setBusy(true);
    setSaveState('saving');
    setError(null);
    try {
      const updated = await contentApi.updateArticle(article.id, {
        title,
        content_markdown: markdown,
        meta_title: metaTitle,
        meta_description: metaDescription,
        status,
      });
      setArticle(updated);
      lastSavedSnapshot.current = JSON.stringify({
        title,
        markdown,
        metaTitle,
        metaDescription,
        status,
      });
      setLastSavedAt(new Date());
      setSaveState('saved');
      setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 2000);
    } catch (err) {
      setError((err as Error).message);
      setSaveState('error');
    } finally {
      setBusy(false);
    }
  }, [article, title, markdown, metaTitle, metaDescription, status]);

  // Auto-save every 30s while dirty.
  useEffect(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    if (!isDirty || !article) return;
    autoSaveTimer.current = setTimeout(() => {
      void save();
    }, AUTO_SAVE_INTERVAL_MS);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [isDirty, article, save]);

  // Sprint 6.6 — realtime content score every 5s after edits (debounced).
  // Cheap on the server: 12 rules run in parallel against in-memory HTML.
  useEffect(() => {
    if (liveScoreTimer.current) clearTimeout(liveScoreTimer.current);
    if (!article) return;
    const keyword = article.target_keyword;
    if (!keyword || markdown.trim().length < 50) return;
    liveScoreTimer.current = setTimeout(async () => {
      setLiveScoring(true);
      try {
        const report = await auditApi.score({
          title,
          content_markdown: markdown,
          meta_title: metaTitle,
          meta_description: metaDescription,
          target_keyword: keyword,
        });
        setLiveScore(report.score);
      } catch {
        // Score is purely informational — swallow errors so they don't
        // break the editor.
      } finally {
        setLiveScoring(false);
      }
    }, LIVE_SCORE_DEBOUNCE_MS);
    return () => {
      if (liveScoreTimer.current) clearTimeout(liveScoreTimer.current);
    };
  }, [article, title, markdown, metaTitle, metaDescription]);

  // Sprint 6.6 — Cmd/Ctrl+Z restores the most recent AI snapshot.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isUndo = (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z';
      if (!isUndo) return;
      // Only steal undo when the focus is in our editor, and the textarea
      // itself isn't going to handle the undo (i.e. no last-typed change).
      const active = document.activeElement as HTMLElement | null;
      if (active && active === textareaRef.current) {
        // Let the textarea handle typing-level undo by default; only intercept
        // when the user explicitly shift-pressed for AI undo (handled below).
        return;
      }
      if (history.length === 0) return;
      e.preventDefault();
      restoreLatestHistory();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history]);

  function pushHistory(label: string): void {
    setHistory((prev) => [{ label, markdown, at: Date.now() }, ...prev.slice(0, HISTORY_MAX - 1)]);
  }

  function restoreLatestHistory(): void {
    const top = history[0];
    if (!top) return;
    setMarkdown(top.markdown);
    setHistory((prev) => prev.slice(1));
    setAiNotice(`Đã undo: "${top.label}".`);
  }

  function restoreHistoryAt(idx: number): void {
    const snap = history[idx];
    if (!snap) return;
    setMarkdown(snap.markdown);
    setHistory((prev) => prev.slice(idx + 1));
    setAiNotice(`Đã khôi phục: "${snap.label}".`);
  }

  // ----- AI actions -----

  /** Find the H2 heading the caret is currently inside. */
  function currentSectionHeading(): string | null {
    const el = textareaRef.current;
    if (!el) return null;
    const before = markdown.slice(0, el.selectionStart);
    const lines = before.split('\n');
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const m = /^##\s+(.+?)\s*$/.exec(lines[i] ?? '');
      if (m) return m[1]!;
    }
    return null;
  }

  function currentSelection(): string {
    const el = textareaRef.current;
    if (!el) return '';
    return markdown.slice(el.selectionStart, el.selectionEnd);
  }

  function replaceSelection(text: string): void {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = markdown.slice(0, start) + text + markdown.slice(end);
    setMarkdown(next);
    // Move caret to end of inserted text.
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start, start + text.length);
    });
  }

  function jumpToHeading(heading: string): void {
    const el = textareaRef.current;
    if (!el) return;
    const idx = markdown.indexOf(`## ${heading}`);
    const idx3 = idx === -1 ? markdown.indexOf(`### ${heading}`) : idx;
    if (idx3 === -1) return;
    el.focus();
    el.setSelectionRange(idx3, idx3);
    // Scroll the textarea so the line is visible.
    const before = markdown.slice(0, idx3);
    const lineIndex = before.split('\n').length;
    const lineHeight = 22; // matches mono text line-height
    el.scrollTop = Math.max(0, lineIndex * lineHeight - 80);
  }

  async function handleRegenerateSection() {
    if (!article) return;
    const heading = currentSectionHeading();
    if (!heading) {
      setAiNotice('Đặt con trỏ vào trong một section ## H2 trước.');
      return;
    }
    setAiBusy('regenerate');
    setAiNotice(null);
    pushHistory(`regenerate "${heading}"`);
    try {
      const updated = await contentApi.regenerateSection(article.id, { section_heading: heading });
      setArticle(updated);
      setMarkdown(updated.content_markdown);
      lastSavedSnapshot.current = JSON.stringify({
        title: updated.title,
        markdown: updated.content_markdown,
        metaTitle: updated.meta_title,
        metaDescription: updated.meta_description,
        status,
      });
      setSaveState('saved');
      setAiNotice(`Đã regenerate section "${heading}".`);
      setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 2000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAiBusy(null);
    }
  }

  async function handleRewrite(action: RewriteAction) {
    if (!article) return;
    const selected = currentSelection();
    if (!selected && action !== 'free') {
      setAiNotice('Bôi đen đoạn text muốn rewrite trước.');
      return;
    }
    setAiBusy(action);
    setAiNotice(null);
    if (selected) pushHistory(`rewrite "${action}"`);
    try {
      const res = await contentApi.rewrite(article.id, {
        action,
        text: selected || undefined,
        tone: action === 'tone' ? tone : undefined,
        instructions: action === 'free' ? freeInstructions : undefined,
      });
      if (selected) {
        replaceSelection(res.rewritten);
        setAiNotice(`Đã rewrite (${action}) — ${selected.length} → ${res.rewritten.length} ký tự.`);
      } else {
        // Whole-article rewrite without apply — show preview in notice.
        setAiNotice(`Đã sinh bản rewrite (${action}) — bôi đen trước rồi rewrite để áp dụng.`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAiBusy(null);
    }
  }

  async function handleDelete() {
    if (!article || !window.confirm('Xoá bài viết này?')) return;
    try {
      await contentApi.deleteArticle(article.id);
      router.push('/articles');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">{error ?? 'Không tìm thấy bài viết.'}</p>
        <Button variant="outline" onClick={() => router.push('/articles')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Về danh sách
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" onClick={() => router.push('/articles')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại
          </Button>
          <h1 className="mt-1 text-xl font-bold tracking-tight">Sửa bài viết</h1>
          <p className="text-xs text-muted-foreground">
            <ScoreBadge saved={article.content_score} live={liveScore} scoring={liveScoring} /> ·{' '}
            {article.word_count} từ · {article.ai_model}
            {article.is_stub && <span className="ml-2 text-amber-700">(stub)</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SaveIndicator state={saveState} lastSavedAt={lastSavedAt} />
          <Button variant="outline" size="sm" onClick={handleDelete}>
            <Trash2 className="mr-2 h-4 w-4 text-destructive" /> Xoá
          </Button>
          <Button size="sm" onClick={save} disabled={busy || !isDirty}>
            {saveState === 'saving' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Lưu
          </Button>
        </div>
      </div>

      {/* 3-column layout */}
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_300px]">
        {/* LEFT: Outline */}
        <Card className="hidden lg:block">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Outline</CardTitle>
            <CardDescription className="text-xs">Click để nhảy đến section.</CardDescription>
          </CardHeader>
          <CardContent className="px-2">
            {outline.length === 0 ? (
              <p className="text-xs text-muted-foreground">Chưa có heading ## hoặc ###</p>
            ) : (
              <ul className="space-y-0.5 text-xs">
                {outline.map((s, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => jumpToHeading(s.heading)}
                      className={`w-full truncate rounded px-2 py-1 text-left hover:bg-muted ${
                        s.level === 3 ? 'pl-5 text-muted-foreground' : 'font-medium'
                      }`}
                      title={s.heading}
                    >
                      {s.heading}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* MIDDLE: Editor */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Nội dung</CardTitle>
              <CardDescription className="text-xs">
                Markdown là nguồn chính — HTML + word_count tự cập nhật khi lưu. Auto-save mỗi 30s.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={500}
                className="text-lg font-medium"
                placeholder="Tiêu đề bài viết"
              />
              <Textarea
                ref={textareaRef}
                rows={26}
                value={markdown}
                onChange={(e) => setMarkdown(e.target.value)}
                className="font-mono text-sm leading-[22px]"
                placeholder="# Tiêu đề&#10;&#10;## Section đầu tiên&#10;&#10;Nội dung..."
              />
              <article
                className="prose prose-zinc max-w-none rounded-md border bg-background px-6 py-5 prose-headings:scroll-mt-20 prose-headings:font-semibold prose-h1:border-b prose-h1:pb-3 prose-h1:text-3xl prose-h2:mt-8 prose-h2:border-b prose-h2:pb-2 prose-h2:text-2xl prose-h3:mt-6 prose-h3:text-xl prose-p:leading-7 prose-li:my-1 prose-table:text-sm"
                dangerouslySetInnerHTML={{ __html: article.content_html }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">SEO meta</CardTitle>
              <CardDescription className="text-xs">
                meta_description khuyến nghị 140-160 ký tự.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="mt" className="text-xs">
                  Meta title
                </Label>
                <Input
                  id="mt"
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  maxLength={200}
                />
                <p className="text-[10px] text-muted-foreground">{metaTitle.length}/60</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="md-desc" className="text-xs">
                  Meta description
                </Label>
                <Textarea
                  id="md-desc"
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  maxLength={300}
                  rows={3}
                />
                <p className="text-[10px] text-muted-foreground">{metaDescription.length}/160</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="status" className="text-xs">
                  Trạng thái
                </Label>
                <select
                  id="status"
                  className="h-9 w-full max-w-xs rounded-md border bg-background px-3 text-sm"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as typeof status)}
                >
                  <option value="draft">Bản nháp</option>
                  <option value="ready">Sẵn sàng</option>
                  <option value="published">Đã xuất bản</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        {/* RIGHT: AI Assistant */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-brand" /> AI Assistant
            </CardTitle>
            <CardDescription className="text-xs">
              Bôi đen text để rewrite, hoặc đặt con trỏ vào section để regenerate.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              disabled={aiBusy !== null}
              onClick={handleRegenerateSection}
            >
              {aiBusy === 'regenerate' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Regenerate section hiện tại
            </Button>

            <div className="space-y-1 border-t pt-3">
              <p className="text-xs font-medium">Rewrite selection</p>
              <p className="text-[10px] text-muted-foreground">Bôi đen đoạn cần rewrite trước.</p>
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={aiBusy !== null}
                  onClick={() => handleRewrite('shorter')}
                >
                  {aiBusy === 'shorter' && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  Ngắn hơn
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={aiBusy !== null}
                  onClick={() => handleRewrite('longer')}
                >
                  {aiBusy === 'longer' && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  Dài hơn
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={aiBusy !== null}
                  onClick={() => handleRewrite('details')}
                >
                  {aiBusy === 'details' && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}+ Chi
                  tiết
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={aiBusy !== null}
                  onClick={() => handleRewrite('tone')}
                >
                  {aiBusy === 'tone' && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  Đổi tone
                </Button>
              </div>
              <select
                className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-xs"
                value={tone}
                onChange={(e) => setTone(e.target.value as ArticleTone)}
                aria-label="Tone for rewrite"
              >
                {TONES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1 border-t pt-3">
              <p className="text-xs font-medium">Rewrite tự do</p>
              <Textarea
                value={freeInstructions}
                onChange={(e) => setFreeInstructions(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="VD: viết lại theo phong cách Tony Buổi Sáng..."
                className="text-xs"
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={aiBusy !== null || !freeInstructions.trim()}
                onClick={() => handleRewrite('free')}
              >
                {aiBusy === 'free' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="mr-2 h-4 w-4" />
                )}
                Áp dụng
              </Button>
            </div>

            <div className="space-y-1 border-t pt-3">
              <p className="text-xs font-medium">Export</p>
              <div className="grid grid-cols-3 gap-1.5">
                {(['md', 'html', 'docx'] as const).map((fmt) => (
                  <a
                    key={fmt}
                    href={contentApi.exportUrl(article.id, fmt)}
                    download
                    className="inline-flex items-center justify-center rounded-md border px-2 py-1 text-xs hover:bg-muted"
                  >
                    <Download className="mr-1 h-3 w-3" /> {fmt.toUpperCase()}
                  </a>
                ))}
              </div>
            </div>

            {/* Sprint 6.6 — AI history / undo */}
            <div className="space-y-1 border-t pt-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium">Lịch sử AI</p>
                <span className="text-[10px] text-muted-foreground">Cmd/Ctrl+Z để undo</span>
              </div>
              {history.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">
                  Mỗi lần regenerate/rewrite sẽ lưu 1 bản. Tối đa {HISTORY_MAX}.
                </p>
              ) : (
                <ul className="space-y-1 text-[11px]">
                  {history.map((h, i) => (
                    <li key={`${h.at}-${i}`}>
                      <button
                        type="button"
                        onClick={() => restoreHistoryAt(i)}
                        className="flex w-full items-center justify-between rounded px-1.5 py-1 text-left hover:bg-muted"
                        title="Khôi phục về thời điểm này"
                      >
                        <span className="truncate font-medium">{h.label}</span>
                        <span className="ml-2 shrink-0 text-muted-foreground">
                          {new Date(h.at).toLocaleTimeString()}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {aiNotice && (
              <p className="rounded bg-muted/50 p-2 text-[11px] text-muted-foreground">
                {aiNotice}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SaveIndicator({ state, lastSavedAt }: { state: SaveState; lastSavedAt: Date | null }) {
  if (state === 'saving') {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Đang lưu...
      </span>
    );
  }
  if (state === 'saved') {
    return (
      <span className="flex items-center gap-1 text-xs text-emerald-700">
        <Check className="h-3 w-3" /> Đã lưu{lastSavedAt && ` ${lastSavedAt.toLocaleTimeString()}`}
      </span>
    );
  }
  if (state === 'dirty') {
    return <span className="text-xs text-amber-700">Có thay đổi chưa lưu (auto-save 30s)</span>;
  }
  if (state === 'error') {
    return <span className="text-xs text-destructive">Lưu lỗi — bấm Lưu lại</span>;
  }
  return lastSavedAt ? (
    <span className="text-xs text-muted-foreground">Đã lưu {lastSavedAt.toLocaleTimeString()}</span>
  ) : null;
}

function ScoreBadge({
  saved,
  live,
  scoring,
}: {
  saved: number;
  live: number | null;
  scoring: boolean;
}) {
  const color = (n: number) =>
    n >= 80 ? 'text-emerald-700' : n >= 60 ? 'text-amber-700' : 'text-rose-700';
  if (live !== null && live !== saved) {
    return (
      <span>
        Score <strong className={color(saved)}>{saved}</strong>
        <span className="mx-1 text-muted-foreground">→</span>
        <strong className={color(live)} title="Bản xem trước realtime (chưa lưu)">
          {live}
        </strong>
        {scoring && <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />}/100
      </span>
    );
  }
  return (
    <span>
      Score <strong className={color(saved)}>{saved}</strong>
      {scoring && <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />}/100
    </span>
  );
}
