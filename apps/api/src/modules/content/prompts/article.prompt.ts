import type { Outline } from '../schemas/outline.schema';
import type { ArticleTone } from '../dto/generate-article.dto';
import type { OutlineFormat } from '../dto/generate-outline.dto';

type ArticleOutline = Pick<Outline, 'h1' | 'sections'> &
  Partial<Pick<Outline, 'meta_title' | 'meta_description'>>;

export interface BrandVoiceProfileLite {
  brand_name?: string;
  tone?: { primary?: string; secondary?: string[] };
  sentence_structure?: { avg_words_per_sentence?: number };
  addressing?: { primary?: string; formality?: string; self_reference?: string };
  signature_phrases?: string[];
  vocabulary?: { preferred?: string[]; avoided?: string[] };
  emoji_usage?: { enabled?: boolean; density?: string | number; common_emojis?: string[] };
  patterns?: { opening_style?: string; closing_style?: string; cta_style?: string };
}

export interface ReferenceArticleLite {
  title?: string;
  content: string;
}

export interface BuildArticlePromptArgs {
  keyword: string;
  outline: ArticleOutline;
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
  expert: 'chuyen gia, co lap luan, uu tien du lieu va trai nghiem thuc te',
  friendly: 'than thien, gan gui, dung "ban", giai thich ro nhung khong len lop',
  sales: 'thuyet phuc, nhan manh loi ich, bang chung va CTA ro rang',
  educational: 'giang giai tung buoc, co vi du, giup nguoi doc tu lam duoc',
  storytelling: 'ke chuyen co tinh huong, co mau thuan, co bai hoc rut ra',
};

export function buildArticleSystemPrompt(args: BuildArticlePromptArgs): string {
  const langName = args.language === 'en' ? 'English' : 'Vietnamese';
  const toneLine = args.tone ? `\nTONE MAC DINH: ${args.tone} - ${TONE_HINTS[args.tone]}` : '';

  return `Ban la mot content writer SEO cap cao cho thi truong Viet Nam, co 10 nam kinh nghiem viet bai chuyen doi tot. Ban viet nhu nguoi that: co khau vi, co quan diem, co trai nghiem, khong viet van AI chung chung.

NGON NGU:
- Luon viet bang ${langName}.
- Neu viet tieng Viet, uu tien van noi tu nhien cua nguoi Viet, cau ngan va ro.

OUTPUT BAT BUOC:
- Tra ve MARKDOWN thuan, khong JSON, khong code fence, khong loi dan.
- Bat dau truc tiep bang "# H1".
- Dung dung cau truc H2/H3 theo outline da cung cap. Khong ep moi H2 phai co H3.
- Khong tao metadata rieng, khong chen ghi chu noi bo, khong noi "duoi day la".
- Bai viet phai doc nhu mot bai SEO hoan chinh da san sang dua vao CMS, khong phai ban nhap y tuong.

DNA NOI DUNG:
1. Viet cho nguoi doc tren dien thoai: cau 10-18 tu la chinh, doan 2-4 cau, moi doan khong qua 60 tu.
2. Di thang vao van de trong 2 cau dau. Tranh mo bai kieu "Ban co biet", "Hay cung tim hieu", "Trong bai viet nay".
3. Moi 200-300 tu nen co mot chi tiet cu the: con so, moc thoi gian, vi du, cong cu, nhom nguoi dung hoac tinh huong thuc te.
4. Co quan diem ro, nhung moi quan diem phai co ly do. Neu co trade-off, noi thang.
5. Khong hua qua da. Neu giai phap chi phu hop voi mot nhom nguoi dung, noi ro nhom do.
6. SEO tu nhien: keyword chinh xuat hien trong intro, mot vai H2/body va ket luan; khong nhoi tu khoa.
7. LSI keywords phai duoc cai tu nhien, khong liet ke may moc.
8. Neu thieu du lieu, dung cum tu can than nhu "thuong", "trong nhieu truong hop", "nen kiem tra lai" thay vi bia so lieu.
9. Chu y title va cac heading phai co suc hut, de tang CTR va giu nguoi doc o lai.
10. Co the dung so lieu, 5W1H, so sanh, tranh luan, case thuc te, cau chuyen ngan neu hop chu de.

CHAT LUONG CAN DAT:
- Doc xong moi H2, nguoi doc phai co them mot quyet dinh hoac mot hanh dong cu the.
- Bai viet phai vuot outline doi thu bang chieu sau, vi du thuc te va goc nhin rieng.
- Ket luan khong tom tat dai dong; chot lai insight va CTA cu the.${toneLine}
${buildBrandVoiceInjection(args.brandVoice)}`;
}

