import { type INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { uuidv7 } from 'uuidv7';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/services/prisma.service';
import { REDIS_CLIENT } from '../../src/common/services/redis.service';
import type { Redis as RedisClient } from 'ioredis';
import { WordPressAdapter } from '../../src/modules/publisher/adapters/wordpress.adapter';
import { PublisherService } from '../../src/modules/publisher/services/publisher.service';
import { CryptoService } from '../../src/common/services/crypto.service';

class NoopGuard {
  canActivate(): boolean {
    return true;
  }
}

/**
 * Section 8 TN8 integration tests.
 *
 * WordPressAdapter is overridden with an in-process fake so we never hit
 * a real WP install in CI. The fake records every call so assertions can
 * pin down what the publisher actually sent.
 */
class FakeWordPressAdapter extends WordPressAdapter {
  public publishCalls: Array<{ title: string; status: string; categories?: string[] }> = [];
  public nextPublishResult: { remote_post_id: number; published_url: string } = {
    remote_post_id: 4242,
    published_url: 'https://wpdemo.example.com/?p=4242',
  };
  public nextTestResult: import('../../src/modules/publisher/adapters/publisher.interface').TestConnectionResult =
    {
      ok: true,
      seo_plugin: 'yoast',
      site_info: { name: 'Fake WP', timezone: 'Asia/Ho_Chi_Minh' },
    };
  public shouldFailNextPublish = false;
  public failuresUntilSuccess = 0;

  override async testConnection() {
    return this.nextTestResult;
  }
  override async publish(
    article: import('../../src/modules/publisher/adapters/publisher.interface').PublishArticle,
    _creds: import('../../src/modules/publisher/adapters/publisher.interface').SiteCredentials,
    opts: import('../../src/modules/publisher/adapters/publisher.interface').PublishOptions,
  ) {
    this.publishCalls.push({
      title: article.title,
      status: opts.status,
      categories: opts.categories,
    });
    if (this.failuresUntilSuccess > 0) {
      this.failuresUntilSuccess--;
      throw new Error('WP 503 transient — try again');
    }
    if (this.shouldFailNextPublish) {
      this.shouldFailNextPublish = false;
      throw new Error('401 Unauthorized — bad app password');
    }
    return {
      remote_post_id: this.nextPublishResult.remote_post_id,
      published_url: this.nextPublishResult.published_url,
      raw: { id: this.nextPublishResult.remote_post_id },
    };
  }
}

describe('Publisher (integration) — TN8 sites + publish + jobs', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisClient;
  let publisher: PublisherService;
  let crypto: CryptoService;
  let fakeWp: FakeWordPressAdapter;
  let jwtService: JwtService;
  let userId: string;
  let accessToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(ThrottlerGuard)
      .useClass(NoopGuard)
      .overrideProvider(WordPressAdapter)
      .useClass(FakeWordPressAdapter)
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
    publisher = app.get(PublisherService);
    crypto = app.get(CryptoService);
    fakeWp = app.get(WordPressAdapter) as FakeWordPressAdapter;
    jwtService = app.get(JwtService);
  });

  beforeEach(async () => {
    await prisma.truncateAll();
    await redis.flushdb();
    fakeWp.publishCalls = [];
    fakeWp.shouldFailNextPublish = false;
    fakeWp.failuresUntilSuccess = 0;
    fakeWp.nextTestResult = {
      ok: true,
      seo_plugin: 'yoast',
      site_info: { name: 'Fake WP' },
    };

    userId = uuidv7();
    const passwordHash = await bcrypt.hash('TestPass@1', 4);
    await prisma.user.create({
      data: { id: userId, email: `int-pub-${Date.now()}@test.local`, passwordHash, role: 'user' },
    });
    await prisma.subscription.create({
      data: { id: uuidv7(), userId, plan: 'agency', status: 'active', startedAt: new Date() },
    });
    await prisma.quota.create({
      data: {
        id: uuidv7(),
        userId,
        resource: 'sites',
        period: 'lifetime',
        limitValue: -1,
        used: 0,
      },
    });

    // Mint JWT directly to bypass the /auth/login throttler (10/min) since
    // beforeEach in 11+ tests easily blows that budget.
    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    accessToken = jwtService.sign({
      sub: userId,
      email: dbUser!.email,
      plan: 'agency',
      role: 'user',
      jti: uuidv7(),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ---- Sites CRUD ----

  describe('POST /publisher/sites', () => {
    it('creates a site with encrypted credentials + probes + detects SEO plugin', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/publisher/sites')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          url: 'https://wpdemo.example.com',
          name: 'Demo WP',
          username: 'admin',
          application_password: 'abcdEFGH1234ijkl',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('active');
      expect(res.body.data.plugin_seo_detected).toBe('yoast');

      // credentials_encrypted should not contain the plaintext password.
      const row = await prisma.site.findUnique({ where: { id: res.body.data.id } });
      expect(row!.credentialsEncrypted).not.toContain('abcdEFGH1234ijkl');
      expect(row!.credentialsEncrypted).toMatch(/^v1:/);

      // Decrypts back to the original (round-trip).
      const decrypted = crypto.decrypt(row!.credentialsEncrypted);
      const parsed = JSON.parse(decrypted) as { application_password: string };
      expect(parsed.application_password).toBe('abcdEFGH1234ijkl');
    });

    it('rejects when site quota is exhausted', async () => {
      await prisma.quota.updateMany({
        where: { userId, resource: 'sites' },
        data: { limitValue: 1, used: 0 },
      });

      // First create succeeds.
      await request(app.getHttpServer())
        .post('/api/v1/publisher/sites')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          url: 'https://site1.example.com',
          username: 'a',
          application_password: 'abcd1234efgh',
        })
        .expect(201);

      // Second create exceeds quota.
      const res = await request(app.getHttpServer())
        .post('/api/v1/publisher/sites')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          url: 'https://site2.example.com',
          username: 'b',
          application_password: 'mnopqrst1234',
        });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('QUOTA_EXCEEDED');
    });

    it('test endpoint refreshes status + plugin detection', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/publisher/sites')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          url: 'https://wpdemo.example.com',
          username: 'admin',
          application_password: 'abcdEFGH1234ijkl',
        });

      fakeWp.nextTestResult = { ok: true, seo_plugin: 'rankmath' };
      const t = await request(app.getHttpServer())
        .post(`/api/v1/publisher/sites/${created.body.data.id}/test`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(t.body.data.seo_plugin).toBe('rankmath');

      const row = await prisma.site.findUnique({ where: { id: created.body.data.id } });
      expect(row!.pluginSeoDetected).toBe('rankmath');
    });
  });

  // ---- Publish + runJob ----

  describe('POST /publisher/wordpress + runJob', () => {
    async function seedSiteAndArticle(): Promise<{ siteId: string; articleId: string }> {
      const site = await request(app.getHttpServer())
        .post('/api/v1/publisher/sites')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          url: 'https://wpdemo.example.com',
          username: 'admin',
          application_password: 'abcdEFGH1234ijkl',
        });
      const articleId = uuidv7();
      await prisma.article.create({
        data: {
          id: articleId,
          userId,
          title: 'SEO local cho doanh nghiệp nhỏ',
          content: '<h1>SEO local</h1><p>body</p>',
          contentMarkdown: '# SEO local',
          metaTitle: 'SEO local 2026',
          metaDescription:
            'SEO local cho doanh nghiệp nhỏ hướng dẫn toàn diện 2026 đầy đủ kèm FAQ chi tiết và bảng so sánh giải pháp.',
          targetKeyword: 'SEO local',
          status: 'draft',
        },
      });
      return { siteId: site.body.data.id, articleId };
    }

    it('enqueues a publish job in pending status', async () => {
      const { siteId, articleId } = await seedSiteAndArticle();
      const res = await request(app.getHttpServer())
        .post('/api/v1/publisher/wordpress')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          article_id: articleId,
          site_id: siteId,
          status: 'publish',
          categories: ['SEO', 'Marketing'],
          tags: ['local-seo'],
        });
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('pending');
      expect(res.body.data.article_id).toBe(articleId);
      expect(res.body.data.site_id).toBe(siteId);
    });

    it('runJob completes successfully and persists wp_post_id + URL', async () => {
      const { siteId, articleId } = await seedSiteAndArticle();
      const enqueue = await request(app.getHttpServer())
        .post('/api/v1/publisher/wordpress')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          article_id: articleId,
          site_id: siteId,
          status: 'publish',
          categories: ['SEO'],
        });
      const jobId = enqueue.body.data.id;

      // Drive the worker inline (BullMQ → service path).
      await publisher.runJob({ publish_job_id: jobId, user_id: userId }, 0);

      const row = await prisma.publishJob.findUnique({ where: { id: jobId } });
      expect(row!.status).toBe('completed');
      expect(row!.wpPostId).toBe(4242);
      expect(row!.publishedUrl).toContain('?p=4242');

      // Adapter was called with the right title + categories.
      const call = fakeWp.publishCalls.at(-1);
      expect(call?.title).toBe('SEO local cho doanh nghiệp nhỏ');
      expect(call?.categories).toEqual(['SEO']);
    });

    it('runJob marks failed after final attempt and emits publish.failed', async () => {
      const { siteId, articleId } = await seedSiteAndArticle();
      // Bypass the queue — see the pending-retry test above for the rationale.
      const jobId = uuidv7();
      await prisma.publishJob.create({
        data: {
          id: jobId,
          userId,
          articleId,
          siteId,
          status: 'pending',
          payloadJson: { status: 'publish', categories: [], tags: [] },
        },
      });

      fakeWp.shouldFailNextPublish = true;

      // Simulate "final attempt" → attemptNumber=2 (0-indexed, attempts: 3 → 2 is final).
      await expect(publisher.runJob({ publish_job_id: jobId, user_id: userId }, 2)).rejects.toThrow(
        /401/,
      );

      const row = await prisma.publishJob.findUnique({ where: { id: jobId } });
      expect(row!.status).toBe('failed');
      expect(row!.errorCode).toBe('WP_AUTH_ERROR');
      expect(row!.retryCount).toBe(3);
    });

    it('runJob keeps status=pending between attempts (not failed) so BullMQ retries', async () => {
      const { siteId, articleId } = await seedSiteAndArticle();
      // Bypass the queue — seed a publish_job row directly so we control
      // exactly when runJob fires (otherwise the live BullMQ worker may
      // race us and consume the prepared failure flag).
      const jobId = uuidv7();
      await prisma.publishJob.create({
        data: {
          id: jobId,
          userId,
          articleId,
          siteId,
          status: 'pending',
          payloadJson: { status: 'publish', categories: [], tags: [] },
        },
      });

      fakeWp.shouldFailNextPublish = true;
      // attemptNumber=0 → not the final attempt yet.
      await expect(
        publisher.runJob({ publish_job_id: jobId, user_id: userId }, 0),
      ).rejects.toThrow();

      const row = await prisma.publishJob.findUnique({ where: { id: jobId } });
      expect(row!.status).toBe('pending');
      expect(row!.retryCount).toBe(1);
    });

    it('rate limits 10 jobs/site/hour', async () => {
      const { siteId, articleId } = await seedSiteAndArticle();
      for (let i = 0; i < 10; i++) {
        await request(app.getHttpServer())
          .post('/api/v1/publisher/wordpress')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ article_id: articleId, site_id: siteId })
          .expect(201);
      }
      const res = await request(app.getHttpServer())
        .post('/api/v1/publisher/wordpress')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ article_id: articleId, site_id: siteId });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('RATE_LIMITED');
    });

    it('rejects status=future without scheduled_at', async () => {
      const { siteId, articleId } = await seedSiteAndArticle();
      const res = await request(app.getHttpServer())
        .post('/api/v1/publisher/wordpress')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ article_id: articleId, site_id: siteId, status: 'future' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ---- Jobs CRUD ----

  describe('Jobs list + cancel + multi-tenant', () => {
    it('cancels a pending job', async () => {
      // Seed pending job directly so BullMQ doesn't race us to completion.
      const jobId = uuidv7();
      const articleId = uuidv7();
      const siteId = uuidv7();
      await prisma.article.create({
        data: {
          id: articleId,
          userId,
          title: 'cancel test',
          content: '<h1>x</h1>',
          targetKeyword: 'seo',
          status: 'draft',
        },
      });
      await prisma.site.create({
        data: {
          id: siteId,
          userId,
          url: 'https://wp.example.com',
          type: 'wordpress',
          credentialsEncrypted: crypto.encrypt(
            JSON.stringify({ username: 'a', application_password: 'b' }),
          ),
          status: 'active',
        },
      });
      await prisma.publishJob.create({
        data: { id: jobId, userId, articleId, siteId, status: 'pending' },
      });

      const cancel = await request(app.getHttpServer())
        .delete(`/api/v1/publisher/jobs/${jobId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(cancel.status).toBe(200);
      expect(cancel.body.data.status).toBe('cancelled');
    });

    it('returns 404 when accessing another tenant’s job', async () => {
      // Seed an article + site + job under a different user so FKs hold.
      const otherUserId = uuidv7();
      await prisma.user.create({
        data: {
          id: otherUserId,
          email: `other-${Date.now()}@test.local`,
          passwordHash: await bcrypt.hash('x', 4),
          role: 'user',
        },
      });
      const otherArticleId = uuidv7();
      await prisma.article.create({
        data: {
          id: otherArticleId,
          userId: otherUserId,
          title: 'other tenant article',
          status: 'draft',
        },
      });
      const otherSiteId = uuidv7();
      await prisma.site.create({
        data: {
          id: otherSiteId,
          userId: otherUserId,
          url: 'https://other.example.com',
          type: 'wordpress',
          credentialsEncrypted: crypto.encrypt(
            JSON.stringify({ username: 'x', application_password: 'y' }),
          ),
          status: 'active',
        },
      });
      const otherJobId = uuidv7();
      await prisma.publishJob.create({
        data: {
          id: otherJobId,
          userId: otherUserId,
          articleId: otherArticleId,
          siteId: otherSiteId,
          status: 'pending',
        },
      });
      const res = await request(app.getHttpServer())
        .get(`/api/v1/publisher/jobs/${otherJobId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(404);
    });
  });
});
