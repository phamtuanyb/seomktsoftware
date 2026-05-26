import { type INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { uuidv7 } from 'uuidv7';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/services/prisma.service';
import { PipelineRunnerService } from '../../src/modules/pipeline/services/pipeline-runner.service';
import { PipelineProcessor } from '../../src/modules/pipeline/workers/pipeline.processor';

/**
 * Replace the real BullMQ Worker boot with a no-op so the tests can drive
 * PipelineRunnerService.run() directly without racing a worker that would
 * grab the same job off the queue.
 */
class StubPipelineProcessor {
  onModuleInit(): void {}
  async onModuleDestroy(): Promise<void> {}
}

class NoopGuard {
  canActivate(): boolean {
    return true;
  }
}

/**
 * Sprint 15 — pipeline orchestrator integration.
 *
 * We drive PipelineRunnerService directly (skipping the BullMQ worker) so the
 * tests are deterministic and don't depend on a Redis-backed worker race.
 * The HTTP layer is exercised for the surface endpoints (start / list /
 * get / cancel).
 */
describe('Pipeline (integration) — Sprint 15', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let runner: PipelineRunnerService;
  let userId: string;
  let otherId: string;
  let token: string;
  let otherToken: string;

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
    jwt = app.get(JwtService);
    runner = app.get(PipelineRunnerService);
  });

  beforeEach(async () => {
    await prisma.truncateAll();
    const pw = await bcrypt.hash('Test@1', 4);
    userId = uuidv7();
    otherId = uuidv7();
    await prisma.user.createMany({
      data: [
        { id: userId, email: `pl-a-${Date.now()}@test.local`, passwordHash: pw, role: 'user' },
        { id: otherId, email: `pl-b-${Date.now()}@test.local`, passwordHash: pw, role: 'user' },
      ],
    });
    // Each user needs an article quota for QuotaGuard.
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
          userId: otherId,
          resource: 'articles',
          period: 'monthly',
          limitValue: -1,
          used: 0,
        },
      ],
    });
    token = jwt.sign({
      sub: userId,
      email: `pl-a-${Date.now()}@test.local`,
      plan: 'agency',
      role: 'user',
      jti: uuidv7(),
    });
    otherToken = jwt.sign({
      sub: otherId,
      email: `pl-b-${Date.now()}@test.local`,
      plan: 'agency',
      role: 'user',
      jti: uuidv7(),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ----- surface endpoints -----

  describe('POST /pipeline/runs', () => {
    it('creates a row + consumes 1 article quota', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/pipeline/runs')
        .set('Authorization', `Bearer ${token}`)
        .send({ keyword: 'content marketing' })
        .expect(201);

      expect(res.body.data.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(res.body.data.status).toBe('pending');
      expect(res.body.data.keyword).toBe('content marketing');
      // 5 steps initialized (outline, article, audit, images, publish);
      // images=pending (default true), publish=skipped (no site_id).
      expect(res.body.data.steps).toHaveLength(5);
      const publish = res.body.data.steps.find((s: { step: string }) => s.step === 'publish');
      expect(publish.status).toBe('skipped');

      const quota = await prisma.quota.findFirst({
        where: { userId, resource: 'articles' },
      });
      expect(quota!.used).toBe(1);
    });

    it('rejects keyword <2 chars (validation)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/pipeline/runs')
        .set('Authorization', `Bearer ${token}`)
        .send({ keyword: 'x' });
      expect(res.status).toBe(400);
    });

    it('skips images step when generate_images=false', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/pipeline/runs')
        .set('Authorization', `Bearer ${token}`)
        .send({ keyword: 'test no images', generate_images: false })
        .expect(201);
      const images = res.body.data.steps.find((s: { step: string }) => s.step === 'images');
      expect(images.status).toBe('skipped');
    });
  });

  describe('GET /pipeline/runs', () => {
    it("won't leak another user's runs", async () => {
      await request(app.getHttpServer())
        .post('/api/v1/pipeline/runs')
        .set('Authorization', `Bearer ${token}`)
        .send({ keyword: 'mine' })
        .expect(201);
      const res = await request(app.getHttpServer())
        .get('/api/v1/pipeline/runs')
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200);
      expect(res.body.data.items).toHaveLength(0);
    });

    it('filters by status', async () => {
      const create = await request(app.getHttpServer())
        .post('/api/v1/pipeline/runs')
        .set('Authorization', `Bearer ${token}`)
        .send({ keyword: 'foo' })
        .expect(201);
      // Manually mark one succeeded so the filter has something to find.
      await prisma.pipelineRun.update({
        where: { id: create.body.data.id },
        data: { status: 'succeeded' },
      });
      const res = await request(app.getHttpServer())
        .get('/api/v1/pipeline/runs?status=succeeded')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].status).toBe('succeeded');
    });
  });

  describe('GET /pipeline/runs/:id', () => {
    it('returns the run for owner', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/pipeline/runs')
        .set('Authorization', `Bearer ${token}`)
        .send({ keyword: 'detail test' })
        .expect(201);
      const res = await request(app.getHttpServer())
        .get(`/api/v1/pipeline/runs/${created.body.data.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.data.id).toBe(created.body.data.id);
    });

    it('returns 404 for cross-user', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/pipeline/runs')
        .set('Authorization', `Bearer ${token}`)
        .send({ keyword: 'secret' })
        .expect(201);
      const res = await request(app.getHttpServer())
        .get(`/api/v1/pipeline/runs/${created.body.data.id}`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /pipeline/runs/:id/cancel', () => {
    it('cancels a pending run', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/pipeline/runs')
        .set('Authorization', `Bearer ${token}`)
        .send({ keyword: 'cancel me' })
        .expect(201);
      const res = await request(app.getHttpServer())
        .post(`/api/v1/pipeline/runs/${created.body.data.id}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.data.status).toBe('cancelled');
    });

    it('400 when run already in terminal status', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/pipeline/runs')
        .set('Authorization', `Bearer ${token}`)
        .send({ keyword: 'done' })
        .expect(201);
      await prisma.pipelineRun.update({
        where: { id: created.body.data.id },
        data: { status: 'succeeded' },
      });
      const res = await request(app.getHttpServer())
        .post(`/api/v1/pipeline/runs/${created.body.data.id}/cancel`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });
  });

  // ----- runner end-to-end (drive directly, skip BullMQ) -----

  describe('PipelineRunnerService.run', () => {
    it('walks outline → article → audit with stub providers + persists article', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/pipeline/runs')
        .set('Authorization', `Bearer ${token}`)
        .send({
          keyword: 'pipeline end to end',
          generate_images: false,
          // No site_id → publish step skipped.
        })
        .expect(201);
      const runId = created.body.data.id as string;

      await runner.run(runId);

      const final = await prisma.pipelineRun.findUnique({ where: { id: runId } });
      expect(final!.status).toBe('succeeded');
      expect(final!.articleId).toBeTruthy();
      expect(final!.startedAt).not.toBeNull();
      expect(final!.completedAt).not.toBeNull();

      const steps = final!.stepsJson as Array<{
        step: string;
        status: string;
        details?: Record<string, unknown>;
      }>;
      const byName = Object.fromEntries(steps.map((s) => [s.step, s]));
      expect(byName.outline!.status).toBe('succeeded');
      expect(byName.article!.status).toBe('succeeded');
      expect(byName.audit!.status).toBe('succeeded');
      expect(byName.images!.status).toBe('skipped');
      expect(byName.publish!.status).toBe('skipped');

      // Article row exists + belongs to the user.
      const article = await prisma.article.findUnique({ where: { id: final!.articleId! } });
      expect(article!.userId).toBe(userId);
      expect(typeof byName.article!.details!.word_count).toBe('number');
      expect(byName.audit!.details!.overall_score).toBeGreaterThan(0);
    });

    it('does not run if the row was cancelled before pickup', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/pipeline/runs')
        .set('Authorization', `Bearer ${token}`)
        .send({ keyword: 'pre-cancelled', generate_images: false })
        .expect(201);
      const runId = created.body.data.id as string;
      await prisma.pipelineRun.update({ where: { id: runId }, data: { status: 'cancelled' } });

      await runner.run(runId);

      const final = await prisma.pipelineRun.findUnique({ where: { id: runId } });
      expect(final!.status).toBe('cancelled');
      expect(final!.articleId).toBeNull();
    });
  });
});
