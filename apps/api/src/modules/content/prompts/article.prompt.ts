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
  paragraph_rhythm?: {
    avg_sentences_per_paragraph?: number;
    preferred_paragraph_style?: string;
  };
  heading_style?: {
    h2_pattern?: string;
    h3_pattern?: string;
    prefers_questions?: boolean;
    prefers_numbers?: boolean;
  };
  transitions?: { preferred?: string[]; avoided?: string[] };
  persuasion?: {
    evidence_style?: string;
    sales_intensity?: string;
    objection_handling?: string;
  };
  forbidden_phrases?: string[];
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
  productContext?: {
    brandSummary: {
      brand: string;
      strengths: string[];
      contact: string[];
    };
    matchedProducts: Array<{
      name: string;
      url: string;
      tagline: string;
      whyRelevant: string[];
      usp: string[];
      audience: string[];
      painPoints: string[];
      socialProof: string[];
    }>;
  } | null;
  brandVoice?: {
    description?: string | null;
    profile: BrandVoiceProfileLite;
    referenceArticles: ReferenceArticleLite[];
  } | null;
}

const TONE_HINTS: Record<ArticleTone, string> = {
  expert: 'chuyên gia, có lập luận, ưu tiên dữ liệu và trải nghiệm thực tế',
  friendly: 'thân thiện, gần gũi, dùng "bạn", giải thích rõ nhưng không lên lớp',
  sales: 'thuyết phục, nhấn mạnh lợi ích, bằng chứng và CTA rõ ràng',
  educational: 'giảng giải từng bước, có ví dụ, giúp người đọc tự làm được',
  storytelling: 'kể chuyện có tình huống, có mâu thuẫn, có bài học rút ra',
};

export function buildArticleSystemPrompt(args: BuildArticlePromptArgs): string {
  const langName = args.language === 'en' ? 'English' : 'Vietnamese';
  const toneLine = args.tone ? `\nTONE MẶC ĐỊNH: ${args.tone} - ${TONE_HINTS[args.tone]}` : '';

  return `Bạn là một content writer SEO cấp cao cho thị trường Việt Nam, có 10 năm kinh nghiệm viết bài chuyển đổi tốt. Bạn viết như người thật: có khẩu vị, có quan điểm, có trải nghiệm, không viết văn AI chung chung.

NGÔN NGỮ:
- Luôn viết bằng ${langName}.
- Nếu viết tiếng Việt, ưu tiên văn nói tự nhiên của người Việt, câu ngắn và rõ.

OUTPUT BẮT BUỘC:
- Trả về MARKDOWN thuần, không JSON, không code fence, không lời dẫn.
- Bắt đầu trực tiếp bằng "# H1".
- Dùng đúng cấu trúc H2/H3 theo outline đã cung cấp. Không ép mọi H2 phải có H3.
- Không tạo metadata riêng, không chèn ghi chú nội bộ, không nói "dưới đây là".
- Bài viết phải đọc như một bài SEO hoàn chỉnh đã sẵn sàng đưa vào CMS, không phải bản nháp ý tưởng.

ƯU TIÊN THỰC THI:
- Nếu có brand voice, brand voice là luật ưu tiên cao hơn văn phong AI chung. Bạn phải bắt chước cách xưng hô, nhịp câu, cách mở/kết bài, cách chuyển ý và mức độ thuyết phục của brand đó.
- Không được viết theo giọng văn "AI trợ lý", "bài mẫu SEO", "nội dung tổng hợp". Nếu brand voice và tone mặc định xung đột, ưu tiên brand voice.
- Tuyệt đối không dùng các cụm từ bị cấm, các cụm từ brand muốn tránh, hoặc các mẫu câu máy móc. Chỉ dùng cụm từ đặc trưng của brand khi đặt vào ngữ cảnh tự nhiên.

DNA NỘI DUNG:
1. Viết cho người đọc trên điện thoại: câu 10-18 từ là chính, đoạn 2-4 câu, mỗi đoạn không quá 60 từ.
2. Đi thẳng vào vấn đề trong 2 câu đầu. Tránh mở bài kiểu "Bạn có biết", "Hãy cùng tìm hiểu", "Trong bài viết này".
3. Mỗi 200-300 từ nên có một chi tiết cụ thể: con số, mốc thời gian, ví dụ, công cụ, nhóm người dùng hoặc tình huống thực tế.
4. Có quan điểm rõ, nhưng mỗi quan điểm phải có lý do. Nếu có trade-off, nói thẳng.
5. Không hứa quá đà. Nếu giải pháp chỉ phù hợp với một nhóm người dùng, nói rõ nhóm đó.
6. SEO tự nhiên: keyword chính xuất hiện trong intro, một vài H2/body và kết luận; không nhồi từ khóa.
7. LSI keywords phải được cài tự nhiên, không liệt kê máy móc.
8. Nếu thiếu dữ liệu, dùng cụm từ cẩn thận như "thường", "trong nhiều trường hợp", "nên kiểm tra lại" thay vì bịa số liệu.
9. Chú ý title và các heading phải có sức hút, để tăng CTR và giữ người đọc ở lại.
10. Có thể dùng số liệu, 5W1H, so sánh, tranh luận, case thực tế, câu chuyện ngắn nếu hợp chủ đề.
11. Ưu tiên "direct-answer-first": với truy vấn dạng best/top/how/what/why, câu đầu hoặc 2 câu đầu phải trả lời trực tiếp truy vấn trước khi mở rộng.
12. Tối ưu cho AI search: mỗi section chỉ nên xoay quanh một ý chính rõ ràng để dễ được trích dẫn.
13. Không kéo bài dài bằng filler. Nếu một ý không thêm giá trị mới, bỏ bớt thay vì kéo chữ.

CHẤT LƯỢNG CẦN ĐẠT:
- Đọc xong mỗi H2, người đọc phải có thêm một quyết định hoặc một hành động cụ thể.
- Bài viết phải vượt outline đối thủ bằng chiều sâu, ví dụ thực tế và góc nhìn riêng.
- Kết luận không tóm tắt dài dòng; chốt lại insight và CTA cụ thể.${toneLine}
${buildProductContextInjection(args.productContext)}
${buildBrandVoiceInjection(args.brandVoice)}`;
}

