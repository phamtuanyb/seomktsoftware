import { ConfigService } from '@nestjs/config';
import { SerpService } from './serp.service';
import type { RedisService } from '../../../common/services/redis.service';

function makeRedis(): RedisService {
  const store = new Map<string, string>();
  const client = {
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async set(key: string, value: string) {
      store.set(key, value);
      return 'OK';
    },
  };
  return {
    getClient: () => client,
  } as unknown as RedisService;
}

function makeCfg(overrides: Record<string, unknown> = {}): ConfigService {
  return {
    get: (path: string) => overrides[path],
  } as unknown as ConfigService;
}

describe('SerpService — stub mode', () => {
  let service: SerpService;

  beforeEach(() => {
    service = new SerpService(makeRedis(), makeCfg({ 'ai.proxyProvider': 'none' }));
  });

  it('reports stub mode when no proxy is configured', () => {
    expect(service.isStubMode()).toBe(true);
  });

  it('returns the requested number of synthetic SERP results', async () => {
    const results = await service.topResults({ keyword: 'SEO cơ bản', limit: 5 });
    expect(results).toHaveLength(5);
    for (const r of results) {
      expect(r.url).toMatch(/^https:\/\/stub-example\.local\//);
      expect(r.title.length).toBeGreaterThan(10);
      expect(r.headings.h1.length).toBeGreaterThan(5);
      expect(r.headings.h2.length).toBeGreaterThan(3);
      expect(r.wordCount).toBeGreaterThan(1500);
    }
  });

  it('returns cached results on the second call', async () => {
    const redis = makeRedis();
    const s = new SerpService(redis, makeCfg({ 'ai.proxyProvider': 'none' }));
    const first = await s.topResults({ keyword: 'SEO cache test' });
    const second = await s.topResults({ keyword: 'SEO cache test' });
    expect(second).toEqual(first);
  });

  it('embeds the keyword into every result title', async () => {
    const results = await service.topResults({ keyword: 'content marketing' });
    for (const r of results) {
      expect(r.title.toLowerCase()).toContain('content marketing');
    }
  });
});

describe('SerpService — cheerio HTML extraction', () => {
  const service = new SerpService(makeRedis(), makeCfg({ 'ai.proxyProvider': 'none' }));

  it('extracts h1/h2/h3 from a typical article HTML', () => {
    const html = `
      <html>
        <head><title>Fallback Title</title></head>
        <body>
          <header><h1>Big Title Here</h1></header>
          <main>
            <h2>Section A</h2>
            <p>...</p>
            <h2>Section B</h2>
            <h3>A.1</h3>
            <h3>A.2</h3>
          </main>
          <footer>x</footer>
        </body>
      </html>
    `;
    const result = service.extractHeadings(html);
    expect(result.h1).toBe('Big Title Here');
    expect(result.h2).toEqual(['Section A', 'Section B']);
    expect(result.h3).toEqual(['A.1', 'A.2']);
  });

  it('falls back to <title> when there is no h1', () => {
    const html = '<html><head><title>Fallback</title></head><body><h2>Hello</h2></body></html>';
    expect(service.extractHeadings(html).h1).toBe('Fallback');
  });

  it('counts approximate body words after stripping nav/footer/script', () => {
    const html = `
      <body>
        <nav>nav text should be removed</nav>
        <script>const x = 1; alert('boom');</script>
        <main>One two three four five six seven eight nine ten.</main>
        <footer>footer ignored</footer>
      </body>
    `;
    expect(service.approximateWordCount(html)).toBe(10);
  });
});
