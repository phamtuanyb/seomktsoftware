/**
 * Section 8 TN8 + Section 12 — Adapter pattern for CMS publishers.
 * MVP ships WordPress; Phase 2 plugs Shopify, Haravan, Sapo, Webflow into
 * the same contract without touching core PublisherService.
 */

export type PublisherType = 'wordpress' | 'shopify' | 'haravan' | 'sapo' | 'webflow';
export type PublishStatus = 'draft' | 'publish' | 'future';
export type SeoPluginName = 'yoast' | 'rankmath' | 'seopress' | 'none';

export interface SiteCredentials {
  url: string;
  username?: string;
  application_password?: string;
  /** Free-form bag for Shopify access tokens etc. */
  extra?: Record<string, unknown>;
}

export interface PublishArticle {
  title: string;
  /** HTML body (with schema markup already injected by TN4). */
  content_html: string;
  excerpt?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  target_keyword?: string | null;
  slug?: string | null;
  featured_image_url?: string | null;
  featured_image_alt?: string | null;
}

export interface PublishOptions {
  status: PublishStatus;
  /** Required when status='future'. ISO-8601 timestamp in the user's timezone. */
  scheduled_at?: string;
  categories?: string[];
  tags?: string[];
  seo_plugin?: SeoPluginName;
}

export interface PublishResult {
  /** Provider-side post id (WP integer, Shopify gid, etc.). */
  remote_post_id?: number | string;
  published_url?: string;
  /** Set when the adapter scheduled rather than published immediately. */
  scheduled_at?: string;
  /** Provider-side raw response for debugging. */
  raw?: Record<string, unknown>;
}

export interface TestConnectionResult {
  ok: boolean;
  reason?: string;
  /** Optional plugin detection — Yoast / RankMath / SEOPress for WP. */
  seo_plugin?: SeoPluginName;
  site_info?: {
    name?: string;
    description?: string;
    timezone?: string;
  };
}

export interface PublisherAdapter {
  readonly type: PublisherType;
  testConnection(credentials: SiteCredentials): Promise<TestConnectionResult>;
  detectPlugins?(credentials: SiteCredentials): Promise<SeoPluginName>;
  publish(
    article: PublishArticle,
    credentials: SiteCredentials,
    options: PublishOptions,
  ): Promise<PublishResult>;
}

export const PUBLISHER_ADAPTERS = Symbol('PUBLISHER_ADAPTERS');
