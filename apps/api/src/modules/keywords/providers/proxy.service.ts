import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ProxyFetchOptions {
  /** When false, hit the URL directly without going through the proxy. */
  useProxy?: boolean;
  /** Render JavaScript (needed for SERPs that hydrate client-side). */
  renderJs?: boolean;
  /** Country code hint for geo-located results. */
  country?: string;
  /** Max attempts on transient failures. */
  retries?: number;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export interface ProxyFetchResult {
  status: number;
  body: string;
  fromProxy: boolean;
  attempt: number;
}

/**
 * Shared HTTP fetcher used by every keyword source provider.
 *
 * Routing:
 *   - PROXY_PROVIDER=scraperapi + SCRAPERAPI_KEY → forwards to scraperapi.com.
 *   - PROXY_PROVIDER=brightdata + BRIGHTDATA_USERNAME/PASSWORD → forwards
 *     via Bright Data Web Unlocker.
 *   - Otherwise (PROXY_PROVIDER=none or missing creds) → returns
 *     `{ status: 0, body: '' }` so callers fall back to stub fixtures.
 *
 * Retry: built-in exponential back-off (2s, 4s, 8s) for 429 / 5xx responses.
 * Rate-limited at the caller layer (suggestion service runs at most
 * 10 req/s/provider per Section 8 TN1 spec).
 */
@Injectable()
export class KeywordProxyService {
  private readonly logger = new Logger(KeywordProxyService.name);

  private readonly provider: 'scraperapi' | 'brightdata' | 'none';
  private readonly scraperApiKey: string;
  private readonly brightdataUser: string;
  private readonly brightdataPass: string;

  constructor(cfg: ConfigService) {
    this.provider = cfg.get<'scraperapi' | 'brightdata' | 'none'>('ai.proxyProvider') ?? 'none';
    this.scraperApiKey = cfg.get<string>('ai.scraperApiKey') ?? '';
    this.brightdataUser = cfg.get<string>('ai.brightdataUsername') ?? '';
    this.brightdataPass = cfg.get<string>('ai.brightdataPassword') ?? '';
  }

  isAvailable(): boolean {
    if (this.provider === 'scraperapi') return !!this.scraperApiKey;
    if (this.provider === 'brightdata') return !!(this.brightdataUser && this.brightdataPass);
    return false;
  }

  /** Attempts a real HTTP fetch through the configured proxy. Returns status=0 on giveup. */
  async fetch(targetUrl: string, opts: ProxyFetchOptions = {}): Promise<ProxyFetchResult> {
    const useProxy = opts.useProxy !== false && this.isAvailable();
    if (!useProxy) {
      return { status: 0, body: '', fromProxy: false, attempt: 0 };
    }
    const max = Math.max(1, opts.retries ?? 3);
    const timeout = opts.timeoutMs ?? 15_000;

    let attempt = 0;
    let lastErr: string | undefined;
    while (attempt < max) {
      attempt++;
      try {
        const requestUrl = this.buildProxiedUrl(targetUrl, opts);
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), timeout);
        const res = await fetch(requestUrl, {
          headers: this.buildHeaders(opts),
          signal: ctrl.signal,
        }).finally(() => clearTimeout(t));
        const body = await res.text();
        if (res.ok) {
          return { status: res.status, body, fromProxy: true, attempt };
        }
        // Backoff on 429 / 5xx, fail fast on 4xx.
        if (res.status === 429 || res.status >= 500) {
          lastErr = `proxy returned ${res.status}`;
          await this.sleep(2 ** attempt * 1000);
          continue;
        }
        return { status: res.status, body, fromProxy: true, attempt };
      } catch (err) {
        lastErr = (err as Error).message;
        await this.sleep(2 ** attempt * 1000);
      }
    }
    this.logger.warn(`Proxy fetch giveup after ${attempt} attempts: ${targetUrl} — ${lastErr}`);
    return { status: 0, body: '', fromProxy: true, attempt };
  }

  private buildProxiedUrl(targetUrl: string, opts: ProxyFetchOptions): string {
    if (this.provider === 'scraperapi') {
      const params = new URLSearchParams({
        api_key: this.scraperApiKey,
        url: targetUrl,
      });
      if (opts.renderJs) params.set('render', 'true');
      if (opts.country) params.set('country_code', opts.country.toLowerCase());
      return `https://api.scraperapi.com/?${params.toString()}`;
    }
    if (this.provider === 'brightdata') {
      // Bright Data Web Unlocker forwards to the target via Basic Auth.
      // Real wiring (zone selection + browser session) lands when creds arrive.
      return targetUrl;
    }
    return targetUrl;
  }

  private buildHeaders(opts: ProxyFetchOptions): Record<string, string> {
    const base: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/130.0 Safari/537.36',
      Accept: 'text/html,application/json,*/*;q=0.8',
    };
    if (this.provider === 'brightdata' && this.brightdataUser) {
      base['Authorization'] =
        'Basic ' + Buffer.from(`${this.brightdataUser}:${this.brightdataPass}`).toString('base64');
    }
    return { ...base, ...(opts.headers ?? {}) };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
