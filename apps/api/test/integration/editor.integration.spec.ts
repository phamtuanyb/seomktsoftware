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
 * Sprint 6.5 — TN4 editor enhancements integration coverage.
 *
 * The Claude provider runs in stub mode (placeholder ANTHROPIC_API_KEY in
 * test env), so we get deterministic [STUB-…] markers back. Tests assert
 * the wiring + markdown splicing + export Content-Type, not LLM quality.
 */
describe('Article editor (integration) — Sprint 6.5', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let userId: string;
  let otherId: string;
  let token: string;
  let otherToken: string;
  let articleId: string;

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
    jwt = app.get(JwtService);
  });

  beforeEach(async () => {
    await prisma.truncateAll();
    const pw = await bcrypt.hash('Test@1', 4);
    userId = uuidv7();
    otherId = uuidv7();
    await prisma.user.createMany({
      data: [
        { id: userId, email: `ed-a-${Date.now()}@test.local`, passwordHash: pw, role: 'user' },
        { id: otherId, email: `ed-b-${Date.now()}@test.local`, passwordHash: pw, role: 'user' },
      ],
    });

    // Seed an article with 3 H2 sections so regenerate-section has something to target.
    articleId = uuidv7();
    const md = [
      '# Test article',
      '',
      'Đoạn intro về **content marketing**. LSI: SEO, từ khóa, intent.',
      '',
      '## Khái niệm cơ bản',
      '',
      'Đoạn body của section 1 nói về content marketing. Lorem ipsum dolor sit amet.',
      '',
      '## Lợi ích',
      '',
      'Đoạn body của section 2 nói về lợi ích của content marketing. Tăng traffic, lead, brand awareness.',
      '',
      '## Hướng dẫn áp dụng',
      '',
      'Đoạn body của section 3 nói về cách áp dụng. Bước 1, bước 2, bước 3 chi tiết.',
      '',
    ].join('\n');

    await prisma.article.create({
      data: {
        id: articleId,
        userId,
        title: 'Test article',
        slug: 'test-article',
        status: 'draft',
        content: '<p>rendered</p>',
        contentMarkdown: md,
        targetKeyword: 'content marketing',
        wordCount: 200,
        contentScore: 70,
        aiModelUsed: 'claude-sonnet-4',
        metaTitle: 'Test meta',
        metaDescription: 'Test description',
      },
    });

    token = jwt.sign({
      sub: userId,
      email: `ed-a-${Date.now()}@test.local`,
      plan: 'pro',
      role: 'user',
      jti: uuidv7(),
    });
    otherToken = jwt.sign({
      sub: otherId,
      email: `ed-b-${Date.now()}@test.local`,
      plan: 'pro',
      role: 'user',
      jti: uuidv7(),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ----- regenerate section -----

  describe('POST /content/articles/:id/regenerate-section', () => {
    it('replaces the body of the target H2 while keeping the heading + siblings', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/content/articles/${articleId}/regenerate-section`)
        .set('Authorization', `Bearer ${token}`)
        .send({ section_heading: 'Lợi ích' })
        .expect(201);

      const newMd = res.body.data.content_markdown as string;
      // Heading still present, in order.
      expect(newMd.indexOf('## Khái niệm cơ bản')).toBeLessThan(newMd.indexOf('## Lợi ích'));
      expect(newMd.indexOf('## Lợi ích')).toBeLessThan(newMd.indexOf('## Hướng dẫn áp dụng'));
      // The new body sits between Lợi ích and Hướng dẫn — verify the STUB
      // marker lands there. (Stub echoes the input for determinism; in prod
      // Claude returns a genuine rewrite.)
      const slice = newMd.slice(newMd.indexOf('## Lợi ích'), newMd.indexOf('## Hướng dẫn áp dụng'));
      expect(slice).toMatch(/\[STUB-/);
      // Other sections untouched.
      expect(newMd).toContain('Bước 1, bước 2, bước 3 chi tiết');
      expect(newMd).toContain('Lorem ipsum dolor sit amet');
    });

    it('404 when section heading not found', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/content/articles/${articleId}/regenerate-section`)
        .set('Authorization', `Bearer ${token}`)
        .send({ section_heading: 'Section nào đó không tồn tại' });
      expect(res.status).toBe(404);
    });

    it('404 on cross-user article', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/content/articles/${articleId}/regenerate-section`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ section_heading: 'Lợi ích' });
      expect(res.status).toBe(404);
    });
  });

  // ----- rewrite -----

  describe('POST /content/articles/:id/rewrite', () => {
    it('rewrites supplied text + returns it WITHOUT modifying the article', async () => {
      const original = 'Đây là một đoạn văn ngắn cần được viết lại theo phong cách khác.';
      const before = await prisma.article.findUnique({ where: { id: articleId } });
      const res = await request(app.getHttpServer())
        .post(`/api/v1/content/articles/${articleId}/rewrite`)
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'shorter', text: original })
        .expect(201);

      expect(res.body.data.rewritten).toBeTruthy();
      expect(res.body.data.rewritten).toMatch(/\[STUB-/);
      expect(res.body.data.article).toBeUndefined();
      // DB unchanged.
      const after = await prisma.article.findUnique({ where: { id: articleId } });
      expect(after!.contentMarkdown).toBe(before!.contentMarkdown);
    });

    it('whole-article rewrite + apply=1 replaces content_markdown', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/content/articles/${articleId}/rewrite`)
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'tone', tone: 'expert', apply: 1 })
        .expect(201);

      expect(res.body.data.article).toBeDefined();
      expect(res.body.data.article.content_markdown).toBe(res.body.data.rewritten);
      const after = await prisma.article.findUnique({ where: { id: articleId } });
      expect(after!.contentMarkdown).toBe(res.body.data.rewritten);
    });

    it('rejects action="free" without instructions', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/content/articles/${articleId}/rewrite`)
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'free' });
      expect(res.status).toBe(400);
    });

    it('rejects invalid action', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/content/articles/${articleId}/rewrite`)
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'nuke-it' });
      expect(res.status).toBe(400);
    });
  });

  // ----- export -----

  describe('GET /content/articles/:id/export', () => {
    it('returns markdown with text/markdown content-type', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/content/articles/${articleId}/export?format=md`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.headers['content-type']).toContain('text/markdown');
      expect(res.headers['content-disposition']).toContain('.md');
      expect(res.text).toContain('# Test article');
    });

    it('returns html with text/html content-type + wraps body', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/content/articles/${articleId}/export?format=html`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('<!doctype html>');
      expect(res.text).toContain('<title>Test article</title>');
    });

    it('returns docx (Word-compatible HTML) with application/msword', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/content/articles/${articleId}/export?format=docx`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.headers['content-type']).toContain('application/msword');
      expect(res.headers['content-disposition']).toContain('.doc');
    });

    it('400 on unknown format', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/content/articles/${articleId}/export?format=pdf`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    it('404 cross-user', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/content/articles/${articleId}/export?format=md`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(res.status).toBe(404);
    });
  });
});
