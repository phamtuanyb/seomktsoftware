import { Injectable } from '@nestjs/common';
import { marked } from 'marked';

export interface PostProcessInput {
  markdown: string;
  keyword: string;
  /** When true, append JSON-LD Article + FAQPage schema to the HTML head fragment. */
  enableSchemaMarkup?: boolean;
}

export interface PostProcessOutput {
  /** Markdown after keyword bolding pass. */
  markdownProcessed: string;
  /** Compiled HTML body (may include the inline <script type="application/ld+json"> block). */
  html: string;
  meta_title: string;
  meta_description: string;
  /** 0-100 quick score until TN7 ships the 12-rule audit. */
  content_score: number;
  content_score_breakdown: Record<string, { score: number; passed: boolean; note?: string }>;
  word_count: number;
  keyword_count: number;
  keyword_density: number;
  /** Distinct LSI candidate tokens we found in the body. */
  lsi_keywords: string[];
}

/**
 * TN4 post-processing pipeline. Runs after the LLM finishes streaming.
 * Stays deterministic so we can unit-test it without re-hitting the LLM.
 *
 * Steps:
 *   1. Bold the target keyword 3-5 times via case-insensitive regex (skip
 *      occurrences already inside `**...**` or markdown headings).
 *   2. Compile markdown → HTML via `marked` (GFM defaults).
 *   3. Generate meta_title (≤60 chars, contains keyword) and meta_description
 *      (140-160 chars, contains keyword) from the first paragraph + H1.
 *   4. Compute a quick content_score (Section 8 TN7 has the real 12 rules).
 *   5. Optionally inject JSON-LD Article + FAQPage schema at the top of HTML.
 */
@Injectable()
export class ArticlePostProcessService {
  process(input: PostProcessInput): PostProcessOutput {
    const keyword = input.keyword.trim();
    const markdownProcessed = this.boldKeyword(input.markdown, keyword, 4);

    const htmlBody = marked.parse(markdownProcessed, { async: false, gfm: true }) as string;
    const h1 = this.extractH1(markdownProcessed);
    const intro = this.extractIntroParagraph(markdownProcessed);

    const meta_title = this.makeMetaTitle(h1, keyword);
    const meta_description = this.makeMetaDescription(intro, keyword);

    const wordCount = this.countWords(this.stripMarkdown(markdownProcessed));
    const keywordCount = this.countOccurrences(markdownProcessed, keyword);
    const keywordDensity = wordCount > 0 ? keywordCount / wordCount : 0;
    const lsi = this.extractLsiCandidates(markdownProcessed, keyword);

    const score = this.quickScore({
      h1,
      keyword,
      markdown: markdownProcessed,
      wordCount,
      keywordCount,
      keywordDensity,
    });

    const html = input.enableSchemaMarkup
      ? this.injectSchemaMarkup(htmlBody, {
          h1,
          meta_description,
          keyword,
          markdown: markdownProcessed,
        })
      : htmlBody;

    return {
      markdownProcessed,
      html,
      meta_title,
      meta_description,
      content_score: score.total,
      content_score_breakdown: score.breakdown,
      word_count: wordCount,
      keyword_count: keywordCount,
      keyword_density: keywordDensity,
      lsi_keywords: lsi,
    };
  }

  // ----- keyword bolding -----

