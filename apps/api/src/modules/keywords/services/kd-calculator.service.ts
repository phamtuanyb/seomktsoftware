import { Injectable } from '@nestjs/common';

export interface KdInput {
  keyword: string;
  volume: number | null;
  competition: 'low' | 'medium' | 'high' | null;
}

export interface KdResult {
  kd: number; // 0-100
  notes: string[];
}

/**
 * Section 8 TN2 — Keyword Difficulty heuristic.
 *
 * Spec formula uses top-10 SERP signals (DA, backlinks, content length,
 * domain age). Until the SERP crawler ships in Sprint 7+, we fall back to a
 * lightweight heuristic combining the volume + competition hints from
 * DataForSEO with a few keyword-shape features. Output is roughly aligned
 * with Ahrefs ±15 for the keywords we tested in dev.
 *
 * Bands:
 *   0-19   trivial
 *   20-39  easy
 *   40-59  medium
 *   60-79  hard
 *   80-100 very hard
 */
@Injectable()
export class KdCalculatorService {
  private static readonly HARD_QUALIFIERS = [
    'best',
    'top',
    'review',
    'tốt nhất',
    'top',
    'mua',
    'giá',
    'so sánh',
  ];
  private static readonly EASY_QUALIFIERS = [
    'là gì',
    'cách',
    'how to',
    'tutorial',
    'hướng dẫn',
    'cho người mới',
  ];

  compute(input: KdInput): KdResult {
    const notes: string[] = [];
    let score = 35; // base medium

    // 1) Volume contribution (higher volume = generally more competitive).
    if (input.volume != null) {
      if (input.volume >= 50_000) {
        score += 25;
        notes.push('Volume rất cao (≥50K)');
      } else if (input.volume >= 10_000) {
        score += 15;
        notes.push('Volume cao (≥10K)');
      } else if (input.volume >= 1000) {
        score += 5;
        notes.push('Volume trung bình');
      } else if (input.volume < 100) {
        score -= 10;
        notes.push('Volume thấp');
      }
    } else {
      notes.push('Không có volume data');
    }

    // 2) Competition signal from DataForSEO.
    if (input.competition === 'high') {
      score += 15;
      notes.push('Competition: high');
    } else if (input.competition === 'medium') {
      score += 5;
    } else if (input.competition === 'low') {
      score -= 5;
      notes.push('Competition: low');
    }

    // 3) Keyword shape heuristics.
    const lc = input.keyword.toLowerCase();
    const wordCount = input.keyword.trim().split(/\s+/).length;
    if (wordCount <= 1) {
      score += 15;
      notes.push('Single-word (head term)');
    } else if (wordCount >= 5) {
      score -= 10;
      notes.push('Long-tail (≥5 words)');
    }

    for (const q of KdCalculatorService.HARD_QUALIFIERS) {
      if (lc.includes(q)) {
        score += 8;
        notes.push(`Hard qualifier: "${q}"`);
        break;
      }
    }
    for (const q of KdCalculatorService.EASY_QUALIFIERS) {
      if (lc.includes(q)) {
        score -= 6;
        notes.push(`Easy qualifier: "${q}"`);
        break;
      }
    }

    score = Math.max(0, Math.min(100, Math.round(score)));
    return { kd: score, notes };
  }
}
