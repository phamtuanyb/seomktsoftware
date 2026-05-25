import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';
import { RedisService } from '../../../common/services/redis.service';

export interface SerpHeadings {
  /** First H1 found on the page, or the document title if none. */
  h1: string;
  /** Section headings (max 10). */
  h2: string[];
  /** Subsection headings (max 15). */
  h3: string[];
}

export interface SerpResult {
  url: string;
  title: string;
  snippet: string;
  /** Plain-text headings extracted via cheerio. */
  headings: SerpHeadings;
  /** Approximate word count of the body content. */
  wordCount: number;
}

export interface SerpFetchOptions {
  keyword: string;
  language?: string;
  country?: string;
  limit?: number;
}

/**
 * Section 8 TN3 — crawl top SERP and extract heading structure. We respect
 * the spec's 24h cache TTL and gracefully fall back to fixtures when no proxy
 * provider is configured (PROXY_PROVIDER=none / missing keys).
 *
 * Production flow:
 *   1. Hit Google SERP via ScraperAPI / Bright Data → parse the result page
 *      with cheerio (selectors stable enough for top-5).
 *   2. For each result URL, fetch the raw HTML via the same proxy and pull
 *      h1/h2/h3 plus a body word count.
 *   3. Cache the aggregated SerpResult[] under sha256(keyword|lang|country).
 *
 * Stub flow (default in dev):
 *   - Returns 5 plausible result objects derived from the keyword. Lets TN3
 *     end-to-end test pass without burning proxy credits.
 */
@Injectable()
export class SerpService {
  private readonly logger = new Logger(SerpService.name);
  private static readonly CACHE_PREFIX = 'serp:';
  private static readonly CACHE_TTL_SECONDS = 24 * 60 * 60; // 24h per spec

  private readonly proxyProvider: 'scraperapi' | 'brightdata' | 'none';
  private readonly scraperApiKey: string;
  private readonly brightdataAuth: string;

  constructor(
    private readonly redis: RedisService,
    cfg: ConfigService,
  ) {
    this.proxyProvider =
      cfg.get<'scraperapi' | 'brightdata' | 'none'>('ai.proxyProvider') ?? 'none';
    this.scraperApiKey = cfg.get<string>('ai.scraperApiKey') ?? '';
    const bdUser = cfg.get<string>('ai.brightdataUsername') ?? '';
    const bdPass = cfg.get<string>('ai.brightdataPassword') ?? '';
    this.brightdataAuth = bdUser && bdPass ? `${bdUser}:${bdPass}` : '';

    if (this.isStubMode()) {
      this.logger.warn(
        `SerpService running in STUB mode — PROXY_PROVIDER=${this.proxyProvider}, scraperapi=${!!this.scraperApiKey}, brightdata=${!!this.brightdataAuth}`,
      );
    }
  }

  isStubMode(): boolean {
    if (this.proxyProvider === 'scraperapi') return !this.scraperApiKey;
    if (this.proxyProvider === 'brightdata') return !this.brightdataAuth;
    return true;
  }

