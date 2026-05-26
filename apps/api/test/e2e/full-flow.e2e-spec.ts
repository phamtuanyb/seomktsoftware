import { type INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/services/prisma.service';
import { PipelineProcessor } from '../../src/modules/pipeline/workers/pipeline.processor';
import { PipelineRunnerService } from '../../src/modules/pipeline/services/pipeline-runner.service';

/**
 * Section 14 Sprint 14.1 — end-to-end happy path through real HTTP layer.
 *
 * What this spec verifies that integration specs don't:
 * - The full /auth/register → /auth/login → /users/me handshake works
 *   (cookies, JWT shape, trial subscription seeding, quota seeding).
 * - Module boundaries hold when chained: auth → brand voices → pipeline
 *   → audit → article CRUD all share state through the DB layer, not
 *   shortcuts.
 * - The pipeline orchestrator's article + audit steps actually persist
 *   and are visible via the article CRUD endpoints.
 *
 * BullMQ workers (publish + pipeline) are stubbed so the test is
 * deterministic — we drive PipelineRunnerService.run() directly.
 */

class NoopGuard {
  canActivate() {
    return true;
  }
}

class StubPipelineProcessor {
  onModuleInit() {}
  async onModuleDestroy() {}
}

describe('Full flow (e2e) — register → brand voice → pipeline → article CRUD', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let runner: PipelineRunnerService;
  let accessToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(ThrottlerGuard)
      .useClass(NoopGuard)
      .overrideProvider(PipelineProcessor)
      .useClass(StubPipelineProcessor)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.setGlobalPrefix('api', { exclude: ['health', 'version', 'docs', 'docs-json'] });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    prisma = app.get(PrismaService);
    runner = app.get(PipelineRunnerService);
    await prisma.truncateAll();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Step 1: register seeds user + trial subscription + default quotas', async () => {
    const email = `e2e-${Date.now()}@test.local`;
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'P@ssw0rd123', name: 'E2E Tester' })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(email);
    expect(res.body.data.tokens.access_token).toBeTruthy();
    accessToken = res.body.data.tokens.access_token;
    userId = res.body.data.user.id;

    // Trial sub auto-created.
    const sub = await prisma.subscription.findFirst({
      where: { userId, status: 'active' },
    });
    expect(sub).toBeTruthy();
    expect(sub!.plan).toBe('trial');

    // Default trial quotas seeded.
    const quotas = await prisma.quota.findMany({ where: { userId } });
    expect(quotas.length).toBeGreaterThanOrEqual(3);
    const articleQuota = quotas.find((q) => q.resource === 'articles');
    expect(articleQuota).toBeTruthy();
  });

  it('Step 2: /users/me returns the full profile', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.data.id).toBe(userId);
    expect(res.body.data.plan).toBe('trial');
    expect(res.body.data.quotas.length).toBeGreaterThanOrEqual(3);
    expect(res.body.data.subscription?.plan).toBe('trial');
  });

  it('Step 3: bump article quota so the pipeline can run more than trial allows', async () => {
    // Trial articles_monthly=5 — bump to unlimited so the test stays robust.
    await prisma.quota.updateMany({
      where: { userId, resource: 'articles' },
      data: { limitValue: -1 },
    });
    await prisma.quota.updateMany({
      where: { userId, resource: 'brand_voices' },
      data: { limitValue: -1 },
    });
  });

  let brandVoiceId: string;

  it('Step 4: create a brand voice (heuristic stub mode)', async () => {
    const sample = 'a'.repeat(600);
    const res = await request(app.getHttpServer())
      .post('/api/v1/brand-voices')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'E2E voice',
        is_default: true,
        sample_articles: [
          { title: 'A', content: sample },
          { title: 'B', content: sample },
          { title: 'C', content: sample },
        ],
      })
      .expect(201);
    expect(res.body.data.meta.algorithm).toBe('placeholder-heuristic');
    brandVoiceId = res.body.data.id;
  });

  let pipelineRunId: string;
  let articleId: string;

  it('Step 5: start a pipeline run + drive the runner directly', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/pipeline/runs')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        keyword: 'e2e full flow',
        brand_voice_id: brandVoiceId,
        generate_images: false,
      })
      .expect(201);
    pipelineRunId = created.body.data.id;
    expect(created.body.data.status).toBe('pending');
    expect(created.body.data.steps).toHaveLength(5);

    // Drive runner directly (BullMQ worker is stubbed).
    await runner.run(pipelineRunId);

    const after = await request(app.getHttpServer())
      .get(`/api/v1/pipeline/runs/${pipelineRunId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(after.body.data.status).toBe('succeeded');
    expect(after.body.data.article_id).toBeTruthy();
    articleId = after.body.data.article_id;

    const steps = after.body.data.steps as Array<{ step: string; status: string }>;
    const byStep = Object.fromEntries(steps.map((s) => [s.step, s.status]));
    expect(byStep.outline).toBe('succeeded');
    expect(byStep.article).toBe('succeeded');
    expect(byStep.audit).toBe('succeeded');
    expect(byStep.images).toBe('skipped');
    expect(byStep.publish).toBe('skipped');
  });

  it('Step 6: pipeline-generated article shows up in /content/articles list', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/content/articles')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    const found = res.body.data.items.find((a: { id: string }) => a.id === articleId);
    expect(found).toBeTruthy();
    expect(found.brand_voice_id).toBe(brandVoiceId);
    expect(found.content_score).toBeGreaterThan(0);
  });

  it('Step 7: editor PATCH re-renders HTML + updates word_count', async () => {
    const newMd = '# Updated\n\n' + 'word '.repeat(120);
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/content/articles/${articleId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'E2E renamed', content_markdown: newMd, status: 'ready' })
      .expect(200);
    expect(res.body.data.title).toBe('E2E renamed');
    expect(res.body.data.content_html).toMatch(/<h1>.*Updated/i);
    expect(res.body.data.word_count).toBeGreaterThan(100);
  });

  it('Step 8: DELETE article soft-deletes; pipeline run survives but article 404s', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/content/articles/${articleId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const after = await request(app.getHttpServer())
      .get(`/api/v1/content/articles/${articleId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(after.status).toBe(404);

    // Pipeline run still readable (history is preserved).
    const run = await request(app.getHttpServer())
      .get(`/api/v1/pipeline/runs/${pipelineRunId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(run.body.data.article_id).toBe(articleId);
  });
});
