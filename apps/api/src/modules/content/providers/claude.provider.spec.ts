import { ConfigService } from '@nestjs/config';
import { ClaudeProvider } from './claude.provider';

function makeCfg(key: string | undefined): ConfigService {
  return {
    get: (path: string) => {
      if (path === 'ai.anthropicApiKey') return key;
      return undefined;
    },
  } as unknown as ConfigService;
}

describe('ClaudeProvider — stub mode', () => {
  let provider: ClaudeProvider;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-...';
    provider = new ClaudeProvider(makeCfg('sk-ant-...'));
  });

  it('reports unavailable when the key is the placeholder', () => {
    expect(provider.available).toBe(false);
  });

  it('returns a JSON outline when the prompt mentions "outline"', async () => {
    const result = await provider.generate({
      prompt: 'Tạo outline cho keyword: "SEO cơ bản"',
    });

    expect(result.isStub).toBe(true);
    expect(result.costUsd).toBe(0);
    expect(result.modelUsed).toMatch(/-stub$/);

    const parsed = JSON.parse(result.content);
    expect(parsed.h1).toContain('SEO cơ bản');
    expect(Array.isArray(parsed.sections)).toBe(true);
    expect(parsed.sections.length).toBeGreaterThanOrEqual(3);
  });

  it('returns prose content when the prompt is not an outline request', async () => {
    const result = await provider.generate({
      prompt: 'Viết bài đầy đủ về chủ đề content marketing',
    });

    expect(result.isStub).toBe(true);
    expect(result.content).toContain('[STUB]');
    expect(result.content.length).toBeGreaterThan(500);
  });

  it('streams chunks then a finish event', async () => {
    const chunks: string[] = [];
    let finishReason: string | undefined;
    let outputTokens = 0;

    for await (const event of provider.generateStream({
      prompt: 'Tạo outline cho keyword: "kiểm thử stream"',
    })) {
      if (event.type === 'token') chunks.push(event.content);
      if (event.type === 'finish') {
        finishReason = event.reason;
        outputTokens = event.tokensUsed.output;
      }
    }

    expect(chunks.length).toBeGreaterThan(1);
    expect(finishReason).toBe('end_turn');
    expect(outputTokens).toBeGreaterThan(0);
  });
});

describe('ClaudeProvider — placeholder detection', () => {
  it('treats empty string as placeholder', () => {
    const p = new ClaudeProvider(makeCfg(''));
    expect(p.available).toBe(false);
  });

  it('treats undefined as placeholder', () => {
    delete process.env.ANTHROPIC_API_KEY;
    const p = new ClaudeProvider(makeCfg(undefined));
    expect(p.available).toBe(false);
  });

  it('treats values ending with "..." as placeholder', () => {
    const p = new ClaudeProvider(makeCfg('sk-ant-abcd...'));
    expect(p.available).toBe(false);
  });

  it('considers a long, non-placeholder string as available', () => {
    const fake = 'sk-ant-api03-' + 'A'.repeat(80);
    const p = new ClaudeProvider(makeCfg(fake));
    expect(p.available).toBe(true);
  });
});
