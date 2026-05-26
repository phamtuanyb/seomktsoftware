import type { AuditInput } from './base.rule';
import { KeywordDensityRule } from './keyword-density.rule';
import { TitleKeywordRule } from './title-keyword.rule';
import { MetaDescriptionRule } from './meta-description.rule';
import { H1UniqueRule } from './h1-unique.rule';
import { HeadingStructureRule } from './heading-structure.rule';
import { WordCountRule } from './word-count.rule';
import { LinksRule } from './links.rule';
import { ImagesAltRule } from './images-alt.rule';
import { SchemaMarkupRule } from './schema-markup.rule';
import { LsiKeywordsRule } from './lsi-keywords.rule';
import { IntroHookRule } from './intro-hook.rule';
import { FaqSectionRule } from './faq-section.rule';

const goodArticle: AuditInput = {
  title: 'SEO local cho doanh nghiệp nhỏ — Hướng dẫn 2026',
  content: `
    <article>
      <h1>SEO local cho doanh nghiệp nhỏ — Hướng dẫn 2026</h1>
      <p>SEO local cho doanh nghiệp nhỏ giúp cửa hàng địa phương xuất hiện trên Google Maps. Bài viết
      này tổng hợp lộ trình triển khai SEO local hiệu quả nhất năm 2026, có ${'ROI '.repeat(80)}.</p>
      <h2>SEO local là gì?</h2>
      <p>SEO local tập trung vào tối ưu hiển thị địa phương. ${'Citation NAP backlink Map Pack '.repeat(60)}</p>
      <h2>Hướng dẫn triển khai</h2>
      <p>${'Google Business Profile danh sách doanh nghiệp đánh giá khách hàng '.repeat(60)}</p>
      <h2>FAQ — Câu hỏi thường gặp</h2>
      <h3>SEO local mất bao lâu?</h3><p>${'3-6 tháng cạnh tranh trung bình '.repeat(15)}</p>
      <h3>Cần ngân sách bao nhiêu?</h3><p>${'5 triệu/tháng cho doanh nghiệp nhỏ '.repeat(15)}</p>
      <h3>Có cần thuê agency không?</h3><p>${'Dưới 10 nhân sự có thể tự làm '.repeat(15)}</p>
      <h3>SEO local khác SEO truyền thống?</h3><p>${'Map Pack quan trọng hơn page rank '.repeat(15)}</p>
      <h3>Đo lường thế nào?</h3><p>${'Vị trí Map Pack click-through rate cuộc gọi '.repeat(15)}</p>
      <h2>Kết luận</h2>
      <p>SEO local là cuộc chơi dài hạn nhưng ROI cao. ${'Bắt đầu Google Business Profile ngay hôm nay '.repeat(20)}</p>
      <p><a href="/blog/seo-onpage">SEO Onpage guide</a> <a href="/blog/keyword">Keyword research</a>
      <a href="/dashboard">Dashboard</a> <a href="https://moz.com">Moz</a> <a href="https://search.google.com">Google</a></p>
      <img src="/img/1.jpg" alt="SEO local map pack" />
      <img src="/img/2.jpg" alt="Google Business Profile" />
      <img src="/img/3.jpg" alt="SEO local citation NAP" />
      <script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: 'SEO local' })}</script>
      <script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [] })}</script>
    </article>
  `,
  meta_title: 'SEO local cho doanh nghiệp nhỏ 2026 — chuẩn',
  meta_description:
    'SEO local cho doanh nghiệp nhỏ là chiến lược toàn diện 2026 giúp cửa hàng địa phương xuất hiện trên Google Maps. Tổng hợp lộ trình + FAQ chi tiết.',
  target_keyword: 'SEO local',
  secondary_keywords: [
    'Google Business Profile',
    'Map Pack',
    'NAP citation',
    'backlink',
    'rich snippet',
  ],
  intent: 'info',
  base_url: 'https://example.com',
};

const badArticle: AuditInput = {
  title: 'Bài viết generic',
  content: '<p>Nội dung quá ngắn không có gì cả.</p>',
  meta_title: '',
  meta_description: '',
  target_keyword: 'SEO local',
};

describe('KeywordDensityRule', () => {
  const rule = new KeywordDensityRule();
  it('100 when density is in the 1-2 % sweet spot', () => {
    // 2 occurrences in 150 words → 1.33 %.
    const html = '<p>SEO local lần 1. ' + 'và và và và và '.repeat(30) + 'SEO local lần 2.</p>';
    const r = rule.evaluate({ ...goodArticle, content: html });
    expect(r.metrics?.density).toBeGreaterThan(1);
    expect(r.metrics?.density).toBeLessThan(2);
    expect(r.score).toBe(100);
  });
  it('flags density > 3 % as spammy', () => {
    const html = '<p>' + 'SEO local '.repeat(10) + 'random text '.repeat(20) + '</p>';
    const r = rule.evaluate({ ...goodArticle, content: html });
    expect(r.metrics?.density).toBeGreaterThan(3);
    expect(r.score).toBe(30);
    expect(r.suggestions.length).toBeGreaterThan(0);
  });
  it('penalizes zero occurrences', () => {
    const r = rule.evaluate({ ...goodArticle, content: '<p>Nội dung không có từ khóa.</p>' });
    expect(r.score).toBe(30);
    expect(r.suggestions.length).toBeGreaterThan(0);
  });
});

