/**
 * Canned responses used when the LLM provider runs in stub mode (no real
 * API key). Deterministic so tests and dev preview both rely on this.
 */

export const STUB_OUTLINE_JSON = `{
  "meta_title": "{{KEYWORD}} | Outline SEO thuc chien",
  "meta_description": "{{KEYWORD}} duoc trinh bay thanh outline gon, ro intent, co mo bai, than bai, ket bai va CTA de writer co the viet thanh bai SEO ngay.",
  "h1": "[STUB] {{KEYWORD}}: Huong dan toan dien tu A-Z",
  "sections": [
    {
      "h2": "{{KEYWORD}} la gi va khi nao can quan tam?",
      "subsections": [
        {
          "h3": "5W1H mo bai",
          "bullets": [
            "Neu van de nguoi doc dang gap",
            "Dinh nghia nhanh, doi tuong, boi canh va ly do can doc tiep"
          ]
        },
        {
          "h3": "Boi canh thuc te",
          "bullets": [
            "Vi sao chu de nay dang duoc tim kiem",
            "Tinh huong pho bien tai doanh nghiep Viet Nam"
          ]
        }
      ]
    },
    {
      "h2": "Loi ich va gia tri thuc te cua {{KEYWORD}}",
      "subsections": [
        {
          "h3": "Gia tri uu tien",
          "bullets": [
            "Loi ich lon nhat dat truoc",
            "Tach ro loi ich ngan han va dai han"
          ]
        },
        {
          "h3": "Trade-off can biet",
          "bullets": [
            "Dieu kien de dat ket qua",
            "Rui ro neu trien khai sai"
          ]
        }
      ]
    },
    {
      "h2": "Cach trien khai {{KEYWORD}} theo tung buoc",
      "subsections": [
        {
          "h3": "Buoc 1: Chuan bi",
          "bullets": [
            "Xac dinh muc tieu",
            "Chon tai nguyen va du lieu can co"
          ]
        },
        {
          "h3": "Buoc 2: Thuc thi",
          "bullets": [
            "Lam gi truoc, lam gi sau",
            "Chi so can theo doi trong qua trinh"
          ]
        },
        {
          "h3": "Buoc 3: Toi uu",
          "bullets": [
            "Do luong ket qua",
            "Rut kinh nghiem va cap nhat"
          ]
        }
      ]
    },
    {
      "h2": "Sai lam thuong gap va cach tranh",
      "subsections": [
        {
          "h3": "Sai lam chien luoc",
          "bullets": [
            "Tap trung sai muc tieu",
            "Bo qua nhu cau thuc te cua nguoi doc"
          ]
        },
        {
          "h3": "Sai lam khi thuc thi",
          "bullets": [
            "Lam qua nhieu nhung khong do luong",
            "Khong co checklist va quy trinh cap nhat"
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
  const intro = `# [STUB] ${keyword}: Huong dan toan dien\n\n**${keyword}** dang la mot trong nhung chu de duoc quan tam nhat hien nay. Bai viet nay giup ban hieu ro tu khai niem, loi ich, cach trien khai den sai lam can tranh. Noi dung dang chay o che do stub vi provider AI chua san sang hoac API dang loi, nhung do dai van bam theo so tu muc tieu de ban test dung flow.`;

  const section = (title: string, body: string) => `\n\n## ${title}\n\n${body}\n\n`;

  const paragraph = (theme: string, index: number) =>
    `Doan ${index} ve ${theme} lien quan den ${keyword}. Trong thuc te, nguoi lam SEO khong chi can mot dinh nghia dung ma con can cach ap dung vao boi canh cu the. Vi du, voi mot doanh nghiep nho, uu tien se la chi phi, toc do trien khai va kha nang do luong sau 30 ngay. Neu bo qua cac yeu to nay, noi dung rat de dai nhung khong giup nguoi doc ra quyet dinh. LSI keyword: SEO, content marketing, tu khoa dai, intent nguoi dung, content score.`;

  const filler = (theme: string, paragraphs = 4) =>
    Array.from({ length: paragraphs }, (_, index) => paragraph(theme, index + 1)).join(' ');
  const perSectionParagraphs = Math.max(2, Math.ceil(targetWordCount / 700));

  const body = [
    section(`${keyword} la gi?`, filler('khai niem co ban', perSectionParagraphs)),
    section(`Loi ich chinh cua ${keyword}`, filler('loi ich', perSectionParagraphs)),
    section(`Huong dan ap dung ${keyword}`, filler('huong dan trien khai', perSectionParagraphs)),
    section(
      `Sai lam thuong gap khi trien khai ${keyword}`,
      filler('sai lam thuc thi', perSectionParagraphs),
    ),
    section(
      'Ket luan',
      `${keyword} la mot chu de rong, nhung neu bam dung intent, dung outline va do luong deu dan, ban co the tao ra noi dung huu ich hon doi thu. Hay bat dau bang mot checklist nho, do ket qua sau 30 ngay, roi mo rong cac phan dang co tin hieu tot. [STUB MODE - nap credit hoac cau hinh provider AI de sinh bai that].`,
    ),
  ].join('');

  return intro + body;
}