export function buildArticleUserPrompt(args: BuildArticlePromptArgs): string {
  const outlineMd = renderOutlineAsMarkdown(args.outline);
  const formatRules = buildFormatRules(args.format);
  const sectionCount = Math.max(1, args.outline.sections.length);
  const sectionBudget = Math.max(180, Math.floor((args.targetWordCount - 320) / sectionCount));
  const minWords = Math.floor(args.targetWordCount * 0.9);
  const maxWords = Math.ceil(args.targetWordCount * 1.12);

  return `Viet mot bai SEO hoan chinh khoang ${args.targetWordCount} tu dua tren outline duoi day.

KEYWORD CHINH:
${args.keyword}

FORMAT:
${args.format}

OUTLINE BAT BUOC BAM THEO:
${outlineMd}

YEU CAU THUC THI:
1. H1 phai chua keyword "${args.keyword}" va giu dung y dinh cua outline.
2. Intro 120-180 tu: co hook cu the, nhac keyword trong 50 tu dau, noi ro van de nguoi doc dang gap.
3. Do dai bat buoc: bai viet phai nam trong khoang ${minWords}-${maxWords} tu. Khong duoc dung lai som sau 300-800 tu.
4. Phan bo do dai: intro 120-180 tu, moi H2 khoang ${sectionBudget} tu, ket bai 120-180 tu. Neu outline khong co H3 thi viet truc tiep theo H2, khong tu y de qua nhieu H3 moi.
5. Moi H2 can co lap luan day du, vi du hoac tinh huong thuc te. Khong viet moi muc qua mong.
6. Neu co H3, moi H3 chi tra loi mot y cu the, khong lap lai tieu de.
7. Lien ket chat giua outline -> brand voice -> noi dung: moi heading trong outline phai duoc viet thanh noi dung that, dung tone/tu vung/CTA cua brand voice neu co.
8. Dung bang Markdown khi can so sanh, quy trinh, checklist hoac tieu chi lua chon.
9. Bold keyword chinh 3-5 lan bang **${args.keyword}** o cac vi tri tu nhien.
10. Bai viet phai co TOC/muc luc gan dau bai bang danh sach lien ket hoac danh sach thuong de nguoi doc scan nhanh.
11. Trong bai nen co it nhat 1 bang Markdown va 1 vi tri de nhung video neu chu de phu hop. Neu khong co link video that, viet mot dong goi y video can nhung.
12. Trong bai phai co goi y cho it nhat 3 hinh anh minh hoa phu hop voi noi dung. Co the dat bang dong nghieng dang *Goi y hinh anh:* ... tai dung vi tri.
13. Phai co internal link va external link o dang Markdown. External link chi tro toi nguon uy tin, khong tro doi thu, va uu tien ghi chu (nofollow) neu la link ngoai khong thuoc doanh nghiep.
14. Tu khoa chinh va tu khoa phu phai duoc phan bo tu nhien o dau, giua va cuoi bai. Tranh lap lai mot cum tu qua day.
15. Neu co anh trong bai, alt text/goi y alt phai huong den nguoi dung va nen chua keyword chinh hoac bien the hop ly.
16. Ket bai 120-180 tu: tong ket insight chinh va CTA ro rang.
17. Neu den gan cuoi ma bai chua dat ${minWords} tu, tiep tuc mo rong cac H2 mong bang vi du, checklist, loi thuong gap, bang so sanh hoac case thuc te.
18. Chi tra ve Markdown thuan, bat dau ngay bang "#".

QUY TAC THEO FORMAT:
${formatRules}

Bat dau viet bai:`;
}

