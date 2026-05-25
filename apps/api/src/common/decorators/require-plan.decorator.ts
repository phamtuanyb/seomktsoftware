import { SetMetadata } from '@nestjs/common';
import type { PlanTier } from '@mkt-seo/shared';

export const REQUIRE_PLAN_KEY = 'requirePlan';
/** Section 9 — restrict endpoint to users on the listed plan tiers. */
export const RequirePlan = (...plans: PlanTier[]) => SetMetadata(REQUIRE_PLAN_KEY, plans);
