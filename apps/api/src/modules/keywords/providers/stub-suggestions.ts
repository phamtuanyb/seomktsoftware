/**
 * Canned suggestion templates per source. Used in dev when no proxy is
 * configured AND when the live fetch fails. Templates intentionally overlap
 * across sources so the suggestion service's dedupe logic gets exercised.
 */

const QUALIFIERS_VI = [
  'là gì',
  'cho người mới bắt đầu',
  'cho doanh nghiệp nhỏ',
  '2026',
  'miễn phí',
  'tốt nhất',
  'cách làm',
  'hướng dẫn',
  'review',
  'so sánh',
  'top 10',
  'giá rẻ',
  'chuyên nghiệp',
  'tự học',
  'online',
  'cơ bản',
  'nâng cao',
  'thực chiến',
  'từ a-z',
  'mới nhất',
];

const PREFIXES_VI = [
  'cách',
  'học',
  'làm',
  'mua',
  'bán',
  'làm sao để',
  'tại sao',
  'khi nào',
  'ai cần',
];

const PAA_PATTERNS = [
  '{seed} là gì?',
  'Làm sao để bắt đầu với {seed}?',
  '{seed} có miễn phí không?',
  'Học {seed} mất bao lâu?',
  'Có cần kỹ năng kỹ thuật để {seed} không?',
  '{seed} có phù hợp với doanh nghiệp nhỏ không?',
  'Chi phí {seed} là bao nhiêu?',
  'Sự khác biệt giữa {seed} và SEO truyền thống?',
  'Công cụ {seed} nào tốt nhất 2026?',
  '{seed} mang lại ROI bao lâu?',
  'Có nên tự làm {seed} hay thuê agency?',
  '{seed} cho startup nên triển khai ra sao?',
];

export function stubGoogleSuggestions(seed: string, limit: number): string[] {
  const s = seed.trim();
  const items = new Set<string>();
  for (const q of QUALIFIERS_VI) items.add(`${s} ${q}`);
  for (const p of PREFIXES_VI) items.add(`${p} ${s}`);
  return [...items].slice(0, limit);
}

export function stubBingSuggestions(seed: string, limit: number): string[] {
  const s = seed.trim();
  const items = new Set<string>();
  // Bing skews more towards full-question phrasing and slightly different qualifiers.
  for (const q of QUALIFIERS_VI.slice(2, 16)) items.add(`${s} ${q}`);
  items.add(`${s} là gì`);
  items.add(`${s} có ích gì`);
  items.add(`${s} là viết tắt của`);
  items.add(`${s} dành cho ai`);
  items.add(`${s} nghĩa là`);
  items.add(`top 5 ${s}`);
  items.add(`công cụ ${s}`);
  return [...items].slice(0, limit);
}

export function stubPaaSuggestions(seed: string, limit: number): string[] {
  const s = seed.trim();
  return PAA_PATTERNS.map((p) => p.replace('{seed}', s)).slice(0, limit);
}
