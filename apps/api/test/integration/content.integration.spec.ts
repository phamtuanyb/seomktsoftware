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
 * Section 8 TN3 + TN4 + TN5 integration tests.
 *
 * Boots the full Nest app against TEST_DATABASE_URL. LLM providers run in
 * STUB mode (placeholder ANTHROPIC_API_KEY in test env) so deterministic
 * fixtures replace real Claude calls.
 */
describe('Content (integration) — TN3 + TN4 + TN5', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
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
    jwtService = app.get(JwtService);
  });

  beforeEach(async () => {
    await prisma.truncateAll();

    // Seed one user with article quota.
    userId = uuidv7();
    const passwordHash = await bcrypt.hash('TestPass@1', 4);
    await prisma.user.create({
      data: {
        id: userId,
        email: `int-${Date.now()}@test.local`,
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
        resource: 'articles',
        period: 'monthly',
        limitValue: -1, // unlimited
        used: 0,
      },
    });
    await prisma.quota.create({
      data: {
        id: uuidv7(),
        userId,
        resource: 'brand_voices',
        period: 'lifetime',
        limitValue: -1,
        used: 0,
      },
    });

    // Mint JWT directly to bypass /auth/login throttler (10/hr) — 12+ tests
    // in this file would otherwise burn the budget after a single CI run.
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

  // ----- TN3 -----

  describe('POST /content/outline (TN3)', () => {
    it('returns a validated outline with metadata', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/content/outline')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ keyword: 'SEO test', format: 'blog', target_word_count: 2000 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.h1.toLowerCase()).toContain('seo test');
      expect(res.body.data.sections.length).toBeGreaterThanOrEqual(3);
      expect(res.body.data.metadata.is_stub).toBe(true);
      expect(res.body.data.metadata.based_on_serps).toHaveLength(5);
      expect(res.body.data.metadata.format).toBe('blog');
    });

    it('rejects keyword shorter than 2 chars', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/content/outline')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ keyword: 'x' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns cached outline on the second call', async () => {
      const first = await request(app.getHttpServer())
        .post('/api/v1/content/outline')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ keyword: 'cache test integration', format: 'blog' });
      expect(first.body.data.metadata.cached).toBe(false);

      const second = await request(app.getHttpServer())
        .post('/api/v1/content/outline')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ keyword: 'cache test integration', format: 'blog' });
      expect(second.body.data.metadata.cached).toBe(true);
      expect(second.body.data.h1).toBe(first.body.data.h1);
    });
  });

  // ----- TN4 -----

  const sampleOutline = {
    h1: 'Content marketing tổng quan 2026',
    sections: [
      {
        h2: 'Định nghĩa',
        subsections: [{ h3: 'Khái niệm', bullets: ['Bullet a', 'Bullet b'] }],
      },
      {
        h2: 'Lợi ích',
        subsections: [{ h3: 'Cá nhân', bullets: ['Tăng năng suất', 'Tiết kiệm thời gian'] }],
      },
      {
        h2: 'Câu hỏi thường gặp',
        subsections: [{ h3: 'Mất bao lâu?', bullets: ['Tuỳ ngành'] }],
      },
    ],
  };

  describe('POST /content/article (TN4 JSON mode)', () => {
    it('persists an article and returns ArticleResult', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/content/article')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          keyword: 'content marketing',
          outline: sampleOutline,
          format: 'blog',
          target_word_count: 2000,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(res.body.data.word_count).toBeGreaterThan(500);
      expect(res.body.data.content_score).toBeGreaterThan(0);
      expect(res.body.data.content_score).toBeLessThanOrEqual(100);
      expect(res.body.data.meta_title.toLowerCase()).toContain('content marketing');
      expect(res.body.data.meta_description.length).toBeGreaterThanOrEqual(140);
      expect(res.body.data.meta_description.length).toBeLessThanOrEqual(160);
      expect(res.body.data.is_stub).toBe(true);

      // DB row exists with the same id.
      const dbRow = await prisma.article.findUnique({ where: { id: res.body.data.id } });
      expect(dbRow).toBeTruthy();
      expect(dbRow!.userId).toBe(userId);
      expect(dbRow!.status).toBe('draft');
    });

    it('consumes 1 article quota on success', async () => {
      const before = await prisma.quota.findFirst({
        where: { userId, resource: 'articles' },
      });
      expect(before).toBeTruthy();

      // Note: limit_value -1 (unlimited) means used keeps incrementing; we
      // assert delta = 1 rather than the new used value.
      const beforeUsed = before!.used;

      await request(app.getHttpServer())
        .post('/api/v1/content/article')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          keyword: 'quota test',
          outline: sampleOutline,
          format: 'blog',
          target_word_count: 2000,
        })
        .expect(201);

      const after = await prisma.quota.findFirst({
        where: { userId, resource: 'articles' },
      });
      expect(after!.used).toBe(beforeUsed + 1);
    });

    it('rejects payload with too-short outline (Zod 3-section minimum bypassed by class-validator)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/content/article')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          keyword: 'broken',
          outline: { h1: 'too', sections: [] },
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /content/article (TN4 SSE mode)', () => {
    it('streams token + complete events when Accept: text/event-stream', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/content/article')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Accept', 'text/event-stream')
        .send({
          keyword: 'sse test',
          outline: sampleOutline,
          format: 'blog',
          target_word_count: 2000,
        })
        .buffer(true)
        .parse((res, cb) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => cb(null, Buffer.concat(chunks).toString('utf8')));
        });

      expect(res.status).toBe(201);
      const body = res.body as string;
      const tokenEvents = (body.match(/"type":"token"/g) ?? []).length;
      const completeEvents = (body.match(/"type":"complete"/g) ?? []).length;
      expect(tokenEvents).toBeGreaterThan(5);
      expect(completeEvents).toBe(1);
      expect(body).toContain('"article_id"');
      expect(body).toContain('"content_score"');
    });
  });

  // ----- TN5 -----

  describe('POST /brand-voices (TN5)', () => {
    it('creates a brand voice + Zod-validated profile + heuristic meta in stub mode', async () => {
      const sample = 'a'.repeat(600);
      const res = await request(app.getHttpServer())
        .post('/api/v1/brand-voices')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test BV',
          is_default: true,
          sample_articles: [
            { title: 'A', content: sample },
            { title: 'B', content: sample },
            { title: 'C', content: sample },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sample_count).toBe(3);
      expect(res.body.data.is_default).toBe(true);

      // Sprint 9 — meta moved out of profile_json into its own field.
      expect(res.body.data.meta.algorithm).toBe('placeholder-heuristic');
      expect(res.body.data.meta.sample_count).toBe(3);
      expect(res.body.data.meta.upgraded_to_real_at).toBeNull();

      // Profile shape (Zod-validated heuristic fallback).
      const profile = res.body.data.profile_json;
      expect(profile.tone.primary).toBeTruthy();
      expect(profile.sentence_structure.avg_words_per_sentence).toBeGreaterThanOrEqual(3);
      expect(profile.addressing.primary).toBeTruthy();
      expect(profile.emoji_usage).toBeDefined();
      expect(profile.patterns.opening_style).toBeTruthy();

      // Reference articles — trainer picks longest 3.
      expect(res.body.data.reference_articles).toHaveLength(3);

      const list = await request(app.getHttpServer())
        .get('/api/v1/brand-voices')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(list.body.data).toHaveLength(1);
    });

    it('rejects payload with <3 sample articles', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/brand-voices')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test BV',
          sample_articles: [{ content: 'a'.repeat(600) }],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('POST /brand-voices/:id/train re-runs training and bumps trained_at', async () => {
      const sample = 'c'.repeat(600);
      const created = await request(app.getHttpServer())
        .post('/api/v1/brand-voices')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Retrain BV',
          sample_articles: [{ content: sample }, { content: sample }, { content: sample }],
        })
        .expect(201);

      const firstTrainedAt = created.body.data.trained_at;
      // Wait 10ms so retrain timestamp differs.
      await new Promise((r) => setTimeout(r, 10));

      const retrain = await request(app.getHttpServer())
        .post(`/api/v1/brand-voices/${created.body.data.id}/train`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(retrain.body.success).toBe(true);
      expect(retrain.body.data.id).toBe(created.body.data.id);
      expect(retrain.body.data.meta.algorithm).toBe('placeholder-heuristic');
      expect(new Date(retrain.body.data.trained_at).getTime()).toBeGreaterThan(
        new Date(firstTrainedAt).getTime(),
      );
    });

    it('rejects sample_articles with content <200 chars and no url', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/brand-voices')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Too short',
          sample_articles: [{ content: 'short' }, { content: 'still short' }, { content: 'nope' }],
        });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ----- End-to-end: TN3 → TN4 with brand voice -----

  describe('end-to-end TN3 → TN4 with brand voice', () => {
    it('outline → article writes a brand-voice-aware row to DB', async () => {
      // Step 1: create brand voice.
      const sample = 'b'.repeat(700);
      const bv = await request(app.getHttpServer())
        .post('/api/v1/brand-voices')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'BV for E2E',
          sample_articles: [{ content: sample }, { content: sample }, { content: sample }],
        })
        .expect(201);

      // Step 2: outline.
      const outlineRes = await request(app.getHttpServer())
        .post('/api/v1/content/outline')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ keyword: 'e2e seo', format: 'blog', target_word_count: 2000 });
      expect(outlineRes.status).toBe(201);

      // Step 3: article using brand_voice_id from step 1 + outline from step 2.
      const articleRes = await request(app.getHttpServer())
        .post('/api/v1/content/article')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          keyword: 'e2e seo',
          outline: {
            h1: outlineRes.body.data.h1,
            sections: outlineRes.body.data.sections,
          },
          brand_voice_id: bv.body.data.id,
          format: 'blog',
        })
        .expect(201);

      expect(articleRes.body.data.brand_voice_id).toBe(bv.body.data.id);
      const dbRow = await prisma.article.findUnique({
        where: { id: articleRes.body.data.id },
      });
      expect(dbRow!.brandVoiceId).toBe(bv.body.data.id);
    });
  });
});
