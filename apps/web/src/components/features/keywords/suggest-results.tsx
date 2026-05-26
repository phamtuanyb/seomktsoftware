'use client';

import { useMemo, useState } from 'react';
import { Download, Loader2, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  keywordsApi,
  type AnalysisResult,
  type KeywordProject,
  type KeywordSource,
  type SuggestionResult,
} from '@/lib/api/keywords';

interface SuggestResultsProps {
  result: SuggestionResult;
  projects: KeywordProject[];
  onProjectsChanged: () => void;
}

export function SuggestResults({ result, projects, onProjectsChanged }: SuggestResultsProps) {
  const [filter, setFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState<KeywordSource | 'all'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [projectId, setProjectId] = useState<string>(projects[0]?.id ?? '');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const lc = filter.trim().toLowerCase();
    return result.keywords.filter((k) => {
      if (sourceFilter !== 'all' && k.source !== sourceFilter) return false;
      if (lc && !k.keyword.toLowerCase().includes(lc)) return false;
      return true;
    });
  }, [result.keywords, filter, sourceFilter]);

  const analyzedMap = useMemo(() => {
    const m = new Map<string, AnalysisResult['rows'][number]>();
    for (const r of analysis?.rows ?? []) m.set(r.keyword.toLowerCase(), r);
    return m;
  }, [analysis]);

  function toggle(keyword: string) {
    const next = new Set(selected);
    if (next.has(keyword)) next.delete(keyword);
    else next.add(keyword);
    setSelected(next);
  }

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((k) => k.keyword)));
  }

  async function analyzeSelection() {
    if (selected.size === 0) return;
    setAnalyzing(true);
    setMessage(null);
    try {
      const a = await keywordsApi.analyze({
        keywords: [...selected],
        analyze_intent: true,
        language: result.language,
        country: result.country,
      });
      setAnalysis(a);
    } catch (err) {
      setMessage(`Analyze lỗi: ${(err as Error).message}`);
    } finally {
      setAnalyzing(false);
    }
  }

  async function addToProject() {
    if (!projectId || selected.size === 0) return;
    setAdding(true);
    setMessage(null);
    try {
      const r = await keywordsApi.addProjectKeywords(projectId, {
        keywords: [...selected],
      });
      setMessage(`Đã thêm ${r.inserted} keyword (skip ${r.skipped} đã tồn tại)`);
      onProjectsChanged();
    } catch (err) {
      setMessage(`Thêm vào project lỗi: ${(err as Error).message}`);
    } finally {
      setAdding(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-lg">
            {result.stats.total_returned} keyword cho “{result.seed}”
          </CardTitle>
          <CardDescription>
            {result.stats.duration_ms}ms · dedupe {(result.stats.dedupe_rate * 100).toFixed(1)}%
            {result.stats.cached && (
              <span className="ml-2 rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">
                cached
              </span>
            )}
            <span className="ml-3">
              Sources:{' '}
              {Object.entries(result.stats.by_source)
                .filter(([, v]) => v.count > 0 || v.is_stub)
                .map(([k, v]) => `${k.replace('_suggest', '')}=${v.count}${v.is_stub ? '*' : ''}`)
                .join(' · ')}
              <span className="ml-2 italic">(*= stub)</span>
            </span>
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Tìm trong kết quả..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="max-w-xs"
          />
          <Select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as KeywordSource | 'all')}
            className="max-w-[160px]"
          >
            <option value="all">Tất cả nguồn</option>
            <option value="google_suggest">Google</option>
            <option value="bing_suggest">Bing</option>
            <option value="paa">PAA</option>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            onClick={analyzeSelection}
            disabled={analyzing || selected.size === 0}
          >
            {analyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" /> Analyze {selected.size}
              </>
            )}
          </Button>
          {projects.length > 0 && (
            <>
              <Select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="max-w-[200px]"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.keyword_count})
                  </option>
                ))}
              </Select>
              <Button size="sm" onClick={addToProject} disabled={adding || selected.size === 0}>
                {adding ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" /> Add {selected.size}
                  </>
                )}
              </Button>
            </>
          )}
        </div>

        {message && <p className="text-sm text-brand">{message}</p>}

        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide">
              <tr>
                <th className="w-10 px-3 py-2 text-left">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selected.size === filtered.length}
                    onChange={toggleAll}
                    aria-label="Chọn tất cả"
                  />
                </th>
                <th className="px-3 py-2 text-left">Keyword</th>
                <th className="px-3 py-2 text-left">Source</th>
                <th className="px-3 py-2 text-right">Volume</th>
                <th className="px-3 py-2 text-right">KD</th>
                <th className="px-3 py-2 text-left">Intent</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 500).map((k) => {
                const a = analyzedMap.get(k.keyword.toLowerCase());
                return (
                  <tr key={k.keyword} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(k.keyword)}
                        onChange={() => toggle(k.keyword)}
                      />
                    </td>
                    <td className="px-3 py-2">{k.keyword}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {k.source.replace('_suggest', '')}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {a?.volume?.toLocaleString() ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {a?.keyword_difficulty ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {a?.intent ? (
                        <span
                          className={
                            a.intent === 'transactional'
                              ? 'rounded bg-orange-100 px-2 py-0.5 text-orange-800'
                              : a.intent === 'commercial'
                                ? 'rounded bg-amber-100 px-2 py-0.5 text-amber-800'
                                : a.intent === 'navigational'
                                  ? 'rounded bg-blue-100 px-2 py-0.5 text-blue-800'
                                  : 'rounded bg-gray-100 px-2 py-0.5 text-gray-700'
                          }
                        >
                          {a.intent}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length > 500 && (
            <p className="border-t bg-muted/30 p-2 text-xs text-muted-foreground">
              Hiển thị 500/{filtered.length}. Lọc bằng ô tìm để xem hết.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface ProjectExportButtonProps {
  projectId: string;
  format: 'csv' | 'excel';
}

export function ProjectExportLink({ projectId, format }: ProjectExportButtonProps) {
  return (
    <a
      href={keywordsApi.exportProjectUrl(projectId, format)}
      className="inline-flex items-center text-xs text-brand hover:underline"
    >
      <Download className="mr-1 h-3 w-3" /> {format.toUpperCase()}
    </a>
  );
}
