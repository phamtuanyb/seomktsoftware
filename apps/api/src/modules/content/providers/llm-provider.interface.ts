/**
 * Section 8 TN3/TN4 — LLM provider abstraction.
 * Strategy pattern (Section 5) so we can swap Anthropic ↔ OpenAI at runtime
 * via the `model` parameter, and so test code can inject a stub provider.
 */

export type LlmModel = 'claude-sonnet-4' | 'claude-haiku' | 'gpt-4o' | 'gpt-4o-mini' | 'stub';

export interface LlmGenerateOptions {
  /** System prompt — for Claude, sent as `system`; for OpenAI, role:'system'. */
  system?: string;
  /** User prompt — required. */
  prompt: string;
  /** Maximum output tokens. Defaults vary per task (outline ~3000, article ~6000). */
  maxTokens?: number;
  /** Sampling temperature 0-1. Default 0.7 for outline, 0.8 for article. */
  temperature?: number;
  /** Optional model override. */
  model?: LlmModel;
  /** Stop sequences (Claude only). */
  stopSequences?: string[];
}

export interface LlmGenerateResult {
  content: string;
  tokensUsed: { input: number; output: number };
  modelUsed: string;
  /** Best-effort USD cost based on published per-1M-token pricing. */
  costUsd: number;
  /** True when this came from the stub provider (no real API hit). */
  isStub: boolean;
}

export type LlmStreamEvent =
  | { type: 'token'; content: string }
  | { type: 'section_complete'; sectionId: string }
  | {
      type: 'finish';
      reason: string;
      tokensUsed: { input: number; output: number };
      costUsd: number;
    };

/** Each provider implements this same contract. */
export interface LlmProvider {
  readonly name: string;
  /**
   * `true` when the provider has a real API key configured. `false` when the
   * key is missing or still the .env.example placeholder — the provider then
   * returns canned stub responses. Callers can short-circuit if they need.
   */
  readonly available: boolean;

  generate(opts: LlmGenerateOptions): Promise<LlmGenerateResult>;

  /**
   * Stream tokens. Implementations MUST yield a final `finish` event so the
   * caller can flush metadata to the response.
   */
  generateStream(opts: LlmGenerateOptions): AsyncIterable<LlmStreamEvent>;
}

export const LLM_PROVIDER_CLAUDE = Symbol('LLM_PROVIDER_CLAUDE');
export const LLM_PROVIDER_OPENAI = Symbol('LLM_PROVIDER_OPENAI');
export const LLM_PROVIDER_REGISTRY = Symbol('LLM_PROVIDER_REGISTRY');

/** Maps the spec's `model` string to a provider key + concrete API model. */
export function resolveModel(model?: LlmModel): {
  providerKey: typeof LLM_PROVIDER_CLAUDE | typeof LLM_PROVIDER_OPENAI;
  apiModel: string;
} {
  switch (model) {
    case 'gpt-4o':
      return { providerKey: LLM_PROVIDER_OPENAI, apiModel: 'gpt-4o' };
    case 'gpt-4o-mini':
      return { providerKey: LLM_PROVIDER_OPENAI, apiModel: 'gpt-4o-mini' };
    case 'claude-haiku':
      return { providerKey: LLM_PROVIDER_CLAUDE, apiModel: 'claude-haiku-4-5-20251001' };
    case 'claude-sonnet-4':
    default:
      // Spec Section 4: "Claude (Sonnet 4 + Haiku)". Latest production Sonnet
      // at the time of writing is claude-sonnet-4-6.
      return { providerKey: LLM_PROVIDER_CLAUDE, apiModel: 'claude-sonnet-4-6' };
  }
}

/** Returns true when the env var looks like the .env.example placeholder. */
export function isPlaceholderKey(value: string | undefined): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  // .env.example uses "sk-ant-..." for Anthropic and "sk-..." for OpenAI.
  if (trimmed.endsWith('...')) return true;
  if (trimmed === 'sk-ant-...' || trimmed === 'sk-...') return true;
  return false;
}
