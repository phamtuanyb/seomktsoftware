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
  return `Ban la senior SEO content strategist cho thi truong Viet Nam. Nhiem vu cua ban la phan tich top SERP va tao outline gon, dung intent, de writer co the viet ngay, nhung khong copy doi thu.

NGON NGU:
- Luon viet outline bang ${langName}.

TRIET LY TAO OUTLINE:
1. Outline la bo khung bai viet hoan chinh, khong tao qua nhieu heading.
2. Moi H2 phai co vai tro ro: mo bai, giai thich, trien khai, ra quyet dinh, ket luan.
3. Uu tien cach dien dat gon, de doc, sat phong cach marketing thuc chien.
4. Neu co du lieu brand voice hoac bai mau tu he thong, hay noi theo nhip viet va cach dat van de do.
5. Khong copy heading cua SERP. Chi hoc y dinh tim kiem va cac gap can bo sung.
6. Uu tien outline ngan. Chi giu lai nhung muc that su can de viet bai.

OUTPUT BAT BUOC:
- Chi tra ve JSON thuan parse duoc bang JSON.parse().
- Khong markdown, khong code fence, khong giai thich truoc/sau JSON.
- JSON chi gom dung 4 field: "meta_title", "meta_description", "h1", "sections".
- Moi section co "h2" va "subsections"; moi subsection co "h3" va "bullets".
- Khong them field ngoai schema nhu metadata, angle, score, notes.`;
}

export function buildOutlineUserPrompt(args: BuildOutlinePromptArgs): string {
  const { keyword, intent, format, targetWordCount, language, serpResults } = args;
  const serpBlock = renderSerpBlock(serpResults);
  const countHint = buildCountHint(targetWordCount);

  return `Phan tich top ${serpResults.length} SERP cho keyword "${keyword}", tim gap cua doi thu, roi tao outline gon hon va de trien khai hon.

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
1. Meta Title dai 50-70 ky tu, keyword chinh o nua dau title, uu tien CTR.
2. Meta Description dai 140-165 ky tu, co keyword chinh va CTA nhe.
3. H1 bat buoc chua keyword "${keyword}", ro nghia, hap dan, khong qua 300 ky tu.
4. Tao ${countHint} H2 chinh la du. Khong mo rong them heading phu neu khong can thiet.
5. Moi H2 chi co 1-2 H3. Moi H3 chi can 2-3 bullet ngan, du y de writer trien khai.
6. Cau truc tong the:
   - Mo bai: hook + 5W1H + keyword chinh trong 100 chu dau
   - Than bai: kim tu thap nguoc, y quan trong dat truoc, co chen keyword chinh va key phu tu nhien
   - Ket bai: tom tat, nhac lai keyword, CTA ro rang
7. Neu format la comparison/review, phai co H2 ve tieu chi danh gia hoac bang so sanh.
8. Neu format la how-to/listicle, phai the hien trinh tu buoc hoac thu tu ro rang.
9. Neu intent la commercial/transactional, phai co phan tieu chi lua chon, bang chung, trade-off va CTA.
10. Co the dua FAQ vao cuoi bai, nhung chi khi that su can; mac dinh bo qua FAQ de outline gon hon.
11. Can the hien su lien ket voi phong cach MKT va brand voice neu co, nhung van uu tien do ro rang cua outline.
12. Khong copy nguyen van heading cua SERP.
13. Muc tieu la mot outline ngan, de duyet nhanh trong admin, khong phai mot ban draft qua chi tiet.

SCHEMA JSON BAT BUOC:
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
  if (targetWordCount <= 1800) return '3';
  return '4';
}
