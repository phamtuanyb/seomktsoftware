/**
 * Canned responses used when the LLM provider runs in stub mode (no real
 * API key). Deterministic so tests and dev preview both rely on this.
 */

export const STUB_OUTLINE_JSON = `{
  "meta_title": "{{KEYWORD}} | Outline SEO thực chiến",
  "meta_description": "{{KEYWORD}} được trình bày thành outline gọn, rõ intent, có mở bài, thân bài và CTA để writer có thể viết thành bài SEO ngay.",
  "h1": "[STUB] {{KEYWORD}}: Hướng dẫn toàn diện từ A-Z",
  "sections": [
    {
      "h2": "{{KEYWORD}} là gì và khi nào cần quan tâm?",
      "subsections": []
    },
    {
      "h2": "Lợi ích và giá trị thực tế của {{KEYWORD}}",
      "subsections": [
        {
          "h3": "Giá trị ưu tiên",
          "bullets": [
            "Lợi ích lớn nhất đặt trước",
            "Trade-off cần biết"
          ]
        }
      ]
    },
    {
      "h2": "Cách triển khai {{KEYWORD}} hiệu quả",
      "subsections": [
        {
          "h3": "Khung triển khai",
          "bullets": [
            "Làm gì trước, làm gì sau",
            "Đo lường và tối ưu"
          ]
        }
      ]
    }
  ]
}`;

export function stubOutlineFor(keyword: string): string {
  return STUB_OUTLINE_JSON.replace(/\{\{KEYWORD\}\}/g, keyword);
}

export function stubRewriteFor(args: { source: string; action: string; keyword: string }): string {
  const trimmed = args.source.trim().split(/\s+/).slice(0, 80).join(' ');
  return `[STUB-${args.action.toUpperCase()}] ${args.keyword}: ${trimmed}${
    trimmed.endsWith('.') ? '' : '.'
  } LSI keywords: ${args.keyword}, content marketing, SEO.`;
}

/** Generates a stub article string for streaming near the requested word count. */
export function stubArticleFor(keyword: string, targetWordCount = 2000): string {
  const intro = `# [STUB] ${keyword}: Hướng dẫn toàn diện\n\n**${keyword}** đang là một trong những chủ đề được quan tâm nhất hiện nay. Bài viết này giúp bạn hiểu rõ từ khái niệm, lợi ích, cách triển khai đến sai lầm cần tránh. Nội dung đang chạy ở chế độ stub vì provider AI chưa sẵn sàng hoặc API đang lỗi, nhưng độ dài vẫn bám theo số từ mục tiêu để bạn test đúng flow.`;

  const section = (title: string, body: string) => `\n\n## ${title}\n\n${body}\n\n`;

  const paragraph = (theme: string, index: number) =>
    `Đoạn ${index} về ${theme} liên quan đến ${keyword}. Trong thực tế, người làm SEO không chỉ cần một định nghĩa đúng mà còn cần cách áp dụng vào bối cảnh cụ thể. Ví dụ, với một doanh nghiệp nhỏ, ưu tiên sẽ là chi phí, tốc độ triển khai và khả năng đo lường sau 30 ngày. Nếu bỏ qua các yếu tố này, nội dung rất dễ dài nhưng không giúp người đọc ra quyết định. LSI keyword: SEO, content marketing, từ khóa dài, intent người dùng, content score.`;

  const filler = (theme: string, paragraphs = 4) =>
    Array.from({ length: paragraphs }, (_, index) => paragraph(theme, index + 1)).join(' ');
  const perSectionParagraphs = Math.max(2, Math.ceil(targetWordCount / 700));

  const body = [
    section(`${keyword} là gì?`, filler('khái niệm cơ bản', perSectionParagraphs)),
    section(`Lợi ích chính của ${keyword}`, filler('lợi ích', perSectionParagraphs)),
    section(`Hướng dẫn áp dụng ${keyword}`, filler('hướng dẫn triển khai', perSectionParagraphs)),
    section(
      'Kết luận',
      `${keyword} là một chủ đề rộng, nhưng nếu bám đúng intent, đúng outline và đo lường đều đặn, bạn có thể tạo ra nội dung hữu ích hơn đối thủ. Hãy bắt đầu bằng một checklist nhỏ, đo kết quả sau 30 ngày, rồi mở rộng các phần đang có tín hiệu tốt. [STUB MODE - nạp credit hoặc cấu hình provider AI để sinh bài thật].`,
    ),
  ].join('');

  return intro + body;
}
