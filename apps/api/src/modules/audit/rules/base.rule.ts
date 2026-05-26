/**
 * Section 8 TN7 — ScoringRule contract (Chain of Responsibility pattern).
 * Each rule is a self-contained @Injectable so we can register new rules
 * without touching the orchestrator (Section 2 principle 3 — plugin-ready).
 */

export interface AuditInput {
  /** Article title (plain text). */
  title: string;
  /** HTML content (cheerio-parsable). */
  content: string;
  /** Markdown copy (optional — used by a couple of rules when present). */
  content_markdown?: string;
  /** Search-engine title (≤60 chars expected). */
  meta_title: string;
  /** Meta description (140-160 chars expected). */
  meta_description: string;
  /** Primary target keyword (required). */
  target_keyword: string;
  /** Optional secondary keywords / LSI candidates. */
  secondary_keywords?: string[];
  /** "info" | "commercial" | "transactional" | "navigational" — affects word-count rule. */
  intent?: string;
  /** Site URL or base URL — used to distinguish internal vs external links. */
  base_url?: string;
}

export type RuleStatus = 'good' | 'warning' | 'fail';

export interface RuleSuggestion {
  text: string;
  /** "auto-fixable" suggests AutoFixService can rewrite to satisfy. */
  action: 'manual' | 'auto-fixable';
}

export interface RuleResult {
  rule_id: string;
  name: string;
  score: number; // 0-100
  weight: number; // 0-1 (sum across all rules = 1.0)
  status: RuleStatus;
  message: string;
  suggestions: RuleSuggestion[];
  /** Free-form metric snapshot — surfaced in API + UI. */
  metrics?: Record<string, number | string | boolean>;
}

export interface ScoringRule {
  readonly id: string;
  readonly name: string;
  readonly weight: number;
  evaluate(input: AuditInput): RuleResult | Promise<RuleResult>;
}

export const SCORING_RULES = Symbol('SCORING_RULES');

// ----- shared helpers -----

export function statusFromScore(score: number): RuleStatus {
  if (score >= 80) return 'good';
  if (score >= 50) return 'warning';
  return 'fail';
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildKeywordRegex(keyword: string, flags = 'gi'): RegExp {
  return new RegExp(`\\b${escapeRegex(keyword)}\\b`, flags);
}
