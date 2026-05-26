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

const GOOD_HTML = `
  <article>
    <h1>SEO local cho doanh nghiệp nhỏ — Hướng dẫn 2026</h1>
    <p>SEO local cho doanh nghiệp nhỏ giúp cửa hàng địa phương xuất hiện trên Google Maps.
    ${'Citation NAP backlink Map Pack '.repeat(60)}</p>
    <h2>SEO local là gì?</h2>
    <p>${'Tối ưu hiển thị địa phương Google Maps citation NAP '.repeat(40)}</p>
    <h2>Hướng dẫn triển khai</h2>
    <p>${'Google Business Profile citation NAP backlink '.repeat(40)}</p>
    <h2>FAQ — Câu hỏi thường gặp</h2>
    <h3>SEO local mất bao lâu?</h3><p>3-6 tháng cạnh tranh trung bình</p>
    <h3>Cần ngân sách bao nhiêu?</h3><p>5 triệu/tháng</p>
    <h3>Có cần thuê agency không?</h3><p>Dưới 10 nhân sự tự làm</p>
    <h3>SEO local khác gì SEO thường?</h3><p>Map Pack quan trọng</p>
    <h3>Đo lường thế nào?</h3><p>Vị trí Map Pack click-through</p>
    <h2>Kết luận</h2>
    <p>SEO local là cuộc chơi dài hạn ROI cao</p>
    <p><a href="/blog/a">a</a><a href="/blog/b">b</a><a href="/blog/c">c</a>
    <a href="https://moz.com">Moz</a><a href="https://search.google.com">Google</a></p>
    <img src="/img/1.jpg" alt="SEO local map pack" />
    <img src="/img/2.jpg" alt="Google Business Profile" />
    <img src="/img/3.jpg" alt="SEO local citation NAP" />
    <script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article' })}</script>
    <script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage' })}</script>
  </article>
`;

describe('Audit (integration) — TN7 score + auto-fix', () => {
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
      data: {
        id: userId,
        email: `int-audit-${Date.now()}@test.local`,
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

  describe('POST /audit/score', () => {
    it('returns 12 rules in breakdown for inline payload', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/audit/score')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'SEO local — chuẩn 2026',
          content: GOOD_HTML,
          meta_title: 'SEO local cho doanh nghiệp nhỏ 2026 — chuẩn',
          meta_description:
            'SEO local cho doanh nghiệp nhỏ là chiến lược toàn diện 2026 giúp cửa hàng địa phương xuất hiện trên Google Maps. Tổng hợp lộ trình + FAQ chi tiết bổ ích.',
          target_keyword: 'SEO local',
          secondary_keywords: ['Google Business Profile', 'Map Pack', 'NAP citation'],
          intent: 'info',
          base_url: 'https://example.com',
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(Object.keys(res.body.data.breakdown)).toHaveLength(12);
      expect(res.body.data.score).toBeGreaterThan(70);
      expect(res.body.data.status).toMatch(/good|warning/);
      expect(Array.isArray(res.body.data.prioritized)).toBe(true);
      expect(res.body.data.duration_ms).toBeLessThan(2000);
    });

    it('fails fast (~50 ms) on a tiny bad article', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/audit/score')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Empty',
          content: '<p>x</p>',
          target_keyword: 'SEO local',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.score).toBeLessThan(40);
      expect(res.body.data.status).toBe('fail');
      const failingCount = (
        Object.values(res.body.data.breakdown) as Array<{ status: string }>
      ).filter((r) => r.status === 'fail').length;
      expect(failingCount).toBeGreaterThan(5);
    });

    it('rejects when neither article_id nor (title+content) is supplied', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/audit/score')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ target_keyword: 'SEO local' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('loads + persists score back to the article when article_id supplied', async () => {
      const articleId = uuidv7();
      await prisma.article.create({
        data: {
          id: articleId,
          userId,
          title: 'Persisted SEO local guide',
          content: GOOD_HTML,
          contentMarkdown: '# SEO local',
          metaTitle: 'SEO local 2026',
          metaDescription:
            'SEO local cho doanh nghiệp nhỏ 2026 toàn diện đầy đủ hướng dẫn từ a-z chi tiết và FAQ.',
          targetKeyword: 'SEO local',
          status: 'draft',
        },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/audit/score')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ article_id: articleId, target_keyword: 'SEO local', intent: 'info' });
      expect(res.status).toBe(201);
      expect(res.body.data.source).toBe('article');
      expect(res.body.data.article_id).toBe(articleId);

      const updated = await prisma.article.findUnique({ where: { id: articleId } });
      expect(updated!.contentScore).toBe(res.body.data.score);
      expect(updated!.scoreBreakdownJson).toBeTruthy();
    });
  });

  describe('POST /audit/auto-fix', () => {
    it('returns improved=false + is_stub=true when Claude key is placeholder', async () => {
      const articleId = uuidv7();
      await prisma.article.create({
        data: {
          id: articleId,
          userId,
          title: 'Needs fixing',
          content: '<h1>Topic</h1><p>too short</p>',
          contentMarkdown: '# Topic\n\ntoo short',
          metaTitle: '',
          metaDescription: '',
          targetKeyword: 'SEO local',
          status: 'draft',
        },
      });
      const res = await request(app.getHttpServer())
        .post('/api/v1/audit/auto-fix')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ article_id: articleId });
      expect(res.status).toBe(201);
      expect(res.body.data.is_stub).toBe(true);
      expect(res.body.data.improved).toBe(false);
      expect(res.body.data.rules_targeted.length).toBeGreaterThan(0);
      expect(res.body.data.before.score).toBe(res.body.data.after.score);
    });

    it('rejects unknown article_id (multi-tenant isolation)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/audit/auto-fix')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ article_id: uuidv7() });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });
  });

  describe('TN4 article completion auto-scores via TN7', () => {
    it('newly generated article has the 12-rule breakdown persisted', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/content/article')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          keyword: 'SEO local',
          outline: {
            h1: 'SEO local cho doanh nghiệp nhỏ',
            sections: [
              {
                h2: 'Định nghĩa SEO local',
                subsections: [{ h3: 'Khái niệm', bullets: ['bullet a', 'bullet b'] }],
              },
              {
                h2: 'Lợi ích',
                subsections: [{ h3: 'Cá nhân', bullets: ['tăng năng suất'] }],
              },
              {
                h2: 'Câu hỏi thường gặp',
                subsections: [{ h3: 'Mất bao lâu?', bullets: ['tuỳ ngành'] }],
              },
            ],
          },
          target_word_count: 2000,
        });
      expect(res.status).toBe(201);
      const article = res.body.data;
      // 12-rule shape: keys include rule_id, weight, status, suggestions[].
      const breakdownRuleIds = Object.keys(article.content_score_breakdown);
      expect(breakdownRuleIds).toEqual(
        expect.arrayContaining([
          'keyword_density',
          'title_keyword',
          'meta_description',
          'h1_unique',
          'heading_structure',
          'word_count',
          'links',
          'images_alt',
          'schema_markup',
          'lsi_keywords',
          'intro_hook',
          'faq_section',
        ]),
      );
    });
  });
});
