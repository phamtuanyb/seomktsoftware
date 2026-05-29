import { z } from 'zod';

/**
 * Section 8 TN5 — Brand Voice Profile JSON shape.
 *
 * Claude returns this; we Zod-validate before persisting so model drift
 * never corrupts a saved profile. Numeric ranges are clamped so the UI
 * can render percentages safely.
 */
export const brandVoiceProfileSchema = z.object({
  tone: z.object({
    primary: z.string().min(2).max(100),
    secondary: z.array(z.string().min(2).max(100)).max(5).default([]),
    confidence: z.number().min(0).max(1),
  }),
  sentence_structure: z.object({
    avg_words_per_sentence: z.number().int().min(3).max(80),
    short_sentences_pct: z.number().min(0).max(100),
    long_sentences_pct: z.number().min(0).max(100),
  }),
  addressing: z.object({
    primary: z.string().min(1).max(40),
    formality: z.enum(['low', 'medium', 'high']).or(z.string().min(2).max(40)),
    self_reference: z.string().min(1).max(40).optional(),
  }),
  signature_phrases: z.array(z.string().min(2).max(120)).max(15).default([]),
  vocabulary: z.object({
    complexity: z.enum(['simple', 'medium', 'advanced']).or(z.string().min(2).max(40)),
    domain_terms: z.array(z.string().min(2).max(60)).max(30).default([]),
    preferred: z.array(z.string().min(2).max(80)).max(20).default([]),
    avoided: z.array(z.string().min(2).max(80)).max(20).default([]),
  }),
  emoji_usage: z.object({
    enabled: z.boolean(),
    density: z.enum(['none', 'sparse', 'medium', 'heavy']).or(z.string().min(2).max(40)),
    common_emojis: z.array(z.string().min(1).max(8)).max(10).default([]),
  }),
  paragraph_rhythm: z.object({
    avg_sentences_per_paragraph: z.number().int().min(1).max(8),
    preferred_paragraph_style: z.string().min(2).max(200),
  }),
  heading_style: z.object({
    h2_pattern: z.string().min(2).max(200),
    h3_pattern: z.string().min(2).max(200),
    prefers_questions: z.boolean(),
    prefers_numbers: z.boolean(),
  }),
  transitions: z.object({
    preferred: z.array(z.string().min(2).max(50)).max(12).default([]),
    avoided: z.array(z.string().min(2).max(50)).max(12).default([]),
  }),
  persuasion: z.object({
    evidence_style: z.string().min(2).max(200),
    sales_intensity: z.enum(['low', 'medium', 'high']).or(z.string().min(2).max(40)),
    objection_handling: z.string().min(2).max(200),
  }),
  forbidden_phrases: z.array(z.string().min(2).max(120)).max(20).default([]),
  patterns: z.object({
    opening_style: z.string().min(2).max(200),
    closing_style: z.string().min(2).max(200),
    cta_style: z.string().min(2).max(200),
  }),
});

export type BrandVoiceProfile = z.infer<typeof brandVoiceProfileSchema>;

export interface ProfileMeta {
  algorithm: 'claude-sonnet-4' | 'placeholder-heuristic';
  upgraded_to_real_at: string | null;
  sample_count: number;
  trained_at: string;
  /** Approx Claude tokens consumed during training. */
  tokens_used?: { input: number; output: number };
  cost_usd?: number;
}
