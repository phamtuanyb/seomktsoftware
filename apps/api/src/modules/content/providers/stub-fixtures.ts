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

/** Generates a stub article string for streaming near the requested word count. */
export function stubArticleFor(keyword: string, targetWordCount = 2000): string {
  const intro = `# [STUB] ${keyword}: Huong dan toan dien\n\n**${keyword}** dang la mot trong nhung chu de duoc quan tam nhat hien nay. Bai viet nay giup ban hieu ro tu khai niem, loi ich, cach trien khai den sai lam can tranh. Noi dung dang chay o che do stub vi Claude chua san sang hoac API dang loi, nhung do dai van bam theo so tu muc tieu de ban test dung flow.`;

  const section = (title: string, body: string) => `\n\n## ${title}\n\n${body}\n\n`;

  const paragraph = (theme: string, index: number) =>
    `Doan ${index} ve ${theme} lien quan den ${keyword}. Trong thuc te, nguoi lam SEO khong chi can mot dinh nghia dung ma con can cach ap dung vao boi canh cu the. Vi du, voi mot doanh nghiep nho, uu tien se la chi phi, toc do trien khai va kha nang do luong sau 30 ngay. Neu bo qua cac yeu to nay, noi dung rat de dai nhung khong giup nguoi doc ra quyet dinh. LSI keyword: SEO, content marketing, tu khoa dai, intent nguoi dung, content score.`;

  const filler = (theme: string, paragraphs = 4) =>
    Array.from(
      { length: paragraphs },
      (_, i) => paragraph(theme, i + 1),
    ).join(' ');
  const perSectionParagraphs = Math.max(2, Math.ceil(targetWordCount / 700));

  const body = [
    section(`${keyword} la gi?`, filler('khai niem co ban', perSectionParagraphs)),
    section(`Loi ich chinh cua ${keyword}`, filler('loi ich', perSectionParagraphs)),
    section(`Huong dan ap dung ${keyword}`, filler('huong dan trien khai', perSectionParagraphs)),
    section(`Sai lam thuong gap khi trien khai ${keyword}`, filler('sai lam thuc thi', perSectionParagraphs)),
    section(
      'Cau hoi thuong gap',
      [
        `**${keyword} phu hop voi ai?** ${filler('doi tuong phu hop', 1)}`,
        `**Chi phi trien khai bao nhieu?** ${filler('ngan sach', 1)}`,
        `**Mat bao lau de thay ket qua?** ${filler('timeline ky vong', 1)}`,
        `**Co can ky nang ky thuat khong?** ${filler('yeu cau ky nang', 1)}`,
        `**Lam sao do hieu qua?** ${filler('KPI va do luong', 1)}`,
      ].join('\n\n'),
    ),
    section(
      'Ket luan',
      `${keyword} la mot chu de rong, nhung neu bam dung intent, dung outline va do luong deu dan, ban co the tao ra noi dung huu ich hon doi thu. Hay bat dau bang mot checklist nho, do ket qua sau 30 ngay, roi mo rong cac phan dang co tin hieu tot. [STUB MODE - nap credit/cau hinh ANTHROPIC_API_KEY de sinh bang Claude].`,
    ),
  ].join('');

  return intro + body;
}
