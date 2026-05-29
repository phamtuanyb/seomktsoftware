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
  blog: 'bài blog giáo dục, có hook, giải thích sâu, ví dụ và kết luận có CTA',
  listicle: 'bài danh sách có số thứ tự rõ ràng, mỗi mục là một ý độc lập',
  'how-to': 'bài hướng dẫn từng bước, có checklist, lỗi thường gặp và cách xử lý',
  review: 'bài đánh giá có tiêu chí, ưu/nhược điểm, verdict và đối tượng phù hợp',
  comparison: 'bài so sánh nhiều giải pháp, bắt buộc có bảng/tiêu chí so sánh',
  faq: 'bài hỏi đáp, mỗi mục trả lời một câu hỏi thật của người search',
  landing: 'landing page theo flow pain -> solution -> proof -> CTA',
  product: 'trang sản phẩm theo flow vấn đề -> tính năng -> lợi ích -> bằng chứng -> CTA',
};

const INTENT_HINTS: Record<OutlineIntent, string> = {
  info: 'người đọc muốn hiểu rõ vấn đề, cần định nghĩa, bối cảnh, ví dụ và cách làm',
  commercial: 'người đọc đang so sánh trước khi mua, cần tiêu chí, bằng chứng và khuyến nghị',
  transactional: 'người đọc đã sẵn sàng hành động, cần lợi ích, giá trị, quy trình và CTA',
  navigational: 'người đọc tìm một thương hiệu/sản phẩm cụ thể, cần thông tin đúng và nhanh',
};

export function buildOutlineSystemPrompt(language: string): string {
  const langName = language === 'en' ? 'English' : 'Vietnamese';
  return `Bạn là senior SEO content strategist cho thị trường Việt Nam. Nhiệm vụ của bạn là phân tích top SERP và tạo outline gọn, đúng intent, để writer có thể viết ngay, nhưng không copy đối thủ.

NGÔN NGỮ:
- Luôn viết outline bằng ${langName}.

TRIẾT LÝ TẠO OUTLINE:
1. Outline là bộ khung bài viết hoàn chỉnh, không tạo quá nhiều heading.
2. Mỗi H2 phải có vai trò rõ: mở bài, giải thích, triển khai, ra quyết định, kết luận.
3. Ưu tiên cách diễn đạt gọn, dễ đọc, sát phong cách marketing thực chiến.
4. Nếu có dữ liệu brand voice hoặc bài mẫu từ hệ thống, hãy nói theo nhịp viết và cách đặt vấn đề đó.
5. Không copy heading của SERP. Chỉ học ý định tìm kiếm và các gap cần bổ sung.
6. Ưu tiên outline ngắn. Chỉ giữ lại những mục thật sự cần để viết bài.
7. Trước khi ra outline, phải ngầm xác định keyword chính, keyword phụ, biến thể từ đồng nghĩa và search intent của người dùng.
8. Với truy vấn dạng how/what/why/best/top, outline phải chuẩn bị sẵn một opening để bài viết có thể trả lời trực tiếp truy vấn ngay ở 1-2 câu đầu.
9. Outline phải hỗ trợ featured snippet và AI search: heading rõ ý, mỗi section xoay quanh một ý chính, tránh trộn quá nhiều ý trong cùng một mục.

OUTPUT BẮT BUỘC:
- Chỉ trả về JSON thuần parse được bằng JSON.parse().
- Không markdown, không code fence, không giải thích trước/sau JSON.
- JSON chỉ gồm đúng 4 field: "meta_title", "meta_description", "h1", "sections".
- Mỗi section có "h2" và "subsections"; mỗi subsection có "h3" và "bullets".
- Ưu tiên H2 đứng độc lập. Chỉ dùng H3 khi thật sự cần để tách một ý lớn.
- Không thêm field ngoài schema như metadata, angle, score, notes.`;
}

