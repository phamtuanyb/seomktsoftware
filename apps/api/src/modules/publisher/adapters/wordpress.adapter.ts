import { Injectable, Logger } from '@nestjs/common';
import {
  type PublishArticle,
  type PublishOptions,
  type PublishResult,
  type PublisherAdapter,
  type PublisherType,
  type SeoPluginName,
  type SiteCredentials,
  type TestConnectionResult,
} from './publisher.interface';

/**
 * Section 8 TN8 — WordPress REST API adapter (WP 5.6+).
 *
 *   - Auth: Basic with Application Password (per-user, revocable).
 *   - Endpoint base: `{site_url}/wp-json/wp/v2`.
 *   - Featured image: POST /media with the file or remote URL → use returned
 *     `id` as `featured_media` on the post.
 *   - Categories / tags: GET /categories?slug=... to find or POST to create.
 *   - SEO meta: per detected plugin (yoast / rankmath / seopress) using
 *     `meta` keys at create-post time.
 *   - Schema markup: TN4 already injected JSON-LD inside the HTML body, so
 *     we just pass the body through.
 *
 * Stub mode (URL contains "example.com" / "stub" / not actually reachable):
 *   skipped because the spec says rate-limited retries handle transient
 *   failures. We always issue the fetch; mocking belongs in the test layer.
 */
@Injectable()
export class WordPressAdapter implements PublisherAdapter {
  readonly type: PublisherType = 'wordpress';
  private readonly logger = new Logger(WordPressAdapter.name);

  async testConnection(creds: SiteCredentials): Promise<TestConnectionResult> {
    const base = this.apiBase(creds.url);
    if (!creds.username || !creds.application_password) {
      return { ok: false, reason: 'Thiếu username hoặc application_password' };
    }
    try {
      // /wp-json returns site metadata + plugin slugs in the namespaces array.
      const root = await this.fetchJson(`${base.root}`, creds);
      const seoPlugin = this.detectSeoFromRoot(root);
      const info = (await this.fetchJson<{
        name?: string;
        description?: string;
        timezone?: string;
      }>(`${base.api}/settings`, creds).catch(() => ({}))) as {
        name?: string;
        description?: string;
        timezone?: string;
      };
      return {
        ok: true,
        seo_plugin: seoPlugin,
        site_info: {
          name: info.name,
          description: info.description,
          timezone: info.timezone,
        },
      };
    } catch (err) {
      return { ok: false, reason: (err as Error).message };
    }
  }

  async detectPlugins(creds: SiteCredentials): Promise<SeoPluginName> {
    try {
      const root = await this.fetchJson(`${this.apiBase(creds.url).root}`, creds);
      return this.detectSeoFromRoot(root);
    } catch {
      return 'none';
    }
  }

