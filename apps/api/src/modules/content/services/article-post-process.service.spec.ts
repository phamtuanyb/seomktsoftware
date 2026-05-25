import { ArticlePostProcessService } from './article-post-process.service';

describe('ArticlePostProcessService', () => {
  const svc = new ArticlePostProcessService();

  const sampleMarkdown = `# SEO local cho doanh nghiệp nhỏ — Hướng dẫn 2026

SEO local cho doanh nghiệp nhỏ là chiến lược giúp cửa hàng tại khu vực địa phương xuất hiện trên Google Maps + kết quả tìm kiếm địa lý. Bài viết này tổng hợp lộ trình triển khai SEO local hiệu quả nhất cho năm 2026, kèm checklist kiểm tra hàng tuần.

## SEO local là gì?

SEO local tập trung vào việc tối ưu hiển thị trên các tìm kiếm có yếu tố địa lý. Nó khác SEO truyền thống ở 3 điểm: kết quả Map Pack, vai trò của Google Business Profile, và tín hiệu citation.

### Khác biệt với SEO truyền thống

- Ưu tiên Google Business Profile thay vì page rank tổng thể
- Tín hiệu citation (NAP) từ Yelp, Foursquare quan trọng hơn backlink chung
- Map Pack chiếm 35% click trên SERP địa lý

## Lợi ích chính

SEO local mang lại traffic chất lượng cao vì user có intent mua hàng rõ ràng.

## Hướng dẫn triển khai

Bước 1 — Tối ưu Google Business Profile.

## FAQ — Câu hỏi thường gặp

### SEO local mất bao lâu để có kết quả?

Thường mất 3-6 tháng nếu cạnh tranh trung bình. Khu vực cạnh tranh cao có thể cần 9-12 tháng.

### Cần ngân sách bao nhiêu?

Tối thiểu 5 triệu/tháng cho doanh nghiệp nhỏ — gồm Google Ads + content + citation.

### Có cần thuê agency không?

Doanh nghiệp dưới 10 nhân sự có thể tự làm với hướng dẫn này. Trên 10 nhân sự nên thuê.

## Kết luận

SEO local là cuộc chơi dài hạn nhưng ROI cao. Bắt đầu ngay với Google Business Profile của bạn hôm nay.`;

  it('returns html, meta_title, meta_description, score, lsi', () => {
    const out = svc.process({ markdown: sampleMarkdown, keyword: 'SEO local' });

    expect(out.html).toContain('<h1');
    expect(out.html).toContain('SEO local');
    expect(out.meta_title.length).toBeGreaterThan(10);
    expect(out.meta_title.length).toBeLessThanOrEqual(60);
    expect(out.meta_title.toLowerCase()).toContain('seo local');
    expect(out.meta_description.length).toBeGreaterThanOrEqual(140);
    expect(out.meta_description.length).toBeLessThanOrEqual(160);
    expect(out.meta_description.toLowerCase()).toContain('seo local');
    expect(out.word_count).toBeGreaterThan(200);
    expect(out.keyword_count).toBeGreaterThan(2);
    expect(out.lsi_keywords.length).toBeGreaterThan(3);
    expect(out.content_score).toBeGreaterThan(0);
    expect(out.content_score).toBeLessThanOrEqual(100);
  });

  it('bolds the keyword up to 4 times (skipping headings and existing bolds)', () => {
    const md =
      'Test **SEO local** đã có sẵn bold. SEO local lần 2. SEO local lần 3. SEO local lần 4. SEO local lần 5.';
    const out = svc.boldKeyword(md, 'SEO local', 4);
    const boldedCount = (out.match(/\*\*SEO local\*\*/g) ?? []).length;
    expect(boldedCount).toBeLessThanOrEqual(5); // existing + up to 4 new
    // The existing one stays unchanged + 4 more get bolded.
    expect(out).toMatch(/\*\*SEO local\*\* lần 2/);
  });

  it('detects FAQ section and emits at least 1 FAQPage schema item when enabled', () => {
    const out = svc.process({
      markdown: sampleMarkdown,
      keyword: 'SEO local',
      enableSchemaMarkup: true,
    });
    expect(out.html).toContain('"@type":"Article"');
    expect(out.html).toContain('"@type":"FAQPage"');
    expect(out.html).toContain('"@type":"Question"');
  });

  it('does NOT inject schema when enableSchemaMarkup is false', () => {
    const out = svc.process({
      markdown: sampleMarkdown,
      keyword: 'SEO local',
      enableSchemaMarkup: false,
    });
    expect(out.html).not.toContain('application/ld+json');
  });

  it('content_score_breakdown contains the 6 sub-rules', () => {
    const out = svc.process({ markdown: sampleMarkdown, keyword: 'SEO local' });
    expect(Object.keys(out.content_score_breakdown).sort()).toEqual([
      'faq_section',
      'heading_structure',
      'intro_hook',
      'keyword_density',
      'title_keyword',
      'word_count',
    ]);
  });

  it('pads meta_description when intro is short', () => {
    const shortMd = '# Hello\n\nShort intro.';
    const out = svc.process({ markdown: shortMd, keyword: 'foobar' });
    expect(out.meta_description.length).toBeGreaterThanOrEqual(140);
    expect(out.meta_description).toContain('foobar');
  });

  it('flags low keyword density correctly', () => {
    const md = '# Title with keyword\n\n' + 'random words filler '.repeat(500);
    const out = svc.process({ markdown: md, keyword: 'keyword' });
    expect(out.keyword_density).toBeLessThan(0.005);
    expect(out.content_score_breakdown['keyword_density']?.passed).toBe(false);
  });
});
