import { type INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { uuidv7 } from 'uuidv7';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/services/prisma.service';

class NoopGuard {
  canActivate(): boolean {
    return true;
  }
}

/**
 * Sprint 12 — Admin endpoints. RBAC enforced by RolesGuard; mutations
 * write audit_logs. JWT minted directly to skip the /auth/login throttler.
 */
describe('Admin (integration) — Sprint 12', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let adminId: string;
  let targetId: string;
  let regularId: string;
  let adminToken: string;
  let regularToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(ThrottlerGuard)
      .useClass(NoopGuard)
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.setGlobalPrefix('api', { exclude: ['health', 'version', 'docs', 'docs-json'] });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
  });

  beforeEach(async () => {
    await prisma.truncateAll();

    const pw = await bcrypt.hash('AdminPass@1', 4);
    adminId = uuidv7();
    targetId = uuidv7();
    regularId = uuidv7();
    await prisma.user.createMany({
      data: [
        {
          id: adminId,
          email: `admin-${Date.now()}@test.local`,
          passwordHash: pw,
          role: 'admin',
          emailVerifiedAt: new Date(),
        },
        {
          id: targetId,
          email: `target-${Date.now()}@test.local`,
          passwordHash: pw,
          role: 'user',
        },
        {
          id: regularId,
          email: `reg-${Date.now()}@test.local`,
          passwordHash: pw,
          role: 'user',
        },
      ],
    });

    // Seed an active trial sub on target so the plan resolves predictably.
    await prisma.subscription.create({
      data: {
        id: uuidv7(),
        userId: targetId,
        plan: 'trial',
        status: 'active',
        startedAt: new Date(),
      },
    });

    adminToken = jwtService.sign({
      sub: adminId,
      email: `admin-${Date.now()}@test.local`,
      plan: 'agency',
      role: 'admin',
      jti: uuidv7(),
    });
    regularToken = jwtService.sign({
      sub: regularId,
      email: `reg-${Date.now()}@test.local`,
      plan: 'trial',
      role: 'user',
      jti: uuidv7(),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ----- RBAC -----

  describe('RBAC', () => {
    it('blocks non-admin from /admin/stats (403)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${regularToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('RESOURCE_FORBIDDEN');
    });

    it('blocks unauthenticated from /admin/users (401)', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/admin/users');
      expect(res.status).toBe(401);
    });

    it('allows admin to /admin/stats (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.users.total).toBeGreaterThanOrEqual(3);
    });
  });

  // ----- list users -----

  describe('GET /admin/users', () => {
    it('lists users with stats + pagination', async () => {
      // Seed extra users so pagination triggers.
      const pw = await bcrypt.hash('x', 4);
      for (let i = 0; i < 25; i += 1) {
        await prisma.user.create({
          data: {
            id: uuidv7(),
            email: `bulk-${i}-${Date.now()}@test.local`,
            passwordHash: pw,
            role: 'user',
          },
        });
        // Tiny gap so createdAt order is stable.
        await new Promise((r) => setTimeout(r, 1));
      }

      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/users?limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.data.items).toHaveLength(10);
      expect(res.body.data.has_more).toBe(true);
      expect(res.body.data.cursor).toBeTruthy();
      // Every row carries stats.
      for (const u of res.body.data.items as Array<{ stats: object }>) {
        expect(u.stats).toBeDefined();
      }
    });

    it('filters by role', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/users?role=admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      for (const u of res.body.data.items as Array<{ role: string }>) {
        expect(u.role).toBe('admin');
      }
    });

    it('filters by q substring on email', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/users?q=target-')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].id).toBe(targetId);
    });
  });

  // ----- user detail -----

  describe('GET /admin/users/:id', () => {
    it('returns rich profile + subscriptions + quotas + audit logs', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/users/${targetId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.data.id).toBe(targetId);
      expect(res.body.data.subscriptions[0].plan).toBe('trial');
      expect(Array.isArray(res.body.data.recent_audit_logs)).toBe(true);
    });

    it('404 for missing user', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/users/${uuidv7()}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  // ----- mutations -----

  describe('PATCH /admin/users/:id', () => {
    it('promotes a user to admin + writes audit log', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${targetId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'admin' })
        .expect(200);
      expect(res.body.data.role).toBe('admin');

      const log = await prisma.auditLog.findFirst({
        where: { userId: adminId, action: 'admin.user.update', resourceId: targetId },
      });
      expect(log).toBeTruthy();
      const metadata = log!.metadataJson as { changes?: { role?: string } };
      expect(metadata.changes?.role).toBe('admin');
    });

    it("won't let admin demote themselves", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${adminId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'user' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('force email_verified + soft_delete', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${targetId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email_verified: true, soft_delete: true })
        .expect(200);
      expect(res.body.data.email_verified).toBe(true);
      expect(res.body.data.deleted_at).not.toBeNull();
    });
  });

  describe('POST /admin/users/:id/subscription', () => {
    it('overrides plan + cancels previous active sub + writes audit log', async () => {
      const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/users/${targetId}/subscription`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ plan: 'agency', expires_at: future, metadata: { reason: 'comp' } })
        .expect(201);

      expect(res.body.data.plan).toBe('agency');
      expect(res.body.data.subscriptions.length).toBe(2);
      const active = res.body.data.subscriptions.filter(
        (s: { status: string }) => s.status === 'active',
      );
      expect(active).toHaveLength(1);
      expect(active[0].plan).toBe('agency');

      const log = await prisma.auditLog.findFirst({
        where: { userId: adminId, action: 'admin.subscription.override', resourceId: targetId },
      });
      expect(log).toBeTruthy();
      const metadata = log!.metadataJson as { plan?: string };
      expect(metadata.plan).toBe('agency');
    });
  });

  describe('POST /admin/users/:id/quotas', () => {
    it('upserts quota row + writes audit log', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/users/${targetId}/quotas`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ resource: 'articles', period: 'monthly', limit_value: 500 })
        .expect(201);

      const quota = res.body.data.quotas.find(
        (q: { resource: string }) => q.resource === 'articles',
      );
      expect(quota.limit_value).toBe(500);

      const log = await prisma.auditLog.findFirst({
        where: { userId: adminId, action: 'admin.quota.override', resourceId: targetId },
      });
      expect(log).toBeTruthy();
    });

    it('reset_used zeros the counter', async () => {
      // Seed an existing quota with usage.
      await prisma.quota.create({
        data: {
          id: uuidv7(),
          userId: targetId,
          resource: 'images',
          period: 'monthly',
          limitValue: 100,
          used: 42,
        },
      });
      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/users/${targetId}/quotas`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ resource: 'images', period: 'monthly', limit_value: 200, reset_used: true })
        .expect(201);
      const q = res.body.data.quotas.find((x: { resource: string }) => x.resource === 'images');
      expect(q.limit_value).toBe(200);
      expect(q.used).toBe(0);
    });
  });

  // ----- stats -----

  describe('GET /admin/stats', () => {
    it('returns dashboard counts', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.data.users.total).toBeGreaterThanOrEqual(3);
      expect(typeof res.body.data.plans).toBe('object');
      expect(res.body.data.articles.total).toBe(0);
      expect(res.body.data.publish_jobs.total).toBe(0);
    });
  });
});
