import { ConfigService } from '@nestjs/config';
import { BingSuggestProvider } from './bing-suggest.provider';
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

describe('BingSuggestProvider', () => {
  it('returns stub when proxy unavailable', async () => {
    const provider = new BingSuggestProvider(makeProxy(false));
    const res = await provider.fetch({
      seed: 'content marketing',
      language: 'vi',
      country: 'VN',
      limit: 30,
    });
    expect(res.is_stub).toBe(true);
    expect(res.source).toBe('bing_suggest');
    expect(res.suggestions.length).toBeGreaterThan(3);
  });

  it('parses the OpenSearch JSON shape', async () => {
    const body = JSON.stringify(['seo', ['seo tools', 'seo audit', 'seo guide']]);
    const provider = new BingSuggestProvider(makeProxy(true, body));
    const res = await provider.fetch({ seed: 'seo', language: 'en', country: 'US', limit: 10 });
    expect(res.is_stub).toBe(false);
    expect(res.suggestions.map((s) => s.keyword)).toEqual(['seo tools', 'seo audit', 'seo guide']);
  });
});