describe('TitleKeywordRule', () => {
  const rule = new TitleKeywordRule();
  it('100 when keyword in first 50 chars', () => {
    expect(rule.evaluate(goodArticle).score).toBe(100);
  });
  it('60 when keyword in title but past char 50', () => {
    const r = rule.evaluate({
      ...goodArticle,
      title: 'A very long preamble blah blah ' + 'blah '.repeat(8) + 'SEO local',
    });
    expect(r.score).toBe(60);
  });
  it('30 when keyword missing entirely', () => {
    const r = rule.evaluate({ ...goodArticle, title: 'Hoàn toàn không liên quan' });
    expect(r.score).toBe(30);
  });
});

describe('MetaDescriptionRule', () => {
  const rule = new MetaDescriptionRule();
  it('100 when 140-160 chars + keyword', () => {
    expect(rule.evaluate(goodArticle).score).toBe(100);
  });
  it('partial when missing keyword', () => {
    const r = rule.evaluate({
      ...goodArticle,
      meta_description: 'A '.repeat(75),
    });
    expect(r.score).toBeLessThan(80);
  });
});

describe('H1UniqueRule', () => {
  const rule = new H1UniqueRule();
  it('100 for one H1 containing keyword', () => {
    expect(rule.evaluate(goodArticle).score).toBe(100);
  });
  it('penalizes multiple H1', () => {
    const r = rule.evaluate({
      ...goodArticle,
      content: '<h1>SEO local</h1><h1>SEO local another</h1><p>x</p>',
    });
    expect(r.score).toBe(50);
  });
  it('fails when no H1', () => {
    const r = rule.evaluate({ ...goodArticle, content: '<p>no headings</p>' });
    expect(r.score).toBe(10);
  });
});

describe('HeadingStructureRule', () => {
  const rule = new HeadingStructureRule();
  it('100 with 3+ H2 and clean structure', () => {
    expect(rule.evaluate(goodArticle).score).toBe(100);
  });
  it('penalizes fewer than 3 H2', () => {
    const r = rule.evaluate({
      ...goodArticle,
      content: '<h1>Title</h1><h2>One</h2><p>x</p>',
    });
    expect(r.score).toBeLessThan(80);
  });
});

describe('WordCountRule', () => {
  const rule = new WordCountRule();
  it('100 when word count meets intent target', () => {
    expect(rule.evaluate(goodArticle).score).toBe(100);
  });
  it('15 when severely short', () => {
    expect(rule.evaluate(badArticle).score).toBe(15);
  });
});

describe('LinksRule', () => {
  const rule = new LinksRule();
  it('100 with ≥3 internal + ≥2 external', () => {
    expect(rule.evaluate(goodArticle).score).toBe(100);
  });
  it('partial with only internal', () => {
    const r = rule.evaluate({
      ...goodArticle,
      content: '<p><a href="/a">a</a><a href="/b">b</a><a href="/c">c</a></p>',
    });
    expect(r.score).toBeLessThan(80);
  });
});

describe('ImagesAltRule', () => {
  const rule = new ImagesAltRule();
  it('100 with 3+ images all having alt + keyword alt', () => {
    expect(rule.evaluate(goodArticle).score).toBe(100);
  });
  it('10 when no images', () => {
    expect(rule.evaluate(badArticle).score).toBe(10);
  });
});

describe('SchemaMarkupRule', () => {
  const rule = new SchemaMarkupRule();
  it('100 with Article + FAQPage', () => {
    expect(rule.evaluate(goodArticle).score).toBe(100);
  });
  it('10 with no JSON-LD', () => {
    expect(rule.evaluate(badArticle).score).toBe(10);
  });
});

describe('LsiKeywordsRule', () => {
  const rule = new LsiKeywordsRule();
  it('100 with secondary keywords + repeated 4-char tokens', () => {
    const r = rule.evaluate(goodArticle);
    expect(r.score).toBe(100);
  });
});

describe('IntroHookRule', () => {
  const rule = new IntroHookRule();
  it('rewards keyword in first 150 words', () => {
    const r = rule.evaluate(goodArticle);
    expect(r.score).toBeGreaterThanOrEqual(70);
  });
  it('30 when keyword missing in intro', () => {
    const r = rule.evaluate({
      ...goodArticle,
      content: '<p>A bunch of generic intro text without the magic term.</p>',
    });
    expect(r.score).toBe(30);
  });
});

describe('FaqSectionRule', () => {
  const rule = new FaqSectionRule();
  it('100 when 5+ FAQ H3s detected under FAQ section', () => {
    expect(rule.evaluate(goodArticle).score).toBe(100);
  });
  it('25 when fewer than 3', () => {
    expect(rule.evaluate(badArticle).score).toBe(25);
  });
});

describe('rule weights sum to 1.0', () => {
  it('checks every weight in the registry adds up exactly', () => {
    const rules = [
      new KeywordDensityRule(),
      new TitleKeywordRule(),
      new MetaDescriptionRule(),
      new H1UniqueRule(),
      new HeadingStructureRule(),
      new WordCountRule(),
      new LinksRule(),
      new ImagesAltRule(),
      new SchemaMarkupRule(),
      new LsiKeywordsRule(),
      new IntroHookRule(),
      new FaqSectionRule(),
    ];
    const total = rules.reduce((sum, r) => sum + r.weight, 0);
    expect(Math.abs(total - 1)).toBeLessThan(0.005);
  });
});
