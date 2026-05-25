/**
 * Seed — Section 7. Creates 1 admin user with an `agency` subscription,
 * the canonical quota rows, and registers the official WordPress publisher plugin.
 * Idempotent: re-runs are safe (no duplicate rows).
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { uuidv7 } from 'uuidv7';
import { PLAN_QUOTAS, type PlanTier, type QuotaResource } from '@mkt-seo/shared';

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@mkt-seo.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';
const ADMIN_PLAN: PlanTier = 'agency';

/**
 * Maps PlanQuota field → (DB resource, period). api_keys is tracked by
 * counting rows in api_keys table, not via a quotas row — so it's omitted.
 */
const QUOTA_FIELD_MAP: Array<{
  field: 'articles_monthly' | 'keywords_monthly' | 'sites' | 'brand_voices' | 'images_monthly';
  resource: QuotaResource;
  period: 'monthly' | 'lifetime';
}> = [
  { field: 'articles_monthly', resource: 'articles', period: 'monthly' },
  { field: 'keywords_monthly', resource: 'keywords', period: 'monthly' },
  { field: 'sites', resource: 'sites', period: 'lifetime' },
  { field: 'brand_voices', resource: 'brand_voices', period: 'lifetime' },
  { field: 'images_monthly', resource: 'images', period: 'monthly' },
];

async function main(): Promise<void> {
  console.warn(`[seed] Using admin email: ${ADMIN_EMAIL}`);

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const now = new Date();
  const monthFromNow = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash },
    create: {
      id: uuidv7(),
      email: ADMIN_EMAIL,
      passwordHash,
      name: 'MKT SEO Admin',
      role: 'admin',
      emailVerifiedAt: now,
    },
  });

  // Subscription — keyed by (userId, plan, status='active'); collapse duplicates.
  const existingActiveSub = await prisma.subscription.findFirst({
    where: { userId: admin.id, plan: ADMIN_PLAN, status: 'active' },
  });
  if (!existingActiveSub) {
    await prisma.subscription.create({
      data: {
        id: uuidv7(),
        userId: admin.id,
        plan: ADMIN_PLAN,
        status: 'active',
        startedAt: now,
      },
    });
  }

  const planQuota = PLAN_QUOTAS[ADMIN_PLAN];

  for (const { field, resource, period } of QUOTA_FIELD_MAP) {
    const limit = planQuota[field];
    const limitValue = limit ?? -1; // -1 represents "unlimited"
    const resetAt = period === 'monthly' ? monthFromNow : null;
    await prisma.quota.upsert({
      where: {
        userId_resource_period: { userId: admin.id, resource, period },
      },
      update: { limitValue, resetAt },
      create: {
        id: uuidv7(),
        userId: admin.id,
        resource,
        period,
        used: 0,
        limitValue,
        resetAt,
      },
    });
  }

  await prisma.plugin.upsert({
    where: { slug: 'wordpress-publisher' },
    update: {},
    create: {
      id: uuidv7(),
      slug: 'wordpress-publisher',
      name: 'WordPress Publisher',
      version: '1.0.0',
      description: 'Official WordPress publisher adapter (TN8).',
      author: 'MKT SEO',
      isOfficial: true,
      isEnabled: true,
    },
  });

  console.warn(`[seed] Done. Admin id=${admin.id}`);
  console.warn(`[seed] Login with: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error('[seed] failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
