import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { marked } from 'marked';
import { ErrorCode } from '@mkt-seo/shared';
import { PrismaService } from '../../../common/services/prisma.service';
import { LlmRegistry } from '../providers/llm-registry.service';
import { type ArticleTone } from '../dto/generate-article.dto';
import { type RegenerateSectionDto } from '../dto/rewrite-article.dto';
import { type RewriteDto } from '../dto/rewrite-article.dto';
import type { ArticleResult } from './article.service';
import { ArticleService } from './article.service';

const TONE_HINTS: Record<ArticleTone, string> = {
  expert: 'chuyên gia, dùng dữ liệu + số liệu, ít cảm xúc, ngôn ngữ trang trọng',
  friendly: 'thân thiện, gần gũi, dùng "bạn", có chút humor nhẹ',
  sales: 'thuyết phục, hướng CTA, nhấn mạnh USP, có lời kêu gọi rõ ràng',
  educational: 'giảng giải, dùng ví dụ minh họa, từng bước rõ ràng',
  storytelling: 'kể chuyện, có nhân vật + tình huống thật, gợi cảm xúc',
};

/**
 * Sprint 6.5 — Section 8 TN4 editor enhancements.
 *
 * Two LLM-driven operations on top of an existing article:
 *   1. regenerateSection: keep the ## H2 heading, replace the body underneath
 *      with a fresh Claude pass that respects the original article's keyword
 *      + tone.
 *   2. rewrite: shorter / longer / tone change / add details / free-form.
 *      Works on a text fragment (selection from the editor) OR the whole
 *      article when no fragment is supplied + apply=1.
 *
 * Both reuse ArticleService.update() so the markdown→HTML re-render +
 * word_count recalculation happen in one place.
 */
