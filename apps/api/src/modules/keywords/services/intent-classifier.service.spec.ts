import { IntentClassifierService } from './intent-classifier.service';
import type { LlmRegistry } from '../../content/providers/llm-registry.service';
import type { LlmProvider } from '../../content/providers/llm-provider.interface';

function makeRegistry(provider: LlmProvider): LlmRegistry {
  return { select: () => provider } as unknown as LlmRegistry;
}

function makeStubProvider(available: boolean, content?: string): LlmProvider {
  return {
    name: 'claude',
    available,
    generate: async () => ({
      content: content ?? '[]',
      tokensUsed: { input: 100, output: 100 },
      modelUsed: 'stub',
      costUsd: 0,
      isStub: true,
    }),
    generateStream: async function* () {
      yield {
        type: 'finish',
        reason: 'end_turn',
        tokensUsed: { input: 100, output: 100 },
        costUsd: 0,
      };
    },
  };
}

describe('IntentClassifierService — rule-based fallback', () => {
  let svc: IntentClassifierService;

  beforeEach(() => {
    svc = new IntentClassifierService(makeRegistry(makeStubProvider(false)));
  });

  it('detects transactional intent', () => {
    expect(svc.classifyByRule('mua phần mềm SEO').intent).toBe('transactional');
    expect(svc.classifyByRule('buy SEO software cheap').intent).toBe('transactional');
  });

  it('detects commercial intent', () => {
    expect(svc.classifyByRule('so sánh Ahrefs vs Semrush').intent).toBe('commercial');
    expect(svc.classifyByRule('best SEO tools 2026').intent).toBe('commercial');
  });

  it('detects info intent', () => {
    expect(svc.classifyByRule('SEO là gì').intent).toBe('info');
    expect(svc.classifyByRule('how to start SEO').intent).toBe('info');
  });

  it('detects navigational for known brands', () => {
    expect(svc.classifyByRule('facebook ads').intent).toBe('navigational');
  });

  it('defaults to info with low confidence when no rule matches', () => {
    const r = svc.classifyByRule('random misc string xyz');
    expect(r.intent).toBe('info');
    expect(r.confidence).toBe(0.5);
  });

  it('returns rule-based when provider is unavailable (stub)', async () => {
    const results = await svc.classifyBatch(['SEO là gì', 'mua iphone 15', 'so sánh laptop']);
    expect(results.map((r) => r.intent)).toEqual(['info', 'transactional', 'commercial']);
    expect(results.every((r) => r.method === 'rule')).toBe(true);
  });
});

describe('IntentClassifierService — AI path with fallback', () => {
  it('uses AI result when confidence ≥ 0.7', async () => {
    const ai = JSON.stringify([
      { keyword: 'seo là gì', intent: 'info', confidence: 0.92 },
      { keyword: 'mua phần mềm seo', intent: 'transactional', confidence: 0.88 },
    ]);
    const svc = new IntentClassifierService(makeRegistry(makeStubProvider(true, ai)));
    const results = await svc.classifyBatch(['seo là gì', 'mua phần mềm seo']);
    expect(results[0]!.method).toBe('ai');
    expect(results[0]!.confidence).toBeCloseTo(0.92, 2);
    expect(results[1]!.intent).toBe('transactional');
  });

  it('falls back to rule when AI confidence is low', async () => {
    const ai = JSON.stringify([{ keyword: 'seo là gì', intent: 'commercial', confidence: 0.3 }]);
    const svc = new IntentClassifierService(makeRegistry(makeStubProvider(true, ai)));
    const results = await svc.classifyBatch(['seo là gì']);
    expect(results[0]!.method).toBe('rule');
    expect(results[0]!.intent).toBe('info'); // rule wins
  });

  it('falls back to rule when AI returns invalid JSON', async () => {
    const svc = new IntentClassifierService(makeRegistry(makeStubProvider(true, 'not json')));
    const results = await svc.classifyBatch(['mua iphone']);
    expect(results[0]!.method).toBe('rule');
    expect(results[0]!.intent).toBe('transactional');
  });
});