  /** Bolds the keyword up to `targetCount` times. Skips occurrences inside headings or already-bold. */
  boldKeyword(markdown: string, keyword: string, targetCount: number): string {
    if (!keyword) return markdown;
    const regex = new RegExp(`(?<!\\*\\*)\\b(${this.escapeRegex(keyword)})\\b(?!\\*\\*)`, 'gi');
    let count = 0;
    return markdown.replace(regex, (match, _g1, offset) => {
      if (count >= targetCount) return match;
      // Skip occurrences inside heading lines.
      const lineStart = markdown.lastIndexOf('\n', offset) + 1;
      const lineEnd = markdown.indexOf('\n', offset);
      const line = markdown.slice(lineStart, lineEnd === -1 ? markdown.length : lineEnd);
      if (/^#+\s/.test(line)) return match;
      count++;
      return `**${match}**`;
    });
  }

  // ----- meta generation -----

  private makeMetaTitle(h1: string, keyword: string): string {
    const stripped = h1
      .replace(/^\[STUB\]\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    let title = stripped;
    if (!title.toLowerCase().includes(keyword.toLowerCase())) {
      title = `${keyword} — ${title}`;
    }
    if (title.length > 60) title = title.slice(0, 57).trimEnd() + '...';
    return title;
  }

  private makeMetaDescription(intro: string, keyword: string): string {
    const plain = this.stripMarkdown(intro).replace(/\s+/g, ' ').trim();
    let desc = plain;
    if (!desc.toLowerCase().includes(keyword.toLowerCase())) {
      desc = `${keyword}: ${desc}`;
    }
    if (desc.length < 140) {
      const fillers = [
        `Tìm hiểu chi tiết về ${keyword} ngay trong bài viết.`,
        `Đầy đủ hướng dẫn về ${keyword} cho năm 2026.`,
        `Bao gồm các bước cụ thể, ví dụ thực tế và FAQ.`,
        `Phù hợp cho người mới bắt đầu lẫn người có kinh nghiệm.`,
      ];
      for (const f of fillers) {
        if (desc.length >= 140) break;
        desc = `${desc} ${f}`;
      }
    }
    if (desc.length > 160) {
      desc = desc.slice(0, 157).trimEnd() + '...';
    }
    return desc;
  }

  // ----- score (placeholder until TN7) -----

  private quickScore(args: {
    h1: string;
    keyword: string;
    markdown: string;
    wordCount: number;
    keywordCount: number;
    keywordDensity: number;
  }): {
    total: number;
    breakdown: Record<string, { score: number; passed: boolean; note?: string }>;
  } {
    const lc = (s: string) => s.toLowerCase();
    const breakdown: Record<string, { score: number; passed: boolean; note?: string }> = {};

    const titleHasKeyword = lc(args.h1).includes(lc(args.keyword));
    breakdown['title_keyword'] = {
      score: titleHasKeyword ? 100 : 50,
      passed: titleHasKeyword,
      note: titleHasKeyword ? undefined : 'H1 không chứa keyword',
    };

    const wcOk = args.wordCount >= 1500;
    breakdown['word_count'] = {
      score: Math.min(100, Math.round((args.wordCount / 2000) * 100)),
      passed: wcOk,
      note: wcOk ? undefined : `Mới ${args.wordCount} từ, cần ≥1500`,
    };

    const kdOk = args.keywordDensity >= 0.005 && args.keywordDensity <= 0.025;
    breakdown['keyword_density'] = {
      score: kdOk ? 100 : args.keywordDensity > 0.025 ? 40 : 60,
      passed: kdOk,
      note: kdOk
        ? undefined
        : `Mật độ ${(args.keywordDensity * 100).toFixed(2)}% nằm ngoài 0.5-2.5%`,
    };

    const headingCount = (args.markdown.match(/^##\s/gm) ?? []).length;
    breakdown['heading_structure'] = {
      score: headingCount >= 5 ? 100 : Math.round((headingCount / 5) * 100),
      passed: headingCount >= 5,
      note: headingCount >= 5 ? undefined : `Mới ${headingCount} H2, cần ≥5`,
    };

    const hasFaq = /\b(faq|câu hỏi thường gặp|q&a)\b/i.test(args.markdown);
    breakdown['faq_section'] = {
      score: hasFaq ? 100 : 0,
      passed: hasFaq,
      note: hasFaq ? undefined : 'Không phát hiện FAQ section',
    };

    const hasConclusion = /\b(kết luận|conclusion|tổng kết|tóm lại)\b/i.test(args.markdown);
    breakdown['intro_hook'] = {
      score: hasConclusion ? 100 : 70,
      passed: hasConclusion,
    };

    const total = Math.round(
      Object.values(breakdown).reduce((sum, v) => sum + v.score, 0) / Object.keys(breakdown).length,
    );
    return { total, breakdown };
  }

  // ----- schema markup -----

  private injectSchemaMarkup(
    htmlBody: string,
    ctx: { h1: string; meta_description: string; keyword: string; markdown: string },
  ): string {
    const articleSchema = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: ctx.h1,
      description: ctx.meta_description,
      keywords: [ctx.keyword],
      datePublished: new Date().toISOString(),
    };

    const faqItems = this.extractFaqQuestions(ctx.markdown);
    const faqSchema =
      faqItems.length >= 3
        ? {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqItems.map((q) => ({
              '@type': 'Question',
              name: q.question,
              acceptedAnswer: { '@type': 'Answer', text: q.answer },
            })),
          }
        : null;

    const scripts = [
      `<script type="application/ld+json">${JSON.stringify(articleSchema)}</script>`,
      faqSchema ? `<script type="application/ld+json">${JSON.stringify(faqSchema)}</script>` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return `${scripts}\n${htmlBody}`;
  }

  private extractFaqQuestions(markdown: string): Array<{ question: string; answer: string }> {
    const out: Array<{ question: string; answer: string }> = [];
    // Find the FAQ H2 block.
    const faqRegex =
      /^##\s+(?:faq|câu hỏi thường gặp|q&a)[^\n]*\n([\s\S]*?)(?=^##\s|$(?![\s\S]))/im;
    const block = markdown.match(faqRegex)?.[1];
    if (!block) return out;
    // Within the block, H3 = question, paragraph after = answer.
    const h3Regex = /^###\s+(.+)$([\s\S]*?)(?=^###\s|$(?![\s\S]))/gm;
    let match: RegExpExecArray | null;
    while ((match = h3Regex.exec(block)) !== null) {
      const question = (match[1] ?? '').trim();
      const answer = this.stripMarkdown(match[2] ?? '')
        .trim()
        .slice(0, 600);
      if (question && answer) out.push({ question, answer });
    }
    return out;
  }

  // ----- LSI candidate extraction (heuristic) -----

  private extractLsiCandidates(markdown: string, keyword: string): string[] {
    const plain = this.stripMarkdown(markdown).toLowerCase();
    const tokens = plain.match(/\b[\p{L}]{4,}\b/gu) ?? [];
    const freq = new Map<string, number>();
    const STOP = new Set([
      'một',
      'những',
      'cũng',
      'được',
      'không',
      'này',
      'cho',
      'với',
      'như',
      'của',
      'có',
      'và',
      'là',
      'từ',
      'trong',
      'khi',
      'đến',
      'mà',
      'thì',
      'sẽ',
      'bạn',
      'them',
      'them',
      'this',
      'that',
      'with',
      'from',
      'have',
      'will',
      'your',
    ]);
    const keywordTokens = new Set(keyword.toLowerCase().split(/\s+/));
    for (const tok of tokens) {
      if (STOP.has(tok)) continue;
      if (keywordTokens.has(tok)) continue;
      freq.set(tok, (freq.get(tok) ?? 0) + 1);
    }
    return [...freq.entries()]
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([w]) => w);
  }

  // ----- markdown helpers -----

  private extractH1(markdown: string): string {
    const match = markdown.match(/^#\s+(.+)$/m);
    return (match?.[1] ?? '').trim();
  }

  private extractIntroParagraph(markdown: string): string {
    const lines = markdown.split('\n');
    let started = false;
    const buf: string[] = [];
    for (const line of lines) {
      if (/^#\s/.test(line)) {
        started = true;
        continue;
      }
      if (!started) continue;
      if (/^#{2,}\s/.test(line)) break;
      if (line.trim()) buf.push(line.trim());
      if (buf.length && !line.trim() && buf.join(' ').length > 60) break;
    }
    return buf.join(' ').slice(0, 400);
  }

  private stripMarkdown(md: string): string {
    return md
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^#+\s+/gm, '')
      .replace(/^[-*+]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '');
  }

  private countWords(text: string): number {
    const cleaned = text.trim();
    return cleaned ? cleaned.split(/\s+/).length : 0;
  }

  private countOccurrences(text: string, needle: string): number {
    if (!needle) return 0;
    const regex = new RegExp(`\\b${this.escapeRegex(needle)}\\b`, 'gi');
    return (text.match(regex) ?? []).length;
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
