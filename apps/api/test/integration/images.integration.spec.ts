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
 * Section 8 TN6 integration tests — generate / generate-for-article /
 * list / delete + quota + safety + multi-tenant isolation. LLM, Replicate
 * and R2 all run in stub mode (placeholder env vars) so the placehold.co
 * pipeline is exercised end-to-end.
 */
describe('Images (integration) — TN6 generation + gallery', () => {
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
    await redis.flushdb();

    userId = uuidv7();
    const passwordHash = await bcrypt.hash('TestPass@1', 4);
    await prisma.user.create({
      data: { id: userId, email: `int-img-${Date.now()}@test.local`, passwordHash, role: 'user' },
    });
    await prisma.subscription.create({
      data: { id: uuidv7(), userId, plan: 'agency', status: 'active', startedAt: new Date() },
    });
    await prisma.quota.create({
      data: {
        id: uuidv7(),
        userId,
        resource: 'images',
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
    accessToken = res.body.data.tokens.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /images/generate', () => {
    it('generates count images with placehold.co URLs in stub mode', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/images/generate')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          prompt: 'SEO local cho doanh nghiệp nhỏ minh hoạ map pack',
          style: 'mkt-brand',
          aspect_ratio: '16:9',
          count: 3,
        });
      expect(res.status).toBe(201);
      expect(res.body.data.images).toHaveLength(3);
      expect(res.body.data.stats.provider_stub).toBe(true);
      expect(res.body.data.stats.count).toBe(3);
      for (const img of res.body.data.images) {
        expect(img.url).toMatch(/placehold\.co/);
        expect(img.width).toBe(1280);
        expect(img.height).toBe(720);
        expect(img.alt_text).toBeTruthy();
        expect(img.model_used).toContain('flux-schnell');
      }
    });

    it('rejects unsafe prompts (NSFW hard-block)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/images/generate')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ prompt: 'nude woman illustration', count: 1 });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.flags).toContain('hard:nude');
    });

    it('strips celebrity names but still generates', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/images/generate')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          prompt: 'Elon Musk demos new product in office',
          count: 1,
        });
      expect(res.status).toBe(201);
      // Prompt should have been sanitized — "Elon Musk" no longer present.
      expect(res.body.data.images[0].prompt.toLowerCase()).not.toContain('elon musk');
      expect(res.body.data.images[0].prompt).toContain('a public figure');
    });

    it('consumes 1 quota per returned image', async () => {
      const before = await prisma.quota.findFirst({ where: { userId, resource: 'images' } });
      const beforeUsed = before!.used;
      await request(app.getHttpServer())
        .post('/api/v1/images/generate')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ prompt: 'quota usage test image', count: 2 })
        .expect(201);
      const after = await prisma.quota.findFirst({ where: { userId, resource: 'images' } });
      expect(after!.used).toBe(beforeUsed + 2);
    });

    it('attaches to article when article_id supplied', async () => {
      const articleId = uuidv7();
      await prisma.article.create({
        data: {
          id: articleId,
          userId,
          title: 'SEO local for SMEs',
          targetKeyword: 'SEO local',
          status: 'draft',
        },
      });
      const res = await request(app.getHttpServer())
        .post('/api/v1/images/generate')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          prompt: 'SEO local guide cover',
          count: 1,
          article_id: articleId,
        });
      expect(res.body.data.images[0].article_id).toBe(articleId);
      const list = await request(app.getHttpServer())
        .get(`/api/v1/images?article_id=${articleId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(list.body.data).toHaveLength(1);
    });
  });

  describe('POST /images/generate-for-article', () => {
    it('produces 1 featured + per-H2 images and persists featured_image_id', async () => {
      const articleId = uuidv7();
      await prisma.article.create({
        data: {
          id: articleId,
          userId,
          title: 'SEO local 2026',
          targetKeyword: 'SEO local',
          status: 'draft',
          outlineJson: {
            sections: [
              { h2: 'SEO local là gì' },
              { h2: 'Lợi ích' },
              { h2: 'Hướng dẫn triển khai' },
            ],
          },
        },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/images/generate-for-article')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ article_id: articleId, include_featured: true, max_in_content: 3 });
      expect(res.status).toBe(201);
      // 1 featured + 3 in-content.
      expect(res.body.data.images.length).toBe(4);
      expect(res.body.data.featured_image_id).toBeTruthy();

      const updated = await prisma.article.findUnique({ where: { id: articleId } });
      expect(updated!.featuredImageId).toBe(res.body.data.featured_image_id);
    });
  });

  describe('Gallery CRUD', () => {
    it('lists, gets, and soft-deletes (multi-tenant)', async () => {
      const gen = await request(app.getHttpServer())
        .post('/api/v1/images/generate')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ prompt: 'list crud test prompt', count: 1 });
      const id = gen.body.data.images[0].id;

      const got = await request(app.getHttpServer())
        .get(`/api/v1/images/${id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(got.body.data.id).toBe(id);

      const removed = await request(app.getHttpServer())
        .delete(`/api/v1/images/${id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(removed.status).toBe(200);

      const after = await request(app.getHttpServer())
        .get('/api/v1/images')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(after.body.data.find((i: { id: string }) => i.id === id)).toBeUndefined();
    });

    it('returns 404 when accessing another tenant’s image', async () => {
      const otherUserId = uuidv7();
      const otherImageId = uuidv7();
      await prisma.user.create({
        data: {
          id: otherUserId,
          email: `int-img-other-${Date.now()}@test.local`,
          passwordHash: await bcrypt.hash('x', 4),
          role: 'user',
        },
      });
      await prisma.image.create({
        data: {
          id: otherImageId,
          userId: otherUserId,
          url: 'https://placehold.co/16x9/png',
          prompt: 'other tenant image',
          style: 'mkt-brand',
          aspectRatio: '16:9',
          width: 16,
          height: 9,
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/images/${otherImageId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });
  });
});
