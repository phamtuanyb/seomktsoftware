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
  blog: 'bai blog giao duc, co hook, giai thich sau, vi du va ket luan co CTA',
  listicle: 'bai danh sach co so thu tu ro rang, moi muc la mot y doc lap',
  'how-to': 'bai huong dan tung buoc, co checklist, loi thuong gap va cach xu ly',
  review: 'bai danh gia co tieu chi, uu/nhuoc diem, verdict va doi tuong phu hop',
  comparison: 'bai so sanh nhieu giai phap, bat buoc co bang/tieu chi so sanh',
  faq: 'bai hoi dap, moi muc tra loi mot cau hoi that cua nguoi search',
  landing: 'landing page theo flow pain -> solution -> proof -> CTA',
  product: 'trang san pham theo flow van de -> tinh nang -> loi ich -> bang chung -> CTA',
};

const INTENT_HINTS: Record<OutlineIntent, string> = {
  info: 'nguoi doc muon hieu ro van de, can dinh nghia, boi canh, vi du va cach lam',
  commercial: 'nguoi doc dang so sanh truoc khi mua, can tieu chi, bang chung va khuyen nghi',
  transactional: 'nguoi doc da san sang hanh dong, can loi ich, gia tri, quy trinh va CTA',
  navigational: 'nguoi doc tim mot thuong hieu/san pham cu the, can thong tin dung va nhanh',
};

export function buildOutlineSystemPrompt(language: string): string {
  const langName = language === 'en' ? 'English' : 'Vietnamese';
  return `Ban la senior SEO content strategist cho thi truong Viet Nam. Nhiem vu cua ban la phan tich top SERP va tao outline moi tot hon doi thu: dung intent hon, co angle ro hon, day du hon, nhung khong copy.

NGON NGU:
- Luon viet outline bang ${langName}.

TRIET LY TAO OUTLINE:
1. Outline la kien truc trai nghiem doc, khong phai danh sach H2 roi rac.
2. Moi H2 phai la mot nac thang logic dan nguoi doc tu van de den quyet dinh/hanh dong.
3. Outline can co angle rieng de vuot SERP, vi du: goc nhin SME Viet Nam, chi phi thuc te, quy trinh trien khai, loi thuong gap, checklist lua chon.
4. Phai doc SERP de tim gap: muc nao doi thu noi mong, cau hoi nao chua tra loi, thieu bang chung nao, thieu next step nao.
5. Khong copy tieu de SERP. Co the hoc y dinh noi dung, nhung viet heading moi va tot hon.

OUTPUT BAT BUOC:
- Chi tra ve JSON thuan parse duoc bang JSON.parse().
- Khong markdown, khong code fence, khong giai thich truoc/sau JSON.
- JSON chi gom dung 2 field: "h1" va "sections".
- Moi section co "h2" va "subsections"; moi subsection co "h3" va "bullets".
- Khong them field ngoai schema nhu metadata, angle, score, notes.`;
}

export function buildOutlineUserPrompt(args: BuildOutlinePromptArgs): string {
  const { keyword, intent, format, targetWordCount, language, serpResults } = args;
  const serpBlock = renderSerpBlock(serpResults);
  const countHint = buildCountHint(targetWordCount);

  return `Phan tich top ${serpResults.length} SERP cho keyword "${keyword}", tim gap cua doi thu, roi tao outline moi tot hon.

KEYWORD CHINH:
${keyword}

SEARCH INTENT:
${intent} - ${INTENT_HINTS[intent]}

FORMAT:
${format} - ${FORMAT_HINTS[format]}

DO DAI BAI VIET MUC TIEU:
Khoang ${targetWordCount} tu, ngon ngu ${language === 'en' ? 'English' : 'tieng Viet'}.

TOP SERP CAN PHAN TICH:
${serpBlock}

YEU CAU OUTLINE:
1. H1 bat buoc chua keyword "${keyword}", hap dan click, khong qua 300 ky tu.
2. Tao ${countHint} H2 chinh. Moi H2 phai co vai tro rieng trong hanh trinh doc.
3. Moi H2 co 2-4 H3. Moi H3 co 2-5 bullet cu the de writer co the viet sau.
4. Phai co goc nhin moi so voi SERP: them vi du Viet Nam, tieu chi lua chon, loi thuong gap, checklist, quy trinh hoac bang so sanh neu phu hop.
5. Neu intent la commercial/transactional, can co section ve tieu chi lua chon, bang chung, rui ro/trade-off va CTA.
6. Neu format la comparison/review, can co H2 ve bang so sanh hoac tieu chi danh gia.
7. Neu format la how-to/listicle, heading can co thu tu/buoc ro rang.
8. Nen co FAQ gan cuoi neu keyword co nhieu cau hoi lien quan.
9. Khong copy nguyen van heading cua SERP.

SCHEMA JSON BAT BUOC:
{
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

Tra ve JSON thuan ngay bay gio:`;
}

function renderSerpBlock(serpResults: SerpResult[]): string {
  if (!serpResults.length) {
    return 'Khong co SERP data. Hay tu suy luan intent va tao outline co chieu sau.';
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
${h2List || '  - Khong co du lieu H2'}
H3 noi bat:
${h3List || '  - Khong co du lieu H3'}`;
    })
    .join('\n\n');
}

function buildCountHint(targetWordCount: number): string {
  if (targetWordCount <= 1200) return '4-6';
  if (targetWordCount <= 2200) return '6-9';
  return '8-12';
}