export function buildArticleUserPrompt(args: BuildArticlePromptArgs): string {
  const outlineMd = renderOutlineAsMarkdown(args.outline);
  const formatRules = buildFormatRules(args.format);
  const sectionCount = Math.max(1, args.outline.sections.length);
  const sectionBudget = Math.max(180, Math.floor((args.targetWordCount - 320) / sectionCount));
  const minWords = Math.floor(args.targetWordCount * 0.9);
  const maxWords = Math.ceil(args.targetWordCount * 1.12);

  return `Viết một bài SEO hoàn chỉnh khoảng ${args.targetWordCount} từ dựa trên outline dưới đây.

KEYWORD CHÍNH:
${args.keyword}

FORMAT:
${args.format}

OUTLINE BẮT BUỘC BÁM THEO:
${outlineMd}

YÊU CẦU THỰC THI:
1. H1 phải chứa keyword "${args.keyword}" và giữ đúng ý định của outline.
2. Mở bài phải theo nguyên tắc direct-answer-first: trả lời trực tiếp truy vấn trong 1-2 câu đầu, rồi mới mở rộng bằng hook, bối cảnh hoặc câu chuyện.
3. Intro 120-180 từ: có hook cụ thể, nhắc keyword trong 50 từ đầu, nói rõ vấn đề người đọc đang gặp.
4. Ngay sau intro, thêm một block trích dẫn dạng:
> **Key Takeaways**
> - ...
> - ...
> - ...
Mỗi bullet phải là kết luận hoặc khuyến nghị thật, không phải mục lục.
5. Độ dài bắt buộc: bài viết phải nằm trong khoảng ${minWords}-${maxWords} từ. Không được dừng lại sớm sau 300-800 từ.
6. Với đa số bài blog, ưu tiên viết gọn trong khoảng 1.500-3.000 từ. Chỉ kéo lên gần mức tối đa nếu chủ đề thật sự cần chiều sâu.
7. Phân bổ độ dài: intro 120-180 từ, mỗi H2 khoảng ${sectionBudget} từ, kết bài 120-180 từ. Nếu outline không có H3 thì viết trực tiếp theo H2, không tự ý đẻ quá nhiều H3 mới.
8. Mỗi H2 cần có lập luận đầy đủ, ví dụ hoặc tình huống thực tế. Không viết mỗi mục quá mỏng.
9. Nếu có H3, mỗi H3 chỉ trả lời một ý cụ thể, không lặp lại tiêu đề.
10. Liên kết chặt giữa outline -> brand voice -> nội dung: mỗi heading trong outline phải được viết thành nội dung thật, đúng tone/từ vựng/CTA/nhịp câu/cách chuyển ý của brand voice nếu có.
7b. Nếu có thông tin sản phẩm MKT liên quan, chèn vào đúng chỗ trong bài dưới dạng ví dụ, giải pháp, checklist, so sánh hoặc CTA mềm. Không biến mọi bài viết thành trang bán hàng.
11. Dùng bảng Markdown khi cần so sánh, quy trình, checklist hoặc tiêu chí lựa chọn.
12. Bold keyword chính 3-5 lần bằng **${args.keyword}** ở các vị trí tự nhiên.
13. Bài viết phải có TOC/mục lục gần đầu bài bằng danh sách liên kết hoặc danh sách thường để người đọc scan nhanh.
14. Trong bài nên có ít nhất 1 bảng Markdown và 1 vị trí để nhúng video nếu chủ đề phù hợp. Nếu không có link video thật, viết một dòng gợi ý video cần nhúng.
15. Trong bài phải có gợi ý cho ít nhất 3 hình ảnh minh họa phù hợp với nội dung. Có thể đặt bằng dòng nghiêng dạng *Gợi ý hình ảnh:* ... tại đúng vị trí.
16. Phải có tối thiểu 3 internal link và 2 external link ở dạng Markdown. External link chỉ trỏ tới nguồn uy tín, không trỏ đối thủ, và ưu tiên ghi chú (nofollow) nếu là link ngoài không thuộc doanh nghiệp.
17. Từ khóa chính và từ khóa phụ phải được phân bố tự nhiên ở đầu, giữa và cuối bài. Tránh lặp lại một cụm từ quá dày.
18. Nếu có ảnh trong bài, alt text/gợi ý alt phải hướng đến người dùng và nên chứa keyword chính hoặc biến thể hợp lý.
19. Thêm FAQ ở cuối bài khi hợp chủ đề, ưu tiên 4-6 câu hỏi viết theo ngôn ngữ người dùng thật hay hỏi. Mỗi câu trả lời phải trả lời thẳng ở câu đầu rồi mới mở rộng.
20. Kết bài 120-180 từ: tổng kết insight chính và CTA rõ ràng.
21. Nếu đến gần cuối mà bài chưa đạt ${minWords} từ, tiếp tục mở rộng các H2 mỏng bằng ví dụ, checklist, lỗi thường gặp, bảng so sánh hoặc case thực tế.
22. Chỉ trả về Markdown thuần, bắt đầu ngay bằng "#".

QUY TẮC THEO FORMAT:
${formatRules}

Bắt đầu viết bài:`;
}

