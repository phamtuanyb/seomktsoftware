/**
 * Section 8 TN1 — Keyword source abstraction. Strategy pattern (Section 5)
 * so the suggestion service can fan out across multiple sources in parallel.
 */

export type KeywordSourceName = 'google_suggest' | 'bing_suggest' | 'paa' | 'manual';

export interface KeywordSourceQuery {
  seed: string;
  language: string;
  country: string;
  /** Max keywords this provider should return. */
  limit: number;
}

export interface KeywordSuggestion {
  keyword: string;
  source: KeywordSourceName;
  /** Provider-specific raw rank (1 = top). Used downstream for sort stability. */
  rank?: number;
}

export interface KeywordSourceResult {
  source: KeywordSourceName;
  suggestions: KeywordSuggestion[];
  /** Wall-clock time spent fetching, milliseconds. */
  duration_ms: number;
  /** True when the provider returned canned data because creds were missing or the live call failed. */
  is_stub: boolean;
  /** Set when the provider hit an error and fell back to stub. Helps debugging. */
  error?: string;
}

export interface KeywordSourceProvider {
  readonly source: KeywordSourceName;
  fetch(query: KeywordSourceQuery): Promise<KeywordSourceResult>;
}

export const KEYWORD_SOURCES_REGISTRY = Symbol('KEYWORD_SOURCES_REGISTRY');
