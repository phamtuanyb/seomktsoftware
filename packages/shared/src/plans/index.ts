/**
 * Plan tiers, quota limits, and rate limits — Section 10.
 * Mirrored in DB seed and in the QuotaService.
 */

export const PLAN_TIERS = ['trial', 'starter', 'pro', 'agency', 'lifetime'] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const SUBSCRIPTION_STATUSES = ['active', 'cancelled', 'expired', 'paused'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const USER_ROLES = ['user', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** `null` means unlimited. */
export type QuotaLimit = number | null;

export interface PlanQuota {
  articles_monthly: QuotaLimit;
  keywords_monthly: QuotaLimit;
  sites: QuotaLimit;
  brand_voices: QuotaLimit;
  images_monthly: QuotaLimit;
  api_keys: QuotaLimit;
}

/** Section 10 — Quota table. */
export const PLAN_QUOTAS: Record<PlanTier, PlanQuota> = {
  trial: {
    articles_monthly: 5,
    keywords_monthly: 100,
    sites: 1,
    brand_voices: 1,
    images_monthly: 20,
    api_keys: 0,
  },
  starter: {
    articles_monthly: 30,
    keywords_monthly: 200,
    sites: 1,
    brand_voices: 2,
    images_monthly: 100,
    api_keys: 0,
  },
  pro: {
    articles_monthly: 150,
    keywords_monthly: 1000,
    sites: 5,
    brand_voices: 5,
    images_monthly: 500,
    api_keys: 2,
  },
  agency: {
    articles_monthly: null,
    keywords_monthly: 5000,
    sites: 20,
    brand_voices: null,
    images_monthly: null,
    api_keys: 10,
  },
  lifetime: {
    articles_monthly: 150,
    keywords_monthly: 1000,
    sites: 5,
    brand_voices: 5,
    images_monthly: 500,
    api_keys: 2,
  },
};

export const QUOTA_RESOURCES = ['articles', 'keywords', 'sites', 'brand_voices', 'images'] as const;
export type QuotaResource = (typeof QUOTA_RESOURCES)[number];

export const QUOTA_PERIODS = ['monthly', 'lifetime'] as const;
export type QuotaPeriod = (typeof QUOTA_PERIODS)[number];