function buildBrandVoiceInjection(brandVoice: BuildArticlePromptArgs['brandVoice']): string {
  if (!brandVoice) return '';

  const bv = brandVoice.profile;
  const lines: string[] = ['', 'BRAND VOICE BAT BUOC AP DUNG:'];
  if (bv.brand_name) lines.push(`- Ten brand: ${bv.brand_name}`);
  if (bv.tone?.primary) lines.push(`- Tone chinh: ${bv.tone.primary}`);
  if (bv.tone?.secondary?.length) lines.push(`- Tone phu: ${bv.tone.secondary.join(', ')}`);
  if (bv.sentence_structure?.avg_words_per_sentence) {
    lines.push(`- Do dai cau trung binh: ${bv.sentence_structure.avg_words_per_sentence} tu`);
  }
  if (bv.addressing?.primary) {
    const formality = bv.addressing.formality ? `, muc do: ${bv.addressing.formality}` : '';
    lines.push(`- Xung ho voi doc gia: ${bv.addressing.primary}${formality}`);
  }
  if (bv.addressing?.self_reference) lines.push(`- Cach tu xung cua brand: ${bv.addressing.self_reference}`);
  if (bv.signature_phrases?.length) {
    lines.push(`- Cum tu dac trung nen dung co chon loc: ${bv.signature_phrases.slice(0, 8).join(', ')}`);
  }
  if (bv.vocabulary?.preferred?.length) {
    lines.push(`- Tu/cum tu uu tien: ${bv.vocabulary.preferred.slice(0, 12).join(', ')}`);
  }
  if (bv.vocabulary?.avoided?.length) {
    lines.push(`- Tu/cum tu can tranh: ${bv.vocabulary.avoided.slice(0, 12).join(', ')}`);
  }
  if (bv.emoji_usage?.enabled) {
    const density = bv.emoji_usage.density ?? 'thap';
    const emojis = bv.emoji_usage.common_emojis?.length ? ` (${bv.emoji_usage.common_emojis.join(' ')})` : '';
    lines.push(`- Emoji: duoc dung voi mat do ${density}${emojis}`);
  } else if (bv.emoji_usage?.enabled === false) {
    lines.push('- Emoji: khong dung emoji');
  }
  if (bv.patterns?.opening_style) lines.push(`- Kieu mo bai: ${bv.patterns.opening_style}`);
  if (bv.patterns?.closing_style) lines.push(`- Kieu ket bai: ${bv.patterns.closing_style}`);
  if (bv.patterns?.cta_style) lines.push(`- Kieu CTA: ${bv.patterns.cta_style}`);

  if (brandVoice.referenceArticles.length) {
    lines.push('', 'BAI MAU DE BAT CHUOC PHONG CACH, KHONG COPY NOI DUNG:');
    brandVoice.referenceArticles.slice(0, 3).forEach((article, index) => {
      const excerpt = article.content.slice(0, 1800);
      lines.push(`\n[Mau ${index + 1}${article.title ? ` - ${article.title}` : ''}]\n${excerpt}`);
    });
  }

  return `\n${lines.join('\n')}`;
}

function buildFormatRules(format: OutlineFormat): string {
  const rules: Record<OutlineFormat, string> = {
    blog: '- Blog: viet chuyen sau, co intro manh, giai thich ro, vi du thuc te, FAQ va CTA mem.',
    listicle: '- Listicle: moi muc chinh la mot H2 co so thu tu, co tieu chi xep hang, uu/nhuoc diem ngan va ket luan lua chon.',
    'how-to': '- How-to: trinh bay theo cac buoc hanh dong; moi buoc co muc tieu, cach lam, loi thuong gap va checklist.',
    review: '- Review: co tieu chi danh gia, trai nghiem su dung, pros/cons, doi tuong phu hop/khong phu hop va verdict.',
    comparison: '- Comparison: bat buoc co bang so sanh Markdown, tieu chi ro, phan tich trade-off va khuyen nghi theo tung nhu cau.',
    faq: '- FAQ: moi H2/H3 la cau hoi that; tra loi ngan gon truoc, sau do mo rong bang vi du va luu y.',
    landing: '- Landing: viet theo flow pain -> solution -> proof -> offer -> CTA; moi section phai phuc vu chuyen doi.',
    product: '- Product: lam ro doi tuong phu hop, tinh nang, loi ich, bang chung, quy trinh dung thu/mua va CTA.',
  };
  return rules[format];
}

function renderOutlineAsMarkdown(outline: ArticleOutline): string {
  const lines: string[] = [`# ${outline.h1}`];
  for (const section of outline.sections) {
    lines.push(`\n## ${section.h2}`);
    for (const sub of section.subsections) {
      lines.push(`### ${sub.h3}`);
      for (const bullet of sub.bullets) {
        lines.push(`- ${bullet}`);
      }
    }
  }
  return lines.join('\n');
}