function buildProductContextInjection(
  productContext: BuildArticlePromptArgs['productContext'],
): string {
  if (!productContext || productContext.matchedProducts.length === 0) return '';

  const lines: string[] = ['', 'PRODUCT CONTEXT - CHỈ DÙNG KHI THỰC SỰ LIÊN QUAN:'];
  lines.push(`- Thương hiệu: ${productContext.brandSummary.brand}`);
  lines.push(`- Điểm mạnh chung: ${productContext.brandSummary.strengths.join(' | ')}`);
  lines.push(
    '- Cách dùng trong bài: chỉ chèn sản phẩm khi nó giải quyết đúng pain point của keyword/outline; ưu tiên giống giải pháp, ví dụ triển khai, checklist, hoặc CTA mềm ở cuối bài.',
  );
  lines.push(
    '- Không được nhắc tên sản phẩm một cách gò ép trong mọi H2. Nếu chủ đề không liên quan trực tiếp, chỉ nhắc rất nhẹ hoặc bỏ qua.',
  );

  productContext.matchedProducts.forEach((item, index) => {
    lines.push(`- Sản phẩm liên quan ${index + 1}: ${item.name} - ${item.tagline}`);
    lines.push(`  URL: ${item.url}`);
    lines.push(`  Vì sao liên quan: ${item.whyRelevant.join(' | ')}`);
    lines.push(`  USP: ${item.usp.join(' | ')}`);
    lines.push(`  Đối tượng phù hợp: ${item.audience.join(' | ')}`);
    lines.push(`  Pain point giải quyết: ${item.painPoints.join(' | ')}`);
    lines.push(`  Social proof: ${item.socialProof.join(' | ')}`);
  });

  return `\n${lines.join('\n')}`;
}

