import { ProfileTrainerService } from './profile-trainer.service';
import type { LlmRegistry } from '../../content/providers/llm-registry.service';
import type { LlmProvider } from '../../content/providers/llm-provider.interface';

/**
 * Section 8 TN5 — unit coverage for ProfileTrainerService:
 *   • Heuristic path when provider.available=false.
 *   • Claude path with Zod validation on stub JSON.
 *   • Heuristic fallback when Claude returns invalid JSON.
 *   • Reference selection = 3 longest articles.
 */
describe('ProfileTrainerService', () => {
  const makeRegistry = (provider: Partial<LlmProvider>): LlmRegistry =>
    ({
      select: () => ({ available: false, generate: jest.fn(), ...provider }) as LlmProvider,
    }) as unknown as LlmRegistry;

  const article = (content: string, title = 'T'): { title: string; content: string } => ({
    title,
    content,
  });
  const longContent = (word: string, count = 3000): string => Array(count).fill(word).join(' ');

  it('throws when no article reaches the 3000-word floor', async () => {
    const trainer = new ProfileTrainerService(makeRegistry({ available: false }));
    await expect(trainer.train([article('short', 'x')])).rejects.toThrow(/≥3000 từ/);
  });

  it('returns a Zod-valid heuristic profile when provider.available=false', async () => {
    const trainer = new ProfileTrainerService(makeRegistry({ available: false }));
    const longA = `${longContent('Bạn nên đọc bài này.', 3000)} Câu ngắn.`;
    const result = await trainer.train([
      article(longA, 'A'),
      article(longA, 'B'),
      article(longA, 'C'),
    ]);

    expect(result.meta.algorithm).toBe('placeholder-heuristic');
    expect(result.meta.upgraded_to_real_at).toBeNull();
    expect(result.meta.sample_count).toBe(3);
    expect(result.profile.addressing.primary).toBe('bạn');
    expect(result.profile.sentence_structure.avg_words_per_sentence).toBeGreaterThan(0);
    expect(result.reference_articles).toHaveLength(3);
  });

  it('uses Claude output when provider returns valid JSON', async () => {
    const valid = {
      tone: { primary: 'authoritative', secondary: ['friendly'], confidence: 0.82 },
      sentence_structure: {
        avg_words_per_sentence: 18,
        short_sentences_pct: 25,
        long_sentences_pct: 30,
      },
      addressing: { primary: 'bạn', formality: 'medium' },
      signature_phrases: ['quan trọng nhất', 'cần lưu ý', 'kết luận lại'],
      vocabulary: { complexity: 'medium', domain_terms: ['SEO', 'CTR'] },
      emoji_usage: { enabled: false, density: 'none', common_emojis: [] },
      patterns: {
        opening_style: 'mở bằng câu hỏi gợi',
        closing_style: 'kết bằng tóm tắt + CTA mềm',
        cta_style: 'gợi ý nhẹ, không ép buộc',
      },
    };

    const generate = jest.fn().mockResolvedValue({
      content: JSON.stringify(valid),
      tokensUsed: { input: 1200, output: 350 },
      costUsd: 0.014,
    });

    const trainer = new ProfileTrainerService(
      makeRegistry({ available: true, generate } as Partial<LlmProvider>),
    );

    const long = longContent('alpha');
    const result = await trainer.train([
      article(long, 'A'),
      article(long, 'B'),
      article(long, 'C'),
    ]);

    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.meta.algorithm).toBe('claude-sonnet-4');
    expect(result.meta.upgraded_to_real_at).not.toBeNull();
    expect(result.meta.tokens_used).toEqual({ input: 1200, output: 350 });
    expect(result.meta.cost_usd).toBe(0.014);
    expect(result.profile.tone.primary).toBe('authoritative');
    expect(result.profile.signature_phrases).toHaveLength(3);
  });

  it('strips ```json fences before parsing', async () => {
    const valid = {
      tone: { primary: 'casual', secondary: [], confidence: 0.5 },
      sentence_structure: {
        avg_words_per_sentence: 12,
        short_sentences_pct: 40,
        long_sentences_pct: 10,
      },
      addressing: { primary: 'mình', formality: 'low' },
      signature_phrases: [],
      vocabulary: { complexity: 'simple', domain_terms: [] },
      emoji_usage: { enabled: true, density: 'sparse', common_emojis: ['😊'] },
      patterns: {
        opening_style: 'hook',
        closing_style: 'wrap',
        cta_style: 'soft',
      },
    };
    const generate = jest.fn().mockResolvedValue({
      content: '```json\n' + JSON.stringify(valid) + '\n```',
      tokensUsed: { input: 100, output: 50 },
      costUsd: 0.001,
    });
    const trainer = new ProfileTrainerService(
      makeRegistry({ available: true, generate } as Partial<LlmProvider>),
    );
    const long = longContent('beta');
    const result = await trainer.train([article(long), article(long), article(long)]);
    expect(result.meta.algorithm).toBe('claude-sonnet-4');
    expect(result.profile.tone.primary).toBe('casual');
  });

  it('falls back to heuristic when Claude returns invalid JSON', async () => {
    const generate = jest.fn().mockResolvedValue({
      content: 'not actually json {{{',
      tokensUsed: { input: 0, output: 0 },
      costUsd: 0,
    });
    const trainer = new ProfileTrainerService(
      makeRegistry({ available: true, generate } as Partial<LlmProvider>),
    );
    const long = longContent('charlie');
    const result = await trainer.train([article(long), article(long), article(long)]);
    expect(result.meta.algorithm).toBe('placeholder-heuristic');
    expect(result.meta.upgraded_to_real_at).toBeNull();
  });

  it('falls back when JSON parses but violates Zod schema', async () => {
    const broken = { tone: { primary: 'x' } }; // missing every other required key
    const generate = jest.fn().mockResolvedValue({
      content: JSON.stringify(broken),
      tokensUsed: { input: 0, output: 0 },
      costUsd: 0,
    });
    const trainer = new ProfileTrainerService(
      makeRegistry({ available: true, generate } as Partial<LlmProvider>),
    );
    const long = longContent('delta');
    const result = await trainer.train([article(long), article(long), article(long)]);
    expect(result.meta.algorithm).toBe('placeholder-heuristic');
  });

  it('picks the 3 longest articles as reference', async () => {
    const trainer = new ProfileTrainerService(makeRegistry({ available: false }));
    const result = await trainer.train([
      article('a'.repeat(200), 'shortest'),
      article(longContent('b', 3005), 'longest'),
      article(longContent('c', 3003), 'mid'),
      article('d'.repeat(300), 'second-shortest'),
      article(longContent('e', 3004), 'second-longest'),
    ]);
    expect(result.reference_articles.map((a) => a.title)).toEqual([
      'longest',
      'second-longest',
      'mid',
    ]);
  });
});
