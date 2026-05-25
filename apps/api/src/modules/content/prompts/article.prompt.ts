import type { Outline } from '../schemas/outline.schema';
import type { ArticleTone } from '../dto/generate-article.dto';
import type { OutlineFormat } from '../dto/generate-outline.dto';

export interface BrandVoiceProfileLite {
  tone?: { primary?: string; secondary?: string[] };
  sentence_structure?: { avg_words_per_sentence?: number };
  addressing?: { primary?: string; formality?: string };
  signature_phrases?: string[];
  emoji_usage?: { enabled?: boolean; density?: string; common_emojis?: string[] };
  patterns?: { opening_style?: string; closing_style?: string; cta_style?: string };
}

export interface ReferenceArticleLite {
  title?: string;
  content: string;
}

export interface BuildArticlePromptArgs {
  keyword: string;
  outline: Outline;
  tone?: ArticleTone;
  format: OutlineFormat;
  targetWordCount: number;
  language: string;
  brandVoice?: {
    profile: BrandVoiceProfileLite;
    referenceArticles: ReferenceArticleLite[];
  } | null;
}

const TONE_HINTS: Record<ArticleTone, string> = {
  expert: 'chuyên gia, dùng dữ liệu + số liệu, ít cảm xúc, ngôn ngữ trang trọng',
  friendly: 'thân thiện, gần gũi, dùng "bạn", có chút humor nhẹ',
  sales: 'thuyết phục, hướng CTA, nhấn mạnh USP, có lời kêu gọi rõ ràng',
  educational: 'giảng giải, dùng ví dụ minh họa, từng bước rõ ràng',
  storytelling: 'kể chuyện, có nhân vật + tình huống thật, gợi cảm xúc',
};

export function buildArticleSystemPrompt(args: BuildArticlePromptArgs): string {
  const langName = args.language === 'en' ? 'English' : 'Vietnamese';
  let prompt = `Bạn là một content writer SEO chuyên nghiệp với 10+ năm kinh nghiệm. Bạn viết bài chuẩn SEO mà người đọc vẫn yêu thích — không nhồi keyword, không AI giọng. Bạn LUÔN viết bằng ${langName}.

YÊU CẦU OUTPUT:
- Trả về MARKDOWN thuần (không JSON wrapper, không code fence ngoài cùng).
- Cấu trúc: bắt đầu bằng # H1, body chia ## H2 / ### H3 theo outline cung cấp.
- Bold (**...**) keyword chính 3-5 lần ở các vị trí chiến lược (intro, conclusion, vài H2).
- LSI keywords (từ liên quan ngữ nghĩa) xuất hiện tự nhiên 10-15 lần.
- KHÔNG dùng "Bạn có biết...", "Hãy cùng tìm hiểu...", "Trong bài viết này..." (lời mở quá AI-style).
`;

  if (args.tone) {
    prompt += `\nTONE: ${args.tone} — ${TONE_HINTS[args.tone]}\n`;
  }

  if (args.brandVoice) {
    const bv = args.brandVoice.profile;
    prompt += `\n===== BRAND VOICE (BẮT BUỘC BẮT CHƯỚC) =====\n`;
    if (bv.tone?.primary) prompt += `- Tone chính: ${bv.tone.primary}\n`;
    if (bv.tone?.secondary?.length) prompt += `- Tone phụ: ${bv.tone.secondary.join(', ')}\n`;
    if (bv.sentence_structure?.avg_words_per_sentence) {
      prompt += `- Độ dài câu trung bình: ${bv.sentence_structure.avg_words_per_sentence} từ\n`;
    }
    if (bv.addressing?.primary) {
      prompt += `- Xưng hô: ${bv.addressing.primary}${bv.addressing.formality ? ` (${bv.addressing.formality})` : ''}\n`;
    }
    if (bv.signature_phrases?.length) {
      prompt += `- Cụm từ đặc trưng cần dùng (chọn 2-3): ${bv.signature_phrases.slice(0, 8).join(', ')}\n`;
    }
    if (bv.emoji_usage?.enabled) {
      prompt += `- Emoji: dùng nhẹ (${bv.emoji_usage.density ?? 'sparse'}) — ${(bv.emoji_usage.common_emojis ?? []).join(' ')}\n`;
    }
    if (bv.patterns?.opening_style) prompt += `- Mở bài: ${bv.patterns.opening_style}\n`;
    if (bv.patterns?.closing_style) prompt += `- Kết bài: ${bv.patterns.closing_style}\n`;
    if (bv.patterns?.cta_style) prompt += `- CTA style: ${bv.patterns.cta_style}\n`;

    if (args.brandVoice.referenceArticles.length) {
      prompt += `\n===== 3 BÀI MẪU ĐỂ BẮT CHƯỚC PHONG CÁCH =====\n`;
      args.brandVoice.referenceArticles.slice(0, 3).forEach((a, i) => {
        const excerpt = a.content.slice(0, 1500);
        prompt += `\n[Bài ${i + 1}${a.title ? ` — "${a.title}"` : ''}]\n${excerpt}\n`;
      });
    }
  }

  return prompt;
}

export function buildArticleUserPrompt(args: BuildArticlePromptArgs): string {
  const outlineMd = renderOutlineAsMarkdown(args.outline);

  return `Viết một bài viết SEO hoàn chỉnh ~${args.targetWordCount} từ theo outline dưới đây.

===== KEYWORD CHÍNH =====
${args.keyword}

===== OUTLINE =====
${outlineMd}

===== YÊU CẦU CHI TIẾT =====
1. **Intro 150 từ đầu**: phải có hook gây tò mò + nhắc keyword "${args.keyword}" trong 50 từ đầu. KHÔNG dùng "Bạn có biết..." / "Hãy cùng...".
2. **Body theo outline**: viết đủ depth cho mỗi H2 + H3. Mỗi H2 ~250-400 từ.
3. **FAQ section**: nếu outline có FAQ, viết 5-10 câu hỏi + trả lời 80-150 từ mỗi câu.
4. **Conclusion + CTA**: ~150 từ cuối kết bài, có lời CTA hành động cụ thể.
5. **Format-specific**:
   ${args.format === 'comparison' || args.format === 'review' ? '- Thêm 1 BẢNG MARKDOWN so sánh giữa bài (tối thiểu 3 cột, 4 dòng).' : ''}
   ${args.format === 'how-to' || args.format === 'listicle' ? '- Numbered steps rõ ràng, có thể dùng `1.` markdown ordered list.' : ''}
6. **Keyword usage**:
   - Bold (**${args.keyword}**) keyword chính 3-5 lần (intro, 2 H2, conclusion).
   - LSI keywords (từ liên quan ngữ nghĩa với "${args.keyword}") xuất hiện 10-15 lần tự nhiên.
   - KHÔNG nhồi keyword — keyword density ≤ 2%.
7. **Markdown output only** — bắt đầu trực tiếp với # H1, không có \`\`\` wrap, không có "Đây là bài viết:" lời dẫn.

Bắt đầu viết:`;
}

function renderOutlineAsMarkdown(outline: Outline): string {
  const lines: string[] = [`# ${outline.h1}`];
  for (const section of outline.sections) {
    lines.push(`\n## ${section.h2}`);
    for (const sub of section.subsections) {
      lines.push(`### ${sub.h3}`);
      for (const b of sub.bullets) {
        lines.push(`- ${b}`);
      }
    }
  }
  return lines.join('\n');
}
