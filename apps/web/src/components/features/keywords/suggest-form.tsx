'use client';

import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { keywordsApi, type KeywordSource, type SuggestionResult } from '@/lib/api/keywords';

interface SuggestFormProps {
  onResult: (result: SuggestionResult) => void;
}

const ALL_SOURCES: KeywordSource[] = ['google_suggest', 'bing_suggest', 'paa'];

export function SuggestForm({ onResult }: SuggestFormProps) {
  const [seed, setSeed] = useState('');
  const [sources, setSources] = useState<KeywordSource[]>(ALL_SOURCES);
  const [limit, setLimit] = useState(200);
  const [language, setLanguage] = useState('vi');
  const [country, setCountry] = useState('VN');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleSource(s: KeywordSource) {
    setSources((arr) => (arr.includes(s) ? arr.filter((x) => x !== s) : [...arr, s]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await keywordsApi.suggest({ seed: seed.trim(), sources, language, country, limit });
      onResult(r);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand/10 text-brand">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>TN1 — Keyword Suggestion</CardTitle>
            <CardDescription>
              Section 8 TN1 — fan out tới Google/Bing/PAA, dedupe, cache 7 ngày.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="seed">Seed keyword</Label>
            <Input
              id="seed"
              required
              minLength={1}
              maxLength={100}
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="VD: SEO local cho doanh nghiệp nhỏ"
            />
          </div>

          <div className="space-y-2">
            <Label>Nguồn (chọn 1-3)</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_SOURCES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSource(s)}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    sources.includes(s)
                      ? 'border-brand bg-brand text-white'
                      : 'border-input bg-background text-muted-foreground'
                  }`}
                >
                  {s.replace('_suggest', '').toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="limit">Limit (10-2000)</Label>
              <Input
                id="limit"
                type="number"
                min={10}
                max={2000}
                step={50}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value) || 200)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lang">Language</Label>
              <Select id="lang" value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="vi">vi</option>
                <option value="en">en</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Select id="country" value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="VN">VN</option>
                <option value="US">US</option>
                <option value="UK">UK</option>
              </Select>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            type="submit"
            disabled={loading || seed.trim().length < 1 || sources.length === 0}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang scrape...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" /> Suggest keywords
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
