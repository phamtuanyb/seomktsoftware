import { type INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { uuidv7 } from 'uuidv7';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/services/prisma.service';
import { REDIS_CLIENT } from '../../src/common/services/redis.service';
import type { Redis as RedisClient } from 'ioredis';

class NoopGuard {
  canActivate(): boolean {
    return true;
  }
}

/**
 * Section 8 TN1 + TN2 + projects CRUD + export integration tests.
 * Real Postgres + Redis; LLM + proxy + DataForSEO all run in stub mode
 * via placeholder env vars.
 */
describe('Keywords (integration) — TN1 + TN2 + projects', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisClient;
  let userId: string;
  let accessToken: string;

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
    redis = app.get<RedisClient>(REDIS_CLIENT);
  });

  beforeEach(async () => {
    await prisma.truncateAll();
    // Flush per-test Redis state so suggestion + analysis caches don't leak.
    await redis.flushdb();

    userId = uuidv7();
    const passwordHash = await bcrypt.hash('TestPass@1', 4);
    await prisma.user.create({
      data: {
        id: userId,
        email: `int-kw-${Date.now()}@test.local`,
        passwordHash,
        role: 'user',
      },
    });
    await prisma.subscription.create({
      data: {
        id: uuidv7(),
        userId,
        plan: 'agency',
        status: 'active',
        startedAt: new Date(),
      },
    });
    await prisma.quota.create({
      data: {
        id: uuidv7(),
        userId,
        resource: 'keywords',
        period: 'monthly',
        limitValue: -1,
        used: 0,
      },
    });

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: (await prisma.user.findUnique({ where: { id: userId } }))!.email,
        password: 'TestPass@1',
      });
    expect(res.status).toBe(200);
    accessToken = res.body.data.tokens.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  // ---- TN1 ----

  describe('POST /keywords/suggest (TN1)', () => {
    it('returns deduped keywords with per-source stats', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/keywords/suggest')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ seed: 'SEO', limit: 50 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.keywords.length).toBeGreaterThan(5);
      expect(res.body.data.stats.cached).toBe(false);
      expect(res.body.data.stats.by_source.google_suggest.is_stub).toBe(true);
      expect(res.body.data.stats.total_returned).toBe(res.body.data.keywords.length);
    });

    it('returns cached result on the second call', async () => {
      const first = await request(app.getHttpServer())
        .post('/api/v1/keywords/suggest')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ seed: 'cache test kw', limit: 30 });
      expect(first.body.data.stats.cached).toBe(false);

      const second = await request(app.getHttpServer())
        .post('/api/v1/keywords/suggest')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ seed: 'cache test kw', limit: 30 });
      expect(second.body.data.stats.cached).toBe(true);
      expect(second.body.data.keywords.length).toBe(first.body.data.keywords.length);
    });

    it('rejects empty seed', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/keywords/suggest')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ seed: '' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ---- TN2 ----

  describe('POST /keywords/analyze (TN2)', () => {
    it('returns volume + KD + intent per keyword', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/keywords/analyze')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          keywords: ['SEO là gì', 'mua iphone 15', 'so sánh laptop'],
          analyze_intent: true,
        });
      expect(res.status).toBe(201);
      expect(res.body.data.rows).toHaveLength(3);
      for (const row of res.body.data.rows) {
        expect(row).toHaveProperty('keyword');
        expect(row).toHaveProperty('volume');
        expect(row.keyword_difficulty).toBeGreaterThanOrEqual(0);
        expect(row.keyword_difficulty).toBeLessThanOrEqual(100);
        expect(row.intent).not.toBeNull();
        expect(['ai', 'rule']).toContain(row.intent_method);
      }
      // Rule-based intent should at least catch the transactional one in stub mode.
      const tx = res.body.data.rows.find((r: { keyword: string }) => r.keyword === 'mua iphone 15');
      expect(tx.intent).toBe('transactional');
    });

    it('returns cached rows on the second call', async () => {
      const kws = ['cache kw alpha', 'cache kw beta'];
      const first = await request(app.getHttpServer())
        .post('/api/v1/keywords/analyze')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ keywords: kws });
      expect(first.body.data.stats.cached).toBe(0);

      const second = await request(app.getHttpServer())
        .post('/api/v1/keywords/analyze')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ keywords: kws });
      expect(second.body.data.stats.cached).toBe(2);
    });

    it('skips intent classification when analyze_intent=false', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/keywords/analyze')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ keywords: ['no-intent test'], analyze_intent: false });
      expect(res.body.data.stats.intent_analyzed).toBe(false);
      expect(res.body.data.rows[0].intent).toBeNull();
    });
  });

  // ---- Projects ----

  describe('Projects CRUD + bulk add + export', () => {
    it('creates, lists, adds keywords (deduped), and removes keywords', async () => {
      const create = await request(app.getHttpServer())
        .post('/api/v1/keywords/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Q2 Plan', seed_keyword: 'SEO' });
      expect(create.status).toBe(201);
      const projectId = create.body.data.id;

      const list = await request(app.getHttpServer())
        .get('/api/v1/keywords/projects')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(list.body.data.length).toBe(1);

      const add = await request(app.getHttpServer())
        .post(`/api/v1/keywords/projects/${projectId}/keywords`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ keywords: ['seo cơ bản', 'SEO Cơ Bản', 'seo nâng cao'] });
      expect(add.body.data.inserted).toBe(2); // case-insensitive dedupe collapses 2 → 1
      expect(add.body.data.skipped).toBe(1);

      const projectKws = await request(app.getHttpServer())
        .get(`/api/v1/keywords/projects/${projectId}/keywords`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(projectKws.body.data).toHaveLength(2);

      const kwId = projectKws.body.data[0].id;
      const removed = await request(app.getHttpServer())
        .delete(`/api/v1/keywords/projects/${projectId}/keywords/${kwId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(removed.status).toBe(200);

      const after = await request(app.getHttpServer())
        .get(`/api/v1/keywords/projects/${projectId}/keywords`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(after.body.data).toHaveLength(1);
    });

    it('exports the project as CSV with UTF-8 BOM', async () => {
      const create = await request(app.getHttpServer())
        .post('/api/v1/keywords/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Export test' });
      const projectId = create.body.data.id;

      await request(app.getHttpServer())
        .post(`/api/v1/keywords/projects/${projectId}/keywords`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ keywords: ['keyword 1', 'keyword 2'] });

      const csv = await request(app.getHttpServer())
        .get(`/api/v1/keywords/projects/${projectId}/export?format=csv`)
        .set('Authorization', `Bearer ${accessToken}`)
        .buffer(true)
        .parse((res, cb) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => cb(null, Buffer.concat(chunks)));
        });
      expect(csv.status).toBe(200);
      expect(csv.headers['content-type']).toContain('text/csv');
      const buf = csv.body as Buffer;
      // UTF-8 BOM
      expect(buf[0]).toBe(0xef);
      expect(buf[1]).toBe(0xbb);
      expect(buf[2]).toBe(0xbf);
      expect(buf.toString('utf8')).toContain('keyword 1');
    });

    it('exports as Excel (XLSX magic header starts with PK)', async () => {
      const create = await request(app.getHttpServer())
        .post('/api/v1/keywords/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Excel test' });
      const projectId = create.body.data.id;
      await request(app.getHttpServer())
        .post(`/api/v1/keywords/projects/${projectId}/keywords`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ keywords: ['xlsx test'] });

      const xlsx = await request(app.getHttpServer())
        .get(`/api/v1/keywords/projects/${projectId}/export?format=excel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .buffer(true)
        .parse((res, cb) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => cb(null, Buffer.concat(chunks)));
        });
      const buf = xlsx.body as Buffer;
      // ZIP / XLSX magic: 50 4B (PK)
      expect(buf[0]).toBe(0x50);
      expect(buf[1]).toBe(0x4b);
    });
  });

  // ---- End-to-end ----

  describe('E2E: suggest → add to project → analyze with persist', () => {
    it('persists analyzed volume + KD + intent back into keyword rows', async () => {
      // 1. Suggest
      const sug = await request(app.getHttpServer())
        .post('/api/v1/keywords/suggest')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ seed: 'e2e seo', limit: 10 });
      expect(sug.status).toBe(201);
      const topKeywords = sug.body.data.keywords
        .slice(0, 3)
        .map((k: { keyword: string }) => k.keyword);

      // 2. Project + add
      const proj = await request(app.getHttpServer())
        .post('/api/v1/keywords/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'E2E project', seed_keyword: 'e2e seo' });
      const projectId = proj.body.data.id;
      await request(app.getHttpServer())
        .post(`/api/v1/keywords/projects/${projectId}/keywords`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ keywords: topKeywords });

      // 3. Analyze with project_id → expect rows in DB to have volume + analyzed_at.
      const an = await request(app.getHttpServer())
        .post('/api/v1/keywords/analyze')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ keywords: topKeywords, analyze_intent: true, project_id: projectId });
      expect(an.status).toBe(201);
      expect(an.body.data.rows).toHaveLength(topKeywords.length);

      const projectKws = await request(app.getHttpServer())
        .get(`/api/v1/keywords/projects/${projectId}/keywords`)
        .set('Authorization', `Bearer ${accessToken}`);
      for (const k of projectKws.body.data) {
        expect(k.volume).not.toBeNull();
        expect(k.keyword_difficulty).not.toBeNull();
        expect(k.intent).not.toBeNull();
        expect(k.analyzed_at).not.toBeNull();
      }
    });
  });
});
