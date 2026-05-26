import { api } from './client';

export type RuleStatus = 'good' | 'warning' | 'fail';

export interface RuleSuggestion {
  text: string;
  action: 'manual' | 'auto-fixable';
}

export interface RuleResult {
  rule_id: string;
  name: string;
  score: number;
  weight: number;
  status: RuleStatus;
  message: string;
  suggestions: RuleSuggestion[];
  metrics?: Record<string, number | string | boolean>;
}

export interface AuditReport {
  score: number;
  status: RuleStatus;
  breakdown: Record<string, RuleResult>;
  prioritized: Array<{ rule_id: string; impact: number }>;
  source: 'article' | 'inline';
  article_id?: string;
  duration_ms: number;
}

export interface ScoreRequest {
  article_id?: string;
  title?: string;
  content?: string;
  /** Sprint 6.6 — server converts to HTML before scoring. Use for live editor preview. */
  content_markdown?: string;
  meta_title?: string;
  meta_description?: string;
  target_keyword: string;
  secondary_keywords?: string[];
  intent?: 'info' | 'commercial' | 'transactional' | 'navigational';
  base_url?: string;
}

export interface AutoFixRequest {
  article_id: string;
  rule_ids?: string[];
}

export interface AutoFixReport {
  article_id: string;
  before: { score: number; failing_rules: string[] };
  after: { score: number; failing_rules: string[] };
  improved: boolean;
  rules_targeted: string[];
  ai_model: string;
  cost_usd: number;
  is_stub: boolean;
  duration_ms: number;
}

export const auditApi = {
  score: (body: ScoreRequest) => api.post<AuditReport>('/audit/score', body),
  autoFix: (body: AutoFixRequest) => api.post<AutoFixReport>('/audit/auto-fix', body),
};
