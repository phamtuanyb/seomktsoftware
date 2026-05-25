import { ConfigService } from '@nestjs/config';
import { GoogleSuggestProvider } from './google-suggest.provider';
import { KeywordProxyService } from './proxy.service';

function makeProxy(available: boolean, body?: string): KeywordProxyService {
  const cfg = {
    get: (path: string) => {
      if (path === 'ai.proxyProvider') return available ? 'scraperapi' : 'none';
      if (path === 'ai.scraperApiKey') return available ? 'fake-key' : '';
      return '';
    },
  } as unknown as ConfigService;
  const svc = new KeywordProxyService(cfg);
  if (body !== undefined) {
    svc.fetch = async () => ({ status: 200, body, fromProxy: true, attempt: 1 });
  }
  return svc;
}

describe('GoogleSuggestProvider — stub mode', () => {
  it('returns canned suggestions when proxy unavailable', async () => {
    const provider = new GoogleSuggestProvider(makeProxy(false));
    const res = await provider.fetch({ seed: 'SEO', language: 'vi', country: 'VN', limit: 20 });

    expect(res.is_stub).toBe(true);
    expect(res.source).toBe('google_suggest');
    expect(res.suggestions.length).toBeGreaterThan(5);
    expect(res.suggestions[0]!.keyword.toLowerCase()).toContain('seo');
    expect(res.suggestions[0]!.rank).toBe(1);
    expect(res.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('respects the limit parameter', async () => {
    const provider = new GoogleSuggestProvider(makeProxy(false));
    const res = await provider.fetch({ seed: 'SEO', language: 'vi', country: 'VN', limit: 5 });
    expect(res.suggestions).toHaveLength(5);
  });
});

describe('GoogleSuggestProvider — live mode', () => {
  it('parses the chrome client JSON shape', async () => {
    const body = JSON.stringify(['seo', ['seo là gì', 'seo google', 'seo onpage']]);
    const provider = new GoogleSuggestProvider(makeProxy(true, body));

    const res = await provider.fetch({ seed: 'seo', language: 'vi', country: 'VN', limit: 50 });

    expect(res.is_stub).toBe(false);
    expect(res.suggestions).toEqual([
      { keyword: 'seo là gì', source: 'google_suggest', rank: 1 },
      { keyword: 'seo google', source: 'google_suggest', rank: 2 },
      { keyword: 'seo onpage', source: 'google_suggest', rank: 3 },
    ]);
  });

  it('falls back to stub when JSON is malformed', async () => {
    const provider = new GoogleSuggestProvider(makeProxy(true, '<<<not json>>>'));
    const res = await provider.fetch({ seed: 'seo', language: 'vi', country: 'VN', limit: 20 });
    expect(res.is_stub).toBe(true);
    expect(res.error).toBeDefined();
  });

  it('falls back to stub on empty suggestions list', async () => {
    const provider = new GoogleSuggestProvider(makeProxy(true, '["seo", []]'));
    const res = await provider.fetch({ seed: 'seo', language: 'vi', country: 'VN', limit: 20 });
    expect(res.is_stub).toBe(true);
    expect(res.error).toBe('no suggestions');
  });
});
