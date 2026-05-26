'use client';

import { useEffect, useState } from 'react';
import { Loader2, Sparkles, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScoreCard } from '@/components/features/audit/score-card';
import { auditApi, type AuditReport, type AutoFixReport } from '@/lib/api/audit';
import { contentApi, type ArticleResult } from '@/lib/api/content';

export default function AuditPage() {
  const [articles, setArticles] = useState<ArticleResult[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [intent, setIntent] = useState<'info' | 'commercial' | 'transactional' | 'navigational'>(
    'info',
  );
  const [inlineTitle, setInlineTitle] = useState('');
  const [inlineContent, setInlineContent] = useState('');
  const [report, setReport] = useState<AuditReport | null>(null);
  const [scoring, setScoring] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [fixReport, setFixReport] = useState<AutoFixReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    contentApi
      .listArticles()
      .then((rows) => {
        setArticles(rows);
        if (rows[0]) {
          setSelectedId(rows[0].id);
          setKeyword(rows[0].target_keyword);
        }
      })
      .catch(() => {
        // no articles is OK
      });
  }, []);

  async function handleScore() {
    setError(null);
    setReport(null);
    setFixReport(null);
    setScoring(true);
    try {
      if (selectedId) {
        const r = await auditApi.score({
          article_id: selectedId,
          target_keyword: keyword.trim() || 'target',
          intent,
        });
        setReport(r);
      } else {
        if (!inlineTitle.trim() || !inlineContent.trim() || !keyword.trim()) {
          throw new Error('Cần title + content HTML + keyword');
        }
        const r = await auditApi.score({
          title: inlineTitle,
          content: inlineContent,
          target_keyword: keyword,
          intent,
        });
        setReport(r);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setScoring(false);
    }
  }

  async function handleAutoFix() {
    if (!selectedId) return;
    setError(null);
    setFixReport(null);
    setFixing(true);
    try {
      const r = await auditApi.autoFix({ article_id: selectedId });
      setFixReport(r);
      if (r.improved) {
        // Re-score to show updated breakdown.
        const after = await auditApi.score({
          article_id: selectedId,
          target_keyword: keyword.trim() || 'target',
          intent,
        });
        setReport(after);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setFixing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Content Score</h1>
        <p className="text-sm text-muted-foreground">
          Section 8 TN7 — 12 rule (Chain of Responsibility) + auto-fix qua Claude khi paste real API
          key.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chấm điểm bài viết</CardTitle>
          <CardDescription>
            Chọn bài đã sinh từ TN4 hoặc paste HTML inline để chấm thử.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="article">Bài viết</Label>
              <Select
                id="article"
                value={selectedId}
                onChange={(e) => {
                  setSelectedId(e.target.value);
                  const a = articles.find((x) => x.id === e.target.value);
                  if (a) setKeyword(a.target_keyword);
                }}
              >
                <option value="">— Paste inline thay vì chọn bài —</option>
                {articles.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title.slice(0, 60)} (score {a.content_score})
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="intent">Intent (ảnh hưởng word_count target)</Label>
              <Select
                id="intent"
                value={intent}
                onChange={(e) =>
                  setIntent(
                    e.target.value as 'info' | 'commercial' | 'transactional' | 'navigational',
                  )
                }
              >
                <option value="info">info (≥1500 từ)</option>
                <option value="commercial">commercial (≥2000 từ)</option>
                <option value="transactional">transactional (≥1000 từ)</option>
                <option value="navigational">navigational (≥500 từ)</option>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="keyword">Target keyword</Label>
            <Input
              id="keyword"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="VD: SEO local"
            />
          </div>

          {!selectedId && (
            <>
              <div className="space-y-2">
                <Label htmlFor="title">Title (inline mode)</Label>
                <Input
                  id="title"
                  value={inlineTitle}
                  onChange={(e) => setInlineTitle(e.target.value)}
                  placeholder="Tiêu đề bài"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="html">HTML content (inline mode)</Label>
                <Textarea
                  id="html"
                  rows={8}
                  value={inlineContent}
                  onChange={(e) => setInlineContent(e.target.value)}
                  placeholder="<h1>...</h1><h2>...</h2><p>...</p>"
                />
              </div>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleScore} disabled={scoring}>
              {scoring ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang chấm...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" /> Score
                </>
              )}
            </Button>
            {selectedId && (
              <Button
                variant="ghost"
                onClick={handleAutoFix}
                disabled={fixing || !report || report.score >= 80}
              >
                {fixing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Auto-fixing...
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" /> Auto-fix rules &lt; 80
                  </>
                )}
              </Button>
            )}
          </div>

          {fixReport && (
            <div
              className={`rounded-md border p-3 text-sm ${
                fixReport.improved
                  ? 'border-green-200 bg-green-50 text-green-800'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}
            >
              <p className="font-medium">
                {fixReport.improved
                  ? `Cải thiện ${fixReport.before.score} → ${fixReport.after.score}`
                  : 'Không cải thiện (stub mode hoặc rewrite không tăng score)'}
              </p>
              <p className="mt-1 text-xs">
                Rules targeted: {fixReport.rules_targeted.join(', ') || '—'}
              </p>
              {fixReport.is_stub && (
                <p className="mt-1 text-xs italic">
                  Stub mode — paste ANTHROPIC_API_KEY thật để Claude rewrite thực sự.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {report && <ScoreCard report={report} />}
    </div>
  );
}
