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
 * Sprint 11 — Section 6 Users + Section 8 TN4 article CRUD.
 *
 * Boots the full Nest app against TEST_DATABASE_URL. Mints JWT directly to
 * skip /auth/login throttler (10/hr) since beforeEach spans 15+ tests.
 */
describe('Users + Articles (integration) — Sprint 11', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let userId: string;
  let otherUserId: string;
  let accessToken: string;
  let otherAccessToken: string;

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

    const passwordHash = await bcrypt.hash('TestPass@1', 4);
    userId = uuidv7();
    otherUserId = uuidv7();
    await prisma.user.createMany({
      data: [
        { id: userId, email: `int-${Date.now()}-a@test.local`, passwordHash, role: 'user' },
        { id: otherUserId, email: `int-${Date.now()}-b@test.local`, passwordHash, role: 'user' },
      ],
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
    await prisma.quota.createMany({
      data: [
        {
          id: uuidv7(),
          userId,
          resource: 'articles',
          period: 'monthly',
          limitValue: -1,
          used: 0,
        },
        {
          id: uuidv7(),
          userId,
          resource: 'brand_voices',
          period: 'lifetime',
          limitValue: -1,
          used: 0,
        },
      ],
    });

    const userA = await prisma.user.findUnique({ where: { id: userId } });
    const userB = await prisma.user.findUnique({ where: { id: otherUserId } });
    accessToken = jwtService.sign({
      sub: userId,
      email: userA!.email,
      plan: 'agency',
      role: 'user',
      jti: uuidv7(),
    });
    otherAccessToken = jwtService.sign({
      sub: otherUserId,
      email: userB!.email,
      plan: 'trial',
      role: 'user',
      jti: uuidv7(),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ----- Users /me -----

  describe('GET /users/me', () => {
    it('returns full profile + active subscription + quotas', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(userId);
      expect(res.body.data.plan).toBe('agency');
      expect(res.body.data.subscription?.plan).toBe('agency');
      expect(res.body.data.preferences_json).toEqual({});
      expect(res.body.data.quotas.length).toBeGreaterThanOrEqual(2);
      const resources = res.body.data.quotas.map((q: { resource: string }) => q.resource);
      expect(resources).toContain('articles');
      expect(resources).toContain('brand_voices');
    });

    it('returns 401 without a valid token', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/users/me');
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /users/me', () => {
    it('updates name + phone + preferences', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Nguyen Van A',
          phone: '0901234567',
          preferences_json: { theme: 'dark', language: 'vi' },
        })
        .expect(200);

      expect(res.body.data.name).toBe('Nguyen Van A');
      expect(res.body.data.phone).toBe('0901234567');
      expect(res.body.data.preferences_json).toEqual({ theme: 'dark', language: 'vi' });
    });

    it('rejects invalid phone format', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ phone: 'not-a-phone-number!!' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects non-https avatar URL', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ avatar_url: 'http://example.com/a.png' });
      expect(res.status).toBe(400);
    });
  });

  // ----- Articles -----

  /** Seed N articles for `userId`. Returns the inserted rows ordered by created_at desc. */
  async function seedArticles(count: number, prefix = 'Article'): Promise<string[]> {
    const ids: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const id = uuidv7();
      ids.push(id);
      await prisma.article.create({
        data: {
          id,
          userId,
          title: `${prefix} ${i + 1}`,
          slug: `${prefix.toLowerCase()}-${i + 1}`,
          status: 'draft',
          content: `<p>Body of ${prefix} ${i + 1}</p>`,
          contentMarkdown: `# ${prefix} ${i + 1}\n\nBody`,
          targetKeyword: `kw-${i % 3}`,
          wordCount: 500,
          contentScore: 70 + i,
          aiModelUsed: 'claude-sonnet-4',
          metaTitle: `${prefix} ${i + 1} meta`,
          metaDescription: `Meta description for ${prefix} ${i + 1}`,
        },
      });
      // Force created_at order — newest last loop iteration = most recent.
      await new Promise((r) => setTimeout(r, 2));
    }
    return ids.reverse();
  }

  describe('GET /content/articles', () => {
    it('returns paginated articles with cursor + has_more', async () => {
      await seedArticles(25);
      const res = await request(app.getHttpServer())
        .get('/api/v1/content/articles?limit=10')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data.items).toHaveLength(10);
      expect(res.body.data.has_more).toBe(true);
      expect(res.body.data.cursor).toBeTruthy();

      const page2 = await request(app.getHttpServer())
        .get(`/api/v1/content/articles?limit=10&cursor=${encodeURIComponent(res.body.data.cursor)}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(page2.body.data.items).toHaveLength(10);
      // No overlap between pages.
      const idsPage1 = new Set(res.body.data.items.map((a: { id: string }) => a.id));
      for (const a of page2.body.data.items as Array<{ id: string }>) {
        expect(idsPage1.has(a.id)).toBe(false);
      }
    });

    it('filters by status', async () => {
      await seedArticles(3);
      // Mark one as published.
      const all = await prisma.article.findMany({ where: { userId } });
      await prisma.article.update({
        where: { id: all[0]!.id },
        data: { status: 'published' },
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/content/articles?status=published')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].id).toBe(all[0]!.id);
    });

    it('filters by q substring (title or target_keyword)', async () => {
      await seedArticles(2, 'Marketing');
      await seedArticles(1, 'Tutorial');
      const res = await request(app.getHttpServer())
        .get('/api/v1/content/articles?q=Marketing')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(res.body.data.items).toHaveLength(2);
      expect(
        (res.body.data.items as Array<{ title: string }>).every((a) =>
          a.title.includes('Marketing'),
        ),
      ).toBe(true);
    });

    it('does not leak other users articles', async () => {
      await seedArticles(2);
      await prisma.article.create({
        data: {
          id: uuidv7(),
          userId: otherUserId,
          title: 'OTHER USER PRIVATE',
          status: 'draft',
        },
      });
      const res = await request(app.getHttpServer())
        .get('/api/v1/content/articles')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(res.body.data.items).toHaveLength(2);
      for (const a of res.body.data.items as Array<{ title: string }>) {
        expect(a.title).not.toContain('PRIVATE');
      }
    });
  });

  describe('GET /content/articles/:id', () => {
    it('returns one article belonging to the caller', async () => {
      const [firstId] = await seedArticles(1);
      const res = await request(app.getHttpServer())
        .get(`/api/v1/content/articles/${firstId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(res.body.data.id).toBe(firstId);
    });

    it('returns 404 for another user article', async () => {
      const otherId = uuidv7();
      await prisma.article.create({
        data: { id: otherId, userId: otherUserId, title: 'theirs', status: 'draft' },
      });
      const res = await request(app.getHttpServer())
        .get(`/api/v1/content/articles/${otherId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /content/articles/:id', () => {
    it('updates title + markdown and re-renders HTML + recomputes word_count', async () => {
      const [id] = await seedArticles(1);
      const newMd = '# Updated title\n\n' + 'this is a sentence. '.repeat(40);
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/content/articles/${id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Renamed',
          content_markdown: newMd,
          meta_title: 'New meta',
          status: 'ready',
        })
        .expect(200);

      expect(res.body.data.title).toBe('Renamed');
      expect(res.body.data.content_markdown).toContain('Updated title');
      expect(res.body.data.content_html).toMatch(/<h1>.*Updated title.*<\/h1>/i);
      expect(res.body.data.word_count).toBeGreaterThan(50);
    });

    it("won't update another user's article", async () => {
      const [id] = await seedArticles(1);
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/content/articles/${id}`)
        .set('Authorization', `Bearer ${otherAccessToken}`)
        .send({ title: 'hacked' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /content/articles/:id', () => {
    it('soft-deletes (status=deleted + deleted_at)', async () => {
      const [id] = await seedArticles(1);
      await request(app.getHttpServer())
        .delete(`/api/v1/content/articles/${id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const row = await prisma.article.findUnique({ where: { id } });
      expect(row!.deletedAt).not.toBeNull();
      expect(row!.status).toBe('deleted');

      // Subsequent GET returns 404.
      const after = await request(app.getHttpServer())
        .get(`/api/v1/content/articles/${id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(after.status).toBe(404);
    });
  });
});