export function buildOutlineUserPrompt(args: BuildOutlinePromptArgs): string {
  const { keyword, intent, format, targetWordCount, language, serpResults } = args;
  const serpBlock = renderSerpBlock(serpResults);
  const countHint = buildCountHint(targetWordCount);

  return `Phân tích top ${serpResults.length} SERP cho keyword "${keyword}", tìm gap của đối thủ, rồi tạo outline gọn hơn và dễ triển khai hơn.

KEYWORD CHÍNH:
${keyword}

SEARCH INTENT:
${intent} - ${INTENT_HINTS[intent]}

FORMAT:
${format} - ${FORMAT_HINTS[format]}

ĐỘ DÀI BÀI VIẾT MỤC TIÊU:
Khoảng ${targetWordCount} từ, ngôn ngữ ${language === 'en' ? 'English' : 'tiếng Việt'}.

TOP SERP CẦN PHÂN TÍCH:
${serpBlock}

YÊU CẦU OUTLINE:
1. Meta Title dài 50-70 ký tự, keyword chính ở nửa đầu title, ưu tiên CTR.
2. Meta Description dài 140-165 ký tự, có keyword chính và CTA nhẹ.
3. H1 bắt buộc chứa keyword "${keyword}", rõ nghĩa, hấp dẫn, không quá 300 ký tự.
4. Tạo đúng ${countHint} H2 chính, không hơn. Đây là giới hạn cứng.
5. Mặc định mỗi H2 không cần H3. Chỉ thêm tối đa 1 H3 nếu cần tách ý quan trọng.
6. Nếu có H3 thì chỉ cần 1-2 bullet ngắn, không viết thành checklist máy móc.
7. Cấu trúc tổng thể:
   - Mở bài: direct answer trước, sau đó hook + 5W1H + keyword chính trong 100 chữ đầu
   - Thân bài: kim tự tháp ngược, ý quan trọng đặt trước, có chèn keyword chính và key phụ tự nhiên
   - Kết bài: tóm tắt, nhắc lại keyword, CTA rõ ràng
8. Nếu format là comparison/review, phải có H2 về tiêu chí đánh giá hoặc bảng so sánh.
9. Nếu format là how-to/listicle, phải thể hiện trình tự bước hoặc thứ tự rõ ràng.
10. Nếu intent là commercial/transactional, phải có phần tiêu chí lựa chọn, bằng chứng, trade-off và CTA.
11. Có thể đưa FAQ vào cuối bài, nhưng chỉ khi thật sự cần; mặc định bỏ qua FAQ để outline gọn hơn.
12. Cần thể hiện sự liên kết với phong cách MKT và brand voice nếu có, nhưng vẫn ưu tiên độ rõ ràng của outline.
13. Không copy nguyên văn heading của SERP.
14. Mục tiêu là một outline ngắn, dễ duyệt nhanh trong admin, không phải một bản draft quá chi tiết.
15. Heading phải được làm mới lại bằng ngôn ngữ riêng, có thể chèn từ khóa phụ, biến thể từ khóa, nhưng không được nghe máy móc.
16. Nếu nhận thấy SERP đang on top theo một angle rõ, có thể đưa ra một lựa chọn tham khảo nhưng vẫn ưu tiên bài mới có điểm nhìn riêng.
17. Hãy chừa chỗ hợp lý để bài viết có thể thêm block "Key Takeaways", 1 bảng so sánh/quy trình, ít nhất 3 internal link, 2 external link và một FAQ ngắn nếu chủ đề phù hợp.

SCHEMA JSON BẮT BUỘC:
{
  "meta_title": "string",
  "meta_description": "string",
  "h1": "string",
  "sections": [
    {
      "h2": "string",
      "subsections": [
        {
          "h3": "string",
          "bullets": ["string"]
        }
      ]
    }
  ]
}

Trả về JSON thuần ngay bây giờ:`;
}

function renderSerpBlock(serpResults: SerpResult[]): string {
  if (!serpResults.length) {
    return 'Không có SERP data. Hãy tự suy luận intent và tạo outline có chiều sâu.';
  }

  return serpResults
    .map((result, index) => {
      const h2List = result.headings.h2
        .slice(0, 8)
        .map((heading) => `  - ${heading}`)
        .join('\n');
      const h3List = result.headings.h3
        .slice(0, 8)
        .map((heading) => `  - ${heading}`)
        .join('\n');

      return `[${index + 1}] ${result.title}
URL: ${result.url}
Word count: ${result.wordCount}
H1: ${result.headings.h1}
H2:
${h2List || '  - Không có dữ liệu H2'}
H3 nổi bật:
${h3List || '  - Không có dữ liệu H3'}`;
    })
    .join('\n\n');
}

function buildCountHint(_targetWordCount: number): string {
  return '3';
}
