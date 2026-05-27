import { z } from 'zod';

/**
 * Section 8 TN3 output schema. The LLM is instructed to return raw JSON that
 * matches this shape; we validate every response before persisting so model
 * drift never reaches the consumer.
 */
export const outlineSubsectionSchema = z.object({
  h3: z.string().min(2).max(200),
  bullets: z.array(z.string().min(2).max(300)).min(1).max(8),
});

export const outlineSectionSchema = z.object({
  h2: z.string().min(2).max(200),
  subsections: z.array(outlineSubsectionSchema).min(1).max(4),
});

export const outlineSchema = z.object({
  meta_title: z.string().min(10).max(70),
  meta_description: z.string().min(120).max(165),
  h1: z.string().min(5).max(300),
  sections: z.array(outlineSectionSchema).min(3).max(6),
});

export type OutlineSubsection = z.infer<typeof outlineSubsectionSchema>;
export type OutlineSection = z.infer<typeof outlineSectionSchema>;
export type Outline = z.infer<typeof outlineSchema>;

export interface OutlineWithMetadata {
  meta_title: Outline['meta_title'];
  meta_description: Outline['meta_description'];
  h1: Outline['h1'];
  sections: Outline['sections'];
  metadata: {
    based_on_serps: string[];
    ai_model: string;
    tokens_used: { input: number; output: number };
    cost_usd: number;
    is_stub: boolean;
    target_word_count: number;
    intent: string;
    format: string;
    language: string;
    cached: boolean;
    generated_at: string;
  };
}
