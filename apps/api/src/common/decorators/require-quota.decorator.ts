import { SetMetadata } from '@nestjs/common';
import type { QuotaResource } from '@mkt-seo/shared';

export const REQUIRE_QUOTA_KEY = 'requireQuota';

export interface RequireQuotaConfig {
  resource: QuotaResource;
  amount: number;
}

/** Section 9 + 10 — guarantees QuotaGuard rejects the request if quota is exhausted. */
export const RequireQuota = (resource: QuotaResource, amount = 1) =>
  SetMetadata(REQUIRE_QUOTA_KEY, { resource, amount } satisfies RequireQuotaConfig);