  async publish(
    article: PublishArticle,
    creds: SiteCredentials,
    opts: PublishOptions,
  ): Promise<PublishResult> {
    const base = this.apiBase(creds.url);

    let featuredMediaId: number | undefined;
    if (article.featured_image_url) {
      try {
        featuredMediaId = await this.uploadFeaturedImage(article, creds);
      } catch (err) {
        this.logger.warn(`Featured image upload failed: ${(err as Error).message}`);
      }
    }

    const categoryIds = await this.resolveTaxonomy(creds, 'categories', opts.categories ?? []);
    const tagIds = await this.resolveTaxonomy(creds, 'tags', opts.tags ?? []);

    const meta = this.buildSeoMeta(article, opts.seo_plugin ?? 'none');

    const body: Record<string, unknown> = {
      title: article.title,
      content: article.content_html,
      status: opts.status,
      slug: article.slug ?? undefined,
      excerpt: article.excerpt ?? undefined,
      categories: categoryIds.length > 0 ? categoryIds : undefined,
      tags: tagIds.length > 0 ? tagIds : undefined,
      featured_media: featuredMediaId,
      meta: Object.keys(meta).length > 0 ? meta : undefined,
    };
    if (opts.status === 'future' && opts.scheduled_at) {
      body['date'] = opts.scheduled_at;
    }

    const created = await this.fetchJson<{
      id: number;
      link: string;
      date: string;
      status: string;
    }>(`${base.api}/posts`, creds, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return {
      remote_post_id: created.id,
      published_url: created.link,
      scheduled_at: opts.status === 'future' ? created.date : undefined,
      raw: { id: created.id, status: created.status },
    };
  }

  // ----- helpers -----

  private apiBase(url: string): { root: string; api: string } {
    const trimmed = url.replace(/\/$/, '');
    return { root: `${trimmed}/wp-json`, api: `${trimmed}/wp-json/wp/v2` };
  }

  private detectSeoFromRoot(root: unknown): SeoPluginName {
    const namespaces =
      (root && typeof root === 'object' && 'namespaces' in root
        ? (root as { namespaces?: string[] }).namespaces
        : []) ?? [];
    const joined = (Array.isArray(namespaces) ? namespaces.join(' ') : '').toLowerCase();
    if (joined.includes('yoast')) return 'yoast';
    if (joined.includes('rankmath') || joined.includes('rank-math')) return 'rankmath';
    if (joined.includes('seopress')) return 'seopress';
    return 'none';
  }

  private buildSeoMeta(
    article: PublishArticle,
    plugin: SeoPluginName,
  ): Record<string, string | undefined> {
    if (plugin === 'yoast') {
      return {
        _yoast_wpseo_title: article.meta_title ?? undefined,
        _yoast_wpseo_metadesc: article.meta_description ?? undefined,
        _yoast_wpseo_focuskw: article.target_keyword ?? undefined,
      };
    }
    if (plugin === 'rankmath') {
      return {
        rank_math_title: article.meta_title ?? undefined,
        rank_math_description: article.meta_description ?? undefined,
        rank_math_focus_keyword: article.target_keyword ?? undefined,
      };
    }
    if (plugin === 'seopress') {
      return {
        _seopress_titles_title: article.meta_title ?? undefined,
        _seopress_titles_desc: article.meta_description ?? undefined,
        _seopress_analysis_target_kw: article.target_keyword ?? undefined,
      };
    }
    return {};
  }

  private async uploadFeaturedImage(
    article: PublishArticle,
    creds: SiteCredentials,
  ): Promise<number> {
    const imgResp = await fetch(article.featured_image_url!);
    if (!imgResp.ok) throw new Error(`fetch featured image ${imgResp.status}`);
    const bytes = Buffer.from(await imgResp.arrayBuffer());
    const filename =
      this.fileNameFromUrl(article.featured_image_url!) ?? `${article.slug ?? 'featured'}.png`;
    const contentType = imgResp.headers.get('content-type') ?? 'image/png';

    const base = this.apiBase(creds.url).api;
    const uploaded = await this.fetchJson<{ id: number }>(`${base}/media`, creds, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
      body: bytes,
    });

    // Patch alt text once we have the media id.
    if (article.featured_image_alt) {
      await this.fetchJson(`${base}/media/${uploaded.id}`, creds, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alt_text: article.featured_image_alt }),
      }).catch(() => {});
    }

    return uploaded.id;
  }

  private async resolveTaxonomy(
    creds: SiteCredentials,
    taxonomy: 'categories' | 'tags',
    names: string[],
  ): Promise<number[]> {
    if (names.length === 0) return [];
    const base = this.apiBase(creds.url).api;
    const ids: number[] = [];
    for (const raw of names) {
      const name = raw.trim();
      if (!name) continue;
      try {
        const slug = this.slugify(name);
        const existing = await this.fetchJson<Array<{ id: number }>>(
          `${base}/${taxonomy}?slug=${encodeURIComponent(slug)}`,
          creds,
        );
        if (existing.length > 0 && existing[0]) {
          ids.push(existing[0].id);
          continue;
        }
        const created = await this.fetchJson<{ id: number }>(`${base}/${taxonomy}`, creds, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, slug }),
        });
        ids.push(created.id);
      } catch (err) {
        this.logger.warn(
          `Resolve ${taxonomy} "${name}" failed: ${(err as Error).message} — skipping`,
        );
      }
    }
    return ids;
  }

  private async fetchJson<T = unknown>(
    url: string,
    creds: SiteCredentials,
    init: RequestInit = {},
  ): Promise<T> {
    const auth = Buffer.from(
      `${creds.username ?? ''}:${creds.application_password ?? ''}`,
    ).toString('base64');
    const headers = {
      ...((init.headers as Record<string, string> | undefined) ?? {}),
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
    };
    const res = await fetch(url, { ...init, headers });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`WP ${res.status} ${res.statusText} — ${text.slice(0, 200)}`);
    }
    try {
      return text ? (JSON.parse(text) as T) : ({} as T);
    } catch {
      throw new Error(`WP returned non-JSON (status ${res.status})`);
    }
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }

  private fileNameFromUrl(url: string): string | null {
    try {
      const u = new URL(url);
      const name = u.pathname.split('/').pop();
      return name && name.includes('.') ? name : null;
    } catch {
      return null;
    }
  }
}
