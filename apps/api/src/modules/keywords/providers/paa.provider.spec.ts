import { ConfigService } from '@nestjs/config';
import { PaaProvider } from './paa.provider';
import { KeywordProxyService } from './proxy.service';

function makeProxy(available: boolean, body?: string): KeywordProxyService {
  const cfg = {
    get: (path: string) => {
      if (path === 'ai.proxyProvider') return available ? 'brightdata' : 'none';
      if (path === 'ai.brightdataUsername') return available ? 'user' : '';
      if (path === 'ai.brightdataPassword') return available ? 'pass' : '';
      return '';
    },
  } as unknown as ConfigService;
  const svc = new KeywordProxyService(cfg);
  if (body !== undefined) {
    svc.fetch = async () => ({ status: 200, body, fromProxy: true, attempt: 1 });
  }
  return svc;
}

describe('PaaProvider', () => {
  it('returns stub when proxy unavailable', async () => {
    const provider = new PaaProvider(makeProxy(false));
    const res = await provider.fetch({ seed: 'SEO', language: 'vi', country: 'VN', limit: 12 });
    expect(res.is_stub).toBe(true);
    expect(res.suggestions.length).toBeGreaterThan(5);
    expect(res.suggestions.every((s) => s.keyword.includes('SEO'))).toBe(true);
  });

  it('extracts questions from a Google SERP fixture HTML', () => {
    const provider = new PaaProvider(makeProxy(false));
    const html = `
      <html><body>
        <div class="related-question-pair">
          <div role="heading"><span>SEO là gì?</span></div>
        </div>
        <div class="related-question-pair">
          <div role="heading"><span>SEO mất bao lâu để có kết quả?</span></div>
        </div>
        <div data-initq="Câu hỏi từ data-initq"></div>
      </body></html>
    `;
    const questions = provider.extractPaaQuestions(html);
    expect(questions).toEqual([
      'SEO là gì?',
      'SEO mất bao lâu để có kết quả?',
      'Câu hỏi từ data-initq',
    ]);
  });

  it('falls back to stub when PAA blocks are absent', async () => {
    const provider = new PaaProvider(
      makeProxy(true, '<html><body><p>no PAA here</p></body></html>'),
    );
    const res = await provider.fetch({
      seed: 'something',
      language: 'vi',
      country: 'VN',
      limit: 10,
    });
    expect(res.is_stub).toBe(true);
    expect(res.error).toBe('no PAA on page');
  });
});
