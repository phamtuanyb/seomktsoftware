import { OutlineService } from './outline.service';
import { LlmRegistry } from '../providers/llm-registry.service';
import { stubOutlineFor } from '../providers/stub-fixtures';
import type { RedisService } from '../../../common/services/redis.service';
import type { SerpService, SerpResult } from './serp.service';
import type { LlmProvider } from '../providers/llm-provider.interface';

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
  return { getClient: () => client } as unknown as RedisService;
}

function makeSerp(keyword: string): SerpService {
  const results: SerpResult[] = [1, 2, 3, 4, 5].map((index) => ({
    url: `https://fake.local/${index}`,
    title: `Bai ${index} ve ${keyword}`,
    snippet: 'snippet',
    headings: {
      h1: `H1 ${index} ${keyword}`,
      h2: [`Section A ${index}`, `Section B ${index}`, `Section C ${index}`],
      h3: ['Sub 1', 'Sub 2'],
    },
    wordCount: 2000,
  }));
  return { topResults: async () => results } as unknown as SerpService;
}

function makeRegistry(provider: LlmProvider): LlmRegistry {
  return { select: () => provider } as unknown as LlmRegistry;
}

function makeStubProvider(content: string): LlmProvider {
  return {
    name: 'stub',
    available: false,
    generate: async () => ({
      content,
      tokensUsed: { input: 100, output: 600 },
      modelUsed: 'stub-model',
      costUsd: 0,
      isStub: true,
    }),
    generateStream: async function* () {
      yield { type: 'token', content };
      yield {
        type: 'finish',
        reason: 'end_turn',
        tokensUsed: { input: 100, output: 600 },
        costUsd: 0,
      };
    },
  };
}

describe('OutlineService', () => {
  it('returns a validated outline with metadata for the given keyword', async () => {
    const keyword = 'SEO local';
    const provider = makeStubProvider(stubOutlineFor(keyword));
    const service = new OutlineService(makeRedis(), makeSerp(keyword), makeRegistry(provider));

    const out = await service.generate({ keyword });

    expect(out.meta_title.toLowerCase()).toContain('seo local');
    expect(out.meta_description.toLowerCase()).toContain('seo local');
    expect(out.h1.toLowerCase()).toContain('seo local');
    expect(out.sections.length).toBeGreaterThanOrEqual(3);
    expect(out.metadata.is_stub).toBe(true);
    expect(out.metadata.based_on_serps).toHaveLength(5);
    expect(out.metadata.intent).toBe('info');
    expect(out.metadata.format).toBe('blog');
    expect(out.metadata.target_word_count).toBe(2000);
  });

  it('detects transactional intent for purchase-style keywords', async () => {
    const keyword = 'mua phan mem SEO gia re';
    const provider = makeStubProvider(stubOutlineFor(keyword));
    const service = new OutlineService(makeRedis(), makeSerp(keyword), makeRegistry(provider));

    const out = await service.generate({ keyword });
    expect(out.metadata.intent).toBe('transactional');
  });

  it('detects commercial intent for review-style keywords', async () => {
    const keyword = 'so sanh Ahrefs vs Semrush tot nhat';
    const provider = makeStubProvider(stubOutlineFor(keyword));
    const service = new OutlineService(makeRedis(), makeSerp(keyword), makeRegistry(provider));

    const out = await service.generate({ keyword });
    expect(out.metadata.intent).toBe('commercial');
  });

  it('returns the cached result on second call', async () => {
    const keyword = 'content marketing';
    const provider = makeStubProvider(stubOutlineFor(keyword));
    const spy = jest.spyOn(provider, 'generate');
    const service = new OutlineService(makeRedis(), makeSerp(keyword), makeRegistry(provider));

    const first = await service.generate({ keyword });
    const second = await service.generate({ keyword });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(second.metadata.cached).toBe(true);
    expect(second.h1).toBe(first.h1);
  });

  it('strips markdown code fences before parsing', async () => {
    const keyword = 'lam seo';
    const wrapped = `\`\`\`json\n${stubOutlineFor(keyword)}\n\`\`\``;
    const provider = makeStubProvider(wrapped);
    const service = new OutlineService(makeRedis(), makeSerp(keyword), makeRegistry(provider));

    const out = await service.generate({ keyword });
    expect(out.sections.length).toBeGreaterThan(0);
  });

  it('patches missing keyword into h1 and metadata', async () => {
    const keyword = 'mot keyword cu the';
    const wrong = {
      meta_title: 'Tieu de khong lien quan',
      meta_description:
        'Mo ta khong lien quan va cung khong chua keyword nen service can tu sua lai de tranh outline bi thieu metadata can thiet cho bai viet SEO hoan chinh.',
      h1: 'Tieu de khong lien quan',
      sections: [
        {
          h2: 'Section mot',
          subsections: [{ h3: 'Sub mot', bullets: ['bullet mot'] }],
        },
        {
          h2: 'Section hai',
          subsections: [{ h3: 'Sub hai', bullets: ['bullet hai'] }],
        },
        {
          h2: 'Section ba',
          subsections: [{ h3: 'Sub ba', bullets: ['bullet ba'] }],
        },
      ],
    };
    const provider = makeStubProvider(JSON.stringify(wrong));
    const service = new OutlineService(makeRedis(), makeSerp(keyword), makeRegistry(provider));

    const out = await service.generate({ keyword });
    expect(out.meta_title.toLowerCase()).toContain('keyword');
    expect(out.meta_description.toLowerCase()).toContain('keyword');
    expect(out.h1.toLowerCase()).toContain(keyword);
  });

  it('throws AI_PROVIDER_ERROR after 2 failed JSON parses', async () => {
    const provider = makeStubProvider('not valid json at all');
    const service = new OutlineService(
      makeRedis(),
      makeSerp('failure case'),
      makeRegistry(provider),
    );

    await expect(service.generate({ keyword: 'failure case' })).rejects.toMatchObject({
      response: {
        code: 'AI_PROVIDER_ERROR',
      },
    });
  });

  it('rejects outlines that fail Zod shape validation', async () => {
    const broken = JSON.stringify({
      meta_title: 'short',
      meta_description: 'too short',
      h1: 'short',
      sections: [],
    });
    const provider = makeStubProvider(broken);
    const service = new OutlineService(makeRedis(), makeSerp('broken'), makeRegistry(provider));

    await expect(service.generate({ keyword: 'broken' })).rejects.toMatchObject({
      response: { code: 'AI_PROVIDER_ERROR' },
    });
  });
});