function buildBrandVoiceInjection(brandVoice: BuildArticlePromptArgs['brandVoice']): string {
  if (!brandVoice) return '';

  const bv = brandVoice.profile;
  const lines: string[] = ['', 'BRAND VOICE BẮT BUỘC ÁP DỤNG:'];
  if (brandVoice.description?.trim()) lines.push(`- Hướng dẫn thêm từ admin: ${brandVoice.description.trim()}`);
  if (bv.brand_name) lines.push(`- Tên brand: ${bv.brand_name}`);
  if (bv.tone?.primary) lines.push(`- Tone chính: ${bv.tone.primary}`);
  if (bv.tone?.secondary?.length) lines.push(`- Tone phụ: ${bv.tone.secondary.join(', ')}`);
  if (bv.sentence_structure?.avg_words_per_sentence) {
    lines.push(`- Độ dài câu trung bình: ${bv.sentence_structure.avg_words_per_sentence} từ`);
  }
  if (bv.addressing?.primary) {
    const formality = bv.addressing.formality ? `, mức độ: ${bv.addressing.formality}` : '';
    lines.push(`- Xưng hô với độc giả: ${bv.addressing.primary}${formality}`);
  }
  if (bv.addressing?.self_reference) lines.push(`- Cách tự xưng của brand: ${bv.addressing.self_reference}`);
  if (bv.signature_phrases?.length) {
    lines.push(`- Cụm từ đặc trưng nên dùng có chọn lọc: ${bv.signature_phrases.slice(0, 8).join(', ')}`);
  }
  if (bv.vocabulary?.preferred?.length) {
    lines.push(`- Từ/cụm từ ưu tiên: ${bv.vocabulary.preferred.slice(0, 12).join(', ')}`);
  }
  if (bv.vocabulary?.avoided?.length) {
    lines.push(`- Từ/cụm từ cần tránh: ${bv.vocabulary.avoided.slice(0, 12).join(', ')}`);
  }
  if (bv.emoji_usage?.enabled) {
    const density = bv.emoji_usage.density ?? 'thấp';
    const emojis = bv.emoji_usage.common_emojis?.length ? ` (${bv.emoji_usage.common_emojis.join(' ')})` : '';
    lines.push(`- Emoji: được dùng với mật độ ${density}${emojis}`);
  } else if (bv.emoji_usage?.enabled === false) {
    lines.push('- Emoji: không dùng emoji');
  }
  if (bv.patterns?.opening_style) lines.push(`- Kiểu mở bài: ${bv.patterns.opening_style}`);
  if (bv.patterns?.closing_style) lines.push(`- Kiểu kết bài: ${bv.patterns.closing_style}`);
  if (bv.patterns?.cta_style) lines.push(`- Kiểu CTA: ${bv.patterns.cta_style}`);
  if (bv.paragraph_rhythm?.avg_sentences_per_paragraph) {
    lines.push(`- Nhịp đoạn văn: trung bình ${bv.paragraph_rhythm.avg_sentences_per_paragraph} câu/đoạn`);
  }
  if (bv.paragraph_rhythm?.preferred_paragraph_style) {
    lines.push(`- Kiểu đoạn văn ưu tiên: ${bv.paragraph_rhythm.preferred_paragraph_style}`);
  }
  if (bv.heading_style?.h2_pattern) lines.push(`- Kiểu đặt H2: ${bv.heading_style.h2_pattern}`);
  if (bv.heading_style?.h3_pattern) lines.push(`- Kiểu đặt H3: ${bv.heading_style.h3_pattern}`);
  if (typeof bv.heading_style?.prefers_questions === 'boolean') {
    lines.push(`- Heading dạng câu hỏi: ${bv.heading_style.prefers_questions ? 'ưu tiên' : 'không ưu tiên'}`);
  }
  if (typeof bv.heading_style?.prefers_numbers === 'boolean') {
    lines.push(`- Heading có số đếm: ${bv.heading_style.prefers_numbers ? 'ưu tiên' : 'không ưu tiên'}`);
  }
  if (bv.transitions?.preferred?.length) {
    lines.push(`- Cụm chuyển ý ưu tiên: ${bv.transitions.preferred.slice(0, 10).join(', ')}`);
  }
  if (bv.transitions?.avoided?.length) {
    lines.push(`- Cụm chuyển ý cần tránh: ${bv.transitions.avoided.slice(0, 10).join(', ')}`);
  }
  if (bv.persuasion?.evidence_style) {
    lines.push(`- Cách đưa bằng chứng: ${bv.persuasion.evidence_style}`);
  }
  if (bv.persuasion?.sales_intensity) {
    lines.push(`- Mức độ bán hàng: ${bv.persuasion.sales_intensity}`);
  }
  if (bv.persuasion?.objection_handling) {
    lines.push(`- Cách xử lý phản vấn: ${bv.persuasion.objection_handling}`);
  }
  if (bv.forbidden_phrases?.length) {
    lines.push(`- Cụm từ cấm dùng: ${bv.forbidden_phrases.slice(0, 12).join(', ')}`);
  }
  lines.push('- Mục tiêu là để người đọc có cảm giác bài này do chính brand viết, không phải AI phân tích hộ.');

  if (brandVoice.referenceArticles.length) {
    lines.push('', 'BÀI MẪU ĐỂ BẮT CHƯỚC PHONG CÁCH, KHÔNG COPY NỘI DUNG:');
    brandVoice.referenceArticles.slice(0, 3).forEach((article, index) => {
      const excerpt = article.content.slice(0, 1800);
      lines.push(`\n[Mẫu ${index + 1}${article.title ? ` - ${article.title}` : ''}]\n${excerpt}`);
    });
  }

  return `\n${lines.join('\n')}`;
}

