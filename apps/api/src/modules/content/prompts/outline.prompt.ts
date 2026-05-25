import type { SerpResult } from '../services/serp.service';
import type { OutlineFormat, OutlineIntent } from '../dto/generate-outline.dto';

export interface BuildOutlinePromptArgs {
  keyword: string;
  intent: OutlineIntent;
  format: OutlineFormat;
  targetWordCount: number;
  language: string;
  serpResults: SerpResult[];
}

const FORMAT_HINTS: Record<OutlineFormat, string> = {
  blog: 'bài viết dạng blog giáo dục, có intro hook + body chia mục + kết luận + CTA',
  listicle: 'bài listicle có số thứ tự rõ ràng (#1, #2, ...), mỗi mục là 1 H2',
  'how-to': 'bài hướng dẫn từng bước rõ ràng (Bước 1, Bước 2, ...) kèm checklist',
  review: 'bài đánh giá có Pros / Cons / Verdict, kèm bảng so sánh',
  comparison: 'bài so sánh nhiều giải pháp, bắt buộc có bảng so sánh ở giữa bài',
  faq: 'bài tổng hợp FAQ, mỗi H2 là 1 câu hỏi, trả lời 150-300 từ',
  landing: 'landing page có hook → vấn đề → giải pháp → bằng chứng → CTA',
  product: 'trang sản phẩm có mô tả → tính năng → đối tượng → giá → CTA',
};

const INTENT_HINTS: Record<OutlineIntent, string> = {
  info: 'người đọc đang tìm hiểu, ưu tiên định nghĩa và giải thích chi tiết',
  commercial: 'người đọc đang so sánh / nghiên cứu trước khi mua, cần bảng so sánh + bằng chứng',
  transactional: 'người đọc sẵn sàng mua, ưu tiên USP / giá / CTA rõ ràng',
  navigational: 'người đọc tìm 1 thương hiệu / sản phẩm cụ thể',
};

export function buildOutlineSystemPrompt(language: string): string {
  const langName = language === 'en' ? 'English' : 'Vietnamese';
  return `Bạn là chuyên gia SEO content có 10+ năm kinh nghiệm. Bạn được training để tạo outline bài viết SEO tốt hơn top SERP. Bạn LUÔN trả lời bằng ${langName}.

QUAN TRỌNG: Bạn LUÔN trả về JSON thuần (không có \`\`\`json wrapper, không có markdown, không có text giải thích trước/sau JSON). JSON phải parse được bằng JSON.parse() trực tiếp.`;
}

export function buildOutlineUserPrompt(args: BuildOutlinePromptArgs): string {
  const { keyword, intent, format, targetWordCount, language, serpResults } = args;

  const serpBlock = serpResults
    .map((r, i) => {
      const h2List = r.headings.h2
        .slice(0, 6)
        .map((h) => `  - ${h}`)
        .join('\n');
      return `[${i + 1}] ${r.title}\nURL: ${r.url}\nWord count: ${r.wordCount}\nH1: ${r.headings.h1}\nH2 sections:\n${h2List}`;
    })
    .join('\n\n');

  return `Phân tích outline của top ${serpResults.length} kết quả SERP cho keyword "${keyword}", rồi tạo 1 outline MỚI tốt hơn — đầy đủ hơn, có góc nhìn riêng, không copy nguyên xi.

===== KEYWORD =====
${keyword}

===== INTENT =====
${intent} — ${INTENT_HINTS[intent]}

===== FORMAT =====
${format} — ${FORMAT_HINTS[format]}

===== TARGET LENGTH =====
~${targetWordCount} từ (${language === 'en' ? 'English' : 'tiếng Việt'})

===== TOP SERP OUTLINES =====
${serpBlock}

===== YÊU CẦU OUTLINE MỚI =====
1. H1 BẮT BUỘC chứa keyword "${keyword}" trong 60 ký tự đầu, hấp dẫn click.
2. 5-8 section H2 (không kể FAQ + Kết luận). Mỗi H2 bao quát 1 góc khác nhau, KHÔNG trùng SERP.
3. Mỗi H2 có 2-4 subsection H3 cụ thể, mỗi H3 có 2-5 bullet ý chính.
4. PHẢI có 1 section FAQ với ≥5 câu hỏi dạng H3 (đặt cuối, trước Kết luận).
5. Outline phải support được bài viết ${targetWordCount} từ — H2 + H3 + bullets đủ chi tiết.
6. ${format === 'comparison' || format === 'review' ? 'PHẢI có 1 section "Bảng so sánh" hoặc tương đương.' : ''}
7. ${format === 'how-to' || format === 'listicle' ? 'H2 phải đánh số rõ ràng (Bước 1, Bước 2 hoặc #1, #2, ...).' : ''}

===== JSON SCHEMA OUTPUT =====
{
  "h1": "string (chứa keyword, max 300 ký tự)",
  "sections": [
    {
      "h2": "string",
      "subsections": [
        { "h3": "string", "bullets": ["string", "..."] }
      ]
    }
  ]
}

Bây giờ trả về JSON thuần (không markdown, không giải thích):`;
}