  async topResults(opts: SerpFetchOptions): Promise<SerpResult[]> {
    const limit = opts.limit ?? 5;
    const cacheKey = this.cacheKey(opts);

    // 1) Cache check.
    const cached = await this.redis.getClient().get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as SerpResult[];
        return parsed.slice(0, limit);
      } catch {
        this.logger.warn(`Corrupt SERP cache for ${cacheKey} — refetching`);
      }
    }

    // 2) Fetch (or stub).
    let results: SerpResult[];
    if (this.isStubMode()) {
      results = this.stubResults(opts.keyword, limit);
    } else {
      try {
        results = await this.fetchLive(opts);
      } catch (err) {
        this.logger.error(`SERP fetch failed for "${opts.keyword}": ${(err as Error).message}`);
        results = this.stubResults(opts.keyword, limit);
      }
    }

    // 3) Cache 24h.
    await this.redis
      .getClient()
      .set(cacheKey, JSON.stringify(results), 'EX', SerpService.CACHE_TTL_SECONDS);

    return results.slice(0, limit);
  }

  /** Exposed for unit tests — pure HTML → headings extraction via cheerio. */
  extractHeadings(html: string): SerpHeadings {
    const $ = cheerio.load(html);
    const text = (el: ReturnType<typeof $>) => el.first().text().replace(/\s+/g, ' ').trim();
    const collect = (selector: string, max: number): string[] => {
      const out: string[] = [];
      $(selector).each((_, el) => {
        if (out.length >= max) return false;
        const t = $(el).text().replace(/\s+/g, ' ').trim();
        if (t) out.push(t);
        return undefined;
      });
      return out;
    };
    return {
      h1: text($('h1')) || text($('title')) || '',
      h2: collect('h2', 10),
      h3: collect('h3', 15),
    };
  }

  /** Strips boilerplate then counts words (loose — for ranking, not auditing). */
  approximateWordCount(html: string): number {
    const $ = cheerio.load(html);
    $('script, style, nav, header, footer, aside').remove();
    const text = $('body').text().replace(/\s+/g, ' ').trim();
    return text ? text.split(/\s+/).length : 0;
  }

  // ----- live fetch path (still skeleton — wired when proxy creds land) -----

  private async fetchLive(opts: SerpFetchOptions): Promise<SerpResult[]> {
    // Sprint 3 (TN1) brings the full proxy adapter. For now we log + stub.
    this.logger.warn(
      `Live SERP fetch not implemented for proxy=${this.proxyProvider}; using stub for "${opts.keyword}"`,
    );
    return this.stubResults(opts.keyword, opts.limit ?? 5);
  }

  // ----- stub fixtures -----

  private stubResults(keyword: string, limit: number): SerpResult[] {
    const templates: Array<(k: string) => SerpResult> = [
      (k) => ({
        url: `https://stub-example.local/${slug(k)}-la-gi`,
        title: `${k} là gì? Tổng quan toàn diện 2026`,
        snippet: `Tìm hiểu ${k} là gì, lợi ích và cách triển khai. Cập nhật mới nhất 2026.`,
        headings: {
          h1: `${k} là gì? Tổng quan toàn diện`,
          h2: [
            `${k} là gì?`,
            `Lịch sử phát triển của ${k}`,
            `Lợi ích của ${k}`,
            'Ứng dụng thực tế',
            'Sai lầm cần tránh',
            'Câu hỏi thường gặp',
          ],
          h3: [
            'Định nghĩa cơ bản',
            'So sánh với thuật ngữ liên quan',
            'Lợi ích cá nhân',
            'Lợi ích doanh nghiệp',
          ],
        },
        wordCount: 2400,
      }),
      (k) => ({
        url: `https://stub-example.local/huong-dan-${slug(k)}`,
        title: `Hướng dẫn ${k} từ A-Z cho người mới bắt đầu`,
        snippet: `Lộ trình học ${k} hiệu quả, từng bước rõ ràng kèm ví dụ thực tế.`,
        headings: {
          h1: `Hướng dẫn ${k} cho người mới bắt đầu`,
          h2: [
            'Tổng quan hành trình',
            'Bước 1: Chuẩn bị nền tảng',
            'Bước 2: Thực hành cơ bản',
            'Bước 3: Nâng cao',
            'Bước 4: Đo lường kết quả',
          ],
          h3: [
            'Tài liệu khuyến nghị',
            'Bài tập thực hành',
            'Công cụ hỗ trợ',
            'Cách tránh nản lòng',
          ],
        },
        wordCount: 2800,
      }),
      (k) => ({
        url: `https://stub-example.local/top-cong-cu-${slug(k)}`,
        title: `Top 10 công cụ ${k} tốt nhất 2026 (đánh giá chi tiết)`,
        snippet: `Đánh giá khách quan 10 công cụ ${k} phổ biến nhất kèm bảng so sánh.`,
        headings: {
          h1: `Top 10 công cụ ${k} tốt nhất 2026`,
          h2: [
            'Tiêu chí đánh giá',
            '#1 — Công cụ A',
            '#2 — Công cụ B',
            '#3 — Công cụ C',
            'Bảng so sánh chi tiết',
            'Cách chọn công cụ phù hợp',
          ],
          h3: ['Ưu điểm', 'Nhược điểm', 'Giá cả', 'Đối tượng phù hợp'],
        },
        wordCount: 3200,
      }),
      (k) => ({
        url: `https://stub-example.local/${slug(k)}-cho-doanh-nghiep`,
        title: `${k} cho doanh nghiệp: Chiến lược triển khai 2026`,
        snippet: `Cách doanh nghiệp ứng dụng ${k} để tối ưu chi phí và tăng trưởng.`,
        headings: {
          h1: `${k} cho doanh nghiệp: Hướng dẫn chiến lược`,
          h2: [
            'Tại sao doanh nghiệp cần',
            'ROI thực tế',
            'Lộ trình triển khai',
            'Case study thành công',
            'Rủi ro và cách giảm thiểu',
          ],
          h3: ['Ngành B2B', 'Ngành B2C', 'SME', 'Doanh nghiệp lớn'],
        },
        wordCount: 2600,
      }),
      (k) => ({
        url: `https://stub-example.local/sai-lam-${slug(k)}`,
        title: `7 sai lầm phổ biến khi triển khai ${k}`,
        snippet: `Tránh 7 sai lầm này nếu bạn không muốn lãng phí thời gian và tiền bạc với ${k}.`,
        headings: {
          h1: `7 sai lầm phổ biến khi triển khai ${k}`,
          h2: [
            'Sai lầm #1: Thiếu chiến lược',
            'Sai lầm #2: Bỏ qua đo lường',
            'Sai lầm #3: Đầu tư sai trọng tâm',
            'Sai lầm #4: Đào tạo không đủ',
            'Sai lầm #5: Bỏ cuộc quá sớm',
            'Cách phòng tránh',
          ],
          h3: ['Dấu hiệu cảnh báo', 'Hành động khắc phục'],
        },
        wordCount: 2100,
      }),
    ];

    return templates.slice(0, limit).map((fn) => fn(keyword));
  }

  private cacheKey(opts: SerpFetchOptions): string {
    const raw = `${opts.keyword.trim().toLowerCase()}|${opts.language ?? 'vi'}|${opts.country ?? 'VN'}|${opts.limit ?? 5}`;
    const hash = createHash('sha256').update(raw).digest('hex').slice(0, 32);
    return SerpService.CACHE_PREFIX + hash;
  }
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