function buildFormatRules(format: OutlineFormat): string {
  const rules: Record<OutlineFormat, string> = {
    blog: '- Blog: viết chuyên sâu, có intro mạnh, giải thích rõ, ví dụ thực tế, FAQ và CTA mềm.',
    listicle: '- Listicle: mỗi mục chính là một H2 có số thứ tự, có tiêu chí xếp hạng, ưu/nhược điểm ngắn và kết luận lựa chọn.',
    'how-to': '- How-to: trình bày theo các bước hành động; mỗi bước có mục tiêu, cách làm, lỗi thường gặp và checklist.',
    review: '- Review: có tiêu chí đánh giá, trải nghiệm sử dụng, pros/cons, đối tượng phù hợp/không phù hợp và verdict.',
    comparison: '- Comparison: bắt buộc có bảng so sánh Markdown, tiêu chí rõ, phân tích trade-off và khuyến nghị theo từng nhu cầu.',
    faq: '- FAQ: mỗi H2/H3 là câu hỏi thật; trả lời ngắn gọn trước, sau đó mở rộng bằng ví dụ và lưu ý.',
    landing: '- Landing: viết theo flow pain -> solution -> proof -> offer -> CTA; mỗi section phải phục vụ chuyển đổi.',
    product: '- Product: làm rõ đối tượng phù hợp, tính năng, lợi ích, bằng chứng, quy trình dùng thử/mua và CTA.',
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