@Injectable()
export class ArticleEditorService {
  private static readonly REWRITE_MAX_TOKENS = 2500;
  private static readonly SECTION_MAX_TOKENS = 1800;

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmRegistry,
    private readonly articles: ArticleService,
  ) {}

  // ----- regenerate one H2 section -----

  async regenerateSection(
    userId: string,
    id: string,
    dto: RegenerateSectionDto,
  ): Promise<ArticleResult> {
    const article = await this.loadOwned(userId, id);
    const md = article.contentMarkdown ?? '';
    if (!md) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Bài viết chưa có markdown để regenerate.',
      });
    }

    const section = this.findSection(md, dto.section_heading);
    if (!section) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: `Không tìm thấy section "${dto.section_heading}"`,
      });
    }

    const provider = this.llm.select(article.aiModelUsed as never);
    const keyword = article.targetKeyword ?? '';
    const tone = dto.tone ?? ('friendly' as ArticleTone);

    const system = [
      'Bạn là content writer SEO chuyên nghiệp. Bạn đang regenerate MỘT section ## H2 của bài viết.',
      'Output BẮT BUỘC là Markdown — KHÔNG bao gồm dòng ## H2 (sẽ được prepend bởi caller).',
      'Giữ keyword chính xuất hiện 1-2 lần tự nhiên. Không dùng "Trong phần này...", "Hãy cùng...".',
      `Tone: ${tone} — ${TONE_HINTS[tone] ?? ''}`,
    ].join('\n');

    const user = [
      `Keyword chính: ${keyword || '(không rõ)'}`,
      `H2 heading: ${section.heading}`,
      `Độ dài mong muốn: ~${Math.max(150, section.bodyLength)} từ.`,
      dto.instructions ? `Yêu cầu thêm: ${dto.instructions}` : '',
      '',
      'Body cũ (để tham khảo, KHÔNG copy):',
      section.body.slice(0, 1500),
      '',
      'Trả về body mới (bắt đầu trực tiếp bằng đoạn văn, không có ## H2):',
    ]
      .filter(Boolean)
      .join('\n');

    const result = await provider.generate({
      system,
      prompt: user,
      maxTokens: ArticleEditorService.SECTION_MAX_TOKENS,
      temperature: 0.5,
      model: (article.aiModelUsed as never) ?? undefined,
    });

    const newBody = this.stripFences(result.content).trim();
    const newMd = this.replaceSection(md, section, newBody);
    return this.articles.update(userId, id, { content_markdown: newMd });
  }

  // ----- rewrite (selection or whole article) -----

  async rewrite(
    userId: string,
    id: string,
    dto: RewriteDto,
  ): Promise<{ rewritten: string; article?: ArticleResult }> {
    const article = await this.loadOwned(userId, id);
    const source = (dto.text ?? article.contentMarkdown ?? '').trim();
    if (!source) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Không có nội dung để rewrite.',
      });
    }

    const provider = this.llm.select(article.aiModelUsed as never);
    const { system, user } = this.buildRewritePrompt(article.targetKeyword ?? '', source, dto);
    const result = await provider.generate({
      system,
      prompt: user,
      maxTokens: ArticleEditorService.REWRITE_MAX_TOKENS,
      temperature: dto.action === 'tone' ? 0.6 : 0.4,
      model: (article.aiModelUsed as never) ?? undefined,
    });

    const rewritten = this.stripFences(result.content).trim();

    // Whole-article rewrite + caller explicitly opted in to apply.
    const shouldApply = !dto.text && dto.apply === 1;
    if (shouldApply) {
      const updated = await this.articles.update(userId, id, { content_markdown: rewritten });
      return { rewritten, article: updated };
    }
    return { rewritten };
  }

  // ----- export -----

  async export(
    userId: string,
    id: string,
    format: 'md' | 'html' | 'docx',
  ): Promise<{ filename: string; mime: string; body: string | Buffer }> {
    const article = await this.loadOwned(userId, id);
    const slug = article.slug ?? 'article';
    const md = article.contentMarkdown ?? '';

    if (format === 'md') {
      return {
        filename: `${slug}.md`,
        mime: 'text/markdown; charset=utf-8',
        body: md || `# ${article.title}\n\n_Empty article_\n`,
      };
    }

    const html = article.content ?? (await Promise.resolve(marked.parse(md)));
    const fullHtml = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>${escapeHtml(article.title)}</title>
<meta name="description" content="${escapeHtml(article.metaDescription ?? '')}">
</head>
<body>
${html}
</body>
</html>`;

    if (format === 'html') {
      return {
        filename: `${slug}.html`,
        mime: 'text/html; charset=utf-8',
        body: fullHtml,
      };
    }

    // DOCX — Word reads HTML when served with this Content-Type. Good enough
    // for content review without pulling in a heavy docx generator dep.
    return {
      filename: `${slug}.doc`,
      mime: 'application/msword',
      body: fullHtml,
    };
  }

  // ----- helpers -----

  private async loadOwned(userId: string, id: string) {
    const row = await this.prisma.article.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Không tìm thấy bài viết',
      });
    }
    return row;
  }

  /**
   * Find an H2 section in the markdown by heading text (case-insensitive,
   * trim-tolerant). Returns null if absent.
   */
  private findSection(
    md: string,
    heading: string,
  ): {
    heading: string;
    rawHeadingLine: string;
    body: string;
    bodyLength: number;
    start: number;
    end: number;
  } | null {
    const lines = md.split('\n');
    const target = heading
      .replace(/^#+\s*/, '')
      .trim()
      .toLowerCase();
    let startLine = -1;
    let endLine = lines.length;
    for (let i = 0; i < lines.length; i += 1) {
      const m = /^##\s+(.+?)\s*$/.exec(lines[i] ?? '');
      if (m && m[1]!.trim().toLowerCase() === target) {
        startLine = i;
        for (let j = i + 1; j < lines.length; j += 1) {
          if (/^#{1,2}\s+/.test(lines[j] ?? '')) {
            endLine = j;
            break;
          }
        }
        break;
      }
    }
    if (startLine === -1) return null;

    const headingLine = lines[startLine]!;
    const bodyLines = lines.slice(startLine + 1, endLine);
    const body = bodyLines.join('\n').trim();
    const bodyLength = body.split(/\s+/).filter(Boolean).length;
    // Character offsets so replaceSection can splice without re-joining.
    const beforeChars = lines.slice(0, startLine + 1).join('\n').length + 1;
    const sectionChars = bodyLines.join('\n').length;
    return {
      heading: target,
      rawHeadingLine: headingLine,
      body,
      bodyLength,
      start: beforeChars,
      end: beforeChars + sectionChars,
    };
  }

  private replaceSection(
    md: string,
    section: { rawHeadingLine: string; start: number; end: number },
    newBody: string,
  ): string {
    return md.slice(0, section.start) + newBody.trim() + '\n' + md.slice(section.end);
  }

  private buildRewritePrompt(
    keyword: string,
    source: string,
    dto: RewriteDto,
  ): { system: string; user: string } {
    const intro = `Bạn là biên tập viên SEO. Bạn được giao một đoạn nội dung và phải viết lại theo yêu cầu, GIỮ Ý NGHĨA gốc và keyword "${keyword || '(none)'}".`;
    const outputRule =
      'Output: chỉ trả về nội dung viết lại — không có lời dẫn, không có markdown fence ngoài cùng.';

    let actionRule = '';
    switch (dto.action) {
      case 'shorter':
        actionRule = 'Yêu cầu: viết lại NGẮN gọn hơn ~40-50% so với bản gốc, giữ đầy đủ ý chính.';
        break;
      case 'longer':
        actionRule =
          'Yêu cầu: mở rộng nội dung ~50-80% bằng cách thêm ví dụ, số liệu, hoặc giải thích thêm — không lặp ý.';
        break;
      case 'tone': {
        const tone = (dto.tone ?? 'friendly') as ArticleTone;
        actionRule = `Yêu cầu: viết lại với tone "${tone}" — ${TONE_HINTS[tone]}. Giữ độ dài tương đương bản gốc.`;
        break;
      }
      case 'details':
        actionRule =
          'Yêu cầu: thêm chi tiết cụ thể (ví dụ thực tế, số liệu, case study ngắn) cho đoạn này. Mở rộng ~30-50%.';
        break;
      case 'free':
        if (!dto.instructions) {
          throw new BadRequestException({
            code: ErrorCode.VALIDATION_ERROR,
            message: 'action="free" yêu cầu field instructions.',
          });
        }
        actionRule = `Yêu cầu: ${dto.instructions}`;
        break;
    }
    if (dto.instructions && dto.action !== 'free') {
      actionRule += `\nGợi ý thêm: ${dto.instructions}`;
    }

    return {
      system: [intro, outputRule].join('\n'),
      user: [actionRule, '', '===== NỘI DUNG GỐC =====', source].join('\n'),
    };
  }

  private stripFences(raw: string): string {
    let body = raw.trim();
    if (body.startsWith('```')) {
      body = body
        .replace(/^```(?:markdown|md|html)?\s*\n?/i, '')
        .replace(/\n?```\s*$/, '')
        .trim();
    }
    return body;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
