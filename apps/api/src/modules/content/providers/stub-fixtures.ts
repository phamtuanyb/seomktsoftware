/**
 * Canned responses used when the LLM provider runs in stub mode (no real
 * API key). Deterministic — tests + dev preview both rely on this.
 */

export const STUB_OUTLINE_JSON = `{
  "h1": "[STUB] {{KEYWORD}}: Hướng dẫn toàn diện từ A-Z",
  "sections": [
    {
      "h2": "{{KEYWORD}} là gì?",
      "subsections": [
        {
          "h3": "Định nghĩa cơ bản",
          "bullets": [
            "Khái niệm tổng quan",
            "Phân biệt với các thuật ngữ liên quan"
          ]
        },
        {
          "h3": "Lịch sử phát triển",
          "bullets": ["Bối cảnh ra đời", "Các mốc quan trọng"]
        }
      ]
    },
    {
      "h2": "Lợi ích chính của {{KEYWORD}}",
      "subsections": [
        {
          "h3": "Đối với cá nhân",
          "bullets": ["Tăng năng suất", "Tiết kiệm thời gian"]
        },
        {
          "h3": "Đối với doanh nghiệp",
          "bullets": ["Tối ưu chi phí", "Mở rộng quy mô"]
        }
      ]
    },
    {
      "h2": "Hướng dẫn áp dụng {{KEYWORD}}",
      "subsections": [
        {
          "h3": "Bước 1: Chuẩn bị",
          "bullets": ["Xác định mục tiêu", "Đánh giá nguồn lực"]
        },
        {
          "h3": "Bước 2: Triển khai",
          "bullets": ["Thiết kế quy trình", "Đào tạo đội ngũ"]
        },
        {
          "h3": "Bước 3: Đo lường",
          "bullets": ["KPI quan trọng", "Công cụ phân tích"]
        }
      ]
    },
    {
      "h2": "Sai lầm thường gặp khi triển khai {{KEYWORD}}",
      "subsections": [
        {
          "h3": "Sai lầm chiến lược",
          "bullets": ["Thiếu kế hoạch dài hạn", "Bỏ qua nghiên cứu thị trường"]
        },
        {
          "h3": "Sai lầm thực thi",
          "bullets": ["Đo lường sai chỉ số", "Không tối ưu liên tục"]
        }
      ]
    },
    {
      "h2": "Câu hỏi thường gặp về {{KEYWORD}}",
      "subsections": [
        {
          "h3": "FAQ tổng hợp",
          "bullets": [
            "{{KEYWORD}} phù hợp với ai?",
            "Chi phí triển khai bao nhiêu?",
            "Mất bao lâu để thấy kết quả?",
            "Có cần kỹ năng kỹ thuật không?",
            "Làm sao đo hiệu quả?"
          ]
        }
      ]
    }
  ]
}`;

export function stubOutlineFor(keyword: string): string {
  return STUB_OUTLINE_JSON.replace(/\{\{KEYWORD\}\}/g, keyword);
}

/**
 * Sprint 6.5 — passthrough-ish stub for the editor's regenerate-section +
 * rewrite endpoints. We can't return the full article fixture (the caller
 * wants just a body) and we can't return JSON (markdown is expected), so
 * we echo a deterministic marker so tests can assert "LLM was called +
 * content replaced".
 */
export function stubRewriteFor(args: { source: string; action: string; keyword: string }): string {
  const trimmed = args.source.trim().split(/\s+/).slice(0, 80).join(' ');
  return `[STUB-${args.action.toUpperCase()}] ${args.keyword}: ${trimmed}${
    trimmed.endsWith('.') ? '' : '.'
  } LSI keywords: ${args.keyword}, content marketing, SEO.`;
}

/** Generates a stub article string for streaming. ~2000 words of placeholder content. */
export function stubArticleFor(keyword: string): string {
  const intro = `[STUB] **${keyword}** đang là một trong những chủ đề được quan tâm nhất hiện nay. Bài viết này sẽ giúp bạn hiểu toàn diện về **${keyword}** — từ khái niệm cơ bản, lợi ích cụ thể, đến hướng dẫn áp dụng và những sai lầm cần tránh. Đặc biệt, chúng tôi tổng hợp các câu hỏi thường gặp giúp bạn tiết kiệm thời gian tìm kiếm. Nếu bạn đang muốn bắt đầu với ${keyword} một cách hiệu quả, đây chính là cẩm nang đầy đủ nhất.`;

  const section = (title: string, body: string) => `\n\n## ${title}\n\n${body}\n\n`;

  const filler = (theme: string) =>
    Array.from(
      { length: 4 },
      (_, i) =>
        `Đoạn ${i + 1} về ${theme} liên quan đến ${keyword}. Đây là nội dung stub được sinh ra khi chưa cấu hình ANTHROPIC_API_KEY thật — paste API key vào .env để bài viết được sinh bằng Claude Sonnet 4. LSI keyword: SEO, content marketing, từ khóa dài, intent người dùng, content score.`,
    ).join(' ');

  const body = [
    section(`${keyword} là gì?`, filler('khái niệm cơ bản')),
    section(`Lợi ích chính của ${keyword}`, filler('lợi ích')),
    section(`Hướng dẫn áp dụng ${keyword}`, filler('hướng dẫn triển khai')),
    section(`Sai lầm thường gặp khi triển khai ${keyword}`, filler('sai lầm thực thi')),
    section(
      'Câu hỏi thường gặp',
      [
        `**${keyword} phù hợp với ai?** ${filler('đối tượng phù hợp')}`,
        `**Chi phí triển khai bao nhiêu?** ${filler('ngân sách')}`,
        `**Mất bao lâu để thấy kết quả?** ${filler('timeline kỳ vọng')}`,
        `**Có cần kỹ năng kỹ thuật không?** ${filler('yêu cầu kỹ năng')}`,
        `**Làm sao đo hiệu quả?** ${filler('KPI và đo lường')}`,
      ].join('\n\n'),
    ),
    section(
      'Kết luận',
      `${keyword} là một chủ đề rộng và phức tạp, nhưng nếu nắm được nguyên tắc cốt lõi và áp dụng đúng cách, bạn hoàn toàn có thể tạo ra kết quả vượt trội. Hãy bắt đầu ngay hôm nay! [STUB MODE — paste real ANTHROPIC_API_KEY into .env to enable Claude].`,
    ),
  ].join('');

  return intro + body;
}
