import { createHmac } from 'node:crypto';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { type INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { uuidv7 } from 'uuidv7';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/services/prisma.service';
import { WebhookDeliveryRunner } from '../../src/modules/webhooks/services/webhook-delivery-runner.service';
import { WebhooksService } from '../../src/modules/webhooks/services/webhooks.service';
import { EventBusService } from '../../src/common/services/event-bus.service';

class NoopGuard {
  canActivate(): boolean {
    return true;
  }
}

/** Spins up a local HTTP server that captures every POST. */
function makeReceiver(
  responder: (req: http.IncomingMessage, body: string) => { status: number; body: string },
): Promise<{
  url: string;
  received: Array<{ headers: http.IncomingHttpHeaders; body: string }>;
  close: () => Promise<void>;
}> {
  return new Promise((resolve) => {
    const received: Array<{ headers: http.IncomingHttpHeaders; body: string }> = [];
    const server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        received.push({ headers: req.headers, body });
        const reply = responder(req, body);
        res.writeHead(reply.status, { 'Content-Type': 'application/json' });
        res.end(reply.body);
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${addr.port}/hook`,
        received,
        close: () => new Promise((res) => server.close(() => res())),
      });
    });
  });
}

/**
 * Sprint 13 — outgoing webhooks. The BullMQ worker is wired up to Redis
 * but tests skip it: we call WebhookDeliveryRunner.run directly with the
 * delivery_id so we never depend on a worker race.
 */
describe('Webhooks (integration) — Sprint 13', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let runner: WebhookDeliveryRunner;
  let webhooksService: WebhooksService;
  let eventBus: EventBusService;
  let userId: string;
  let otherUserId: string;
  let userToken: string;
  let otherToken: string;

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
    runner = app.get(WebhookDeliveryRunner);
    webhooksService = app.get(WebhooksService);
    eventBus = app.get(EventBusService);
  });

  beforeEach(async () => {
    await prisma.truncateAll();
    const pw = await bcrypt.hash('Test@1', 4);
    userId = uuidv7();
    otherUserId = uuidv7();
    await prisma.user.createMany({
      data: [
        { id: userId, email: `wh-a-${Date.now()}@test.local`, passwordHash: pw, role: 'user' },
        { id: otherUserId, email: `wh-b-${Date.now()}@test.local`, passwordHash: pw, role: 'user' },
      ],
    });
    userToken = jwtService.sign({
      sub: userId,
      email: `wh-a-${Date.now()}@test.local`,
      plan: 'pro',
      role: 'user',
      jti: uuidv7(),
    });
    otherToken = jwtService.sign({
      sub: otherUserId,
      email: `wh-b-${Date.now()}@test.local`,
      plan: 'pro',
      role: 'user',
      jti: uuidv7(),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ----- CRUD -----

  describe('POST /webhooks', () => {
    it('creates with auto-generated secret, returned once', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/webhooks')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ url: 'https://example.com/hook', events: ['article.completed'] })
        .expect(201);
      expect(res.body.data.url).toBe('https://example.com/hook');
      expect(res.body.data.events).toEqual(['article.completed']);
      expect(res.body.data.secret).toMatch(/^whsec_/);
      expect(res.body.data.has_secret).toBe(true);
      expect(res.body.data.is_active).toBe(true);

      // Subsequent GET hides the secret.
      const getRes = await request(app.getHttpServer())
        .get(`/api/v1/webhooks/${res.body.data.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      expect(getRes.body.data.secret).toBeUndefined();
      expect(getRes.body.data.has_secret).toBe(true);
    });

    it('rejects non-https URL', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/webhooks')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ url: 'http://example.com/hook', events: ['article.completed'] });
      expect(res.status).toBe(400);
    });

    it('rejects unknown event names', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/webhooks')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ url: 'https://example.com/hook', events: ['definitely.not.an.event'] });
      expect(res.status).toBe(400);
    });

    it('rejects empty events array', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/webhooks')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ url: 'https://example.com/hook', events: [] });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /webhooks + multi-tenant', () => {
    it("won't leak another user's webhook", async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/webhooks')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ url: 'https://example.com/private', events: ['article.completed'] })
        .expect(201);
      const id = res.body.data.id as string;

      const otherList = await request(app.getHttpServer())
        .get('/api/v1/webhooks')
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200);
      expect(otherList.body.data).toHaveLength(0);

      const otherGet = await request(app.getHttpServer())
        .get(`/api/v1/webhooks/${id}`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(otherGet.status).toBe(404);
    });
  });

  describe('PATCH /webhooks/:id', () => {
    it('rotates secret + disables webhook', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/webhooks')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ url: 'https://example.com/hook', events: ['article.completed'] })
        .expect(201);
      const id = res.body.data.id as string;
      const newSecret = 'whsec_' + 'x'.repeat(20);
      const patched = await request(app.getHttpServer())
        .patch(`/api/v1/webhooks/${id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ secret: newSecret, is_active: false })
        .expect(200);
      expect(patched.body.data.secret).toBe(newSecret);
      expect(patched.body.data.is_active).toBe(false);
    });
  });

  describe('DELETE /webhooks/:id', () => {
    it('hard-deletes + cascades deliveries', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/webhooks')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ url: 'https://example.com/hook', events: ['article.completed'] })
        .expect(201);
      const id = res.body.data.id as string;
      // Seed a delivery so we can verify cascade.
      await prisma.webhookDelivery.create({
        data: {
          id: uuidv7(),
          webhookId: id,
          event: 'article.completed',
          payloadJson: { x: 1 },
          attemptCount: 0,
        },
      });
      await request(app.getHttpServer())
        .delete(`/api/v1/webhooks/${id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      const remaining = await prisma.webhookDelivery.count({ where: { webhookId: id } });
      expect(remaining).toBe(0);
    });
  });

  // ----- HMAC signing (pure unit-style) -----

  describe('HMAC signing', () => {
    it('matches the Node crypto reference', () => {
      const sig = WebhooksService.signPayload('topsecret', '{"hello":"world"}');
      const ref = createHmac('sha256', 'topsecret').update('{"hello":"world"}').digest('hex');
      expect(sig).toBe(ref);
    });
  });

  // ----- delivery runner -----

  describe('WebhookDeliveryRunner.run', () => {
    it('POSTs the payload with signature header + marks delivered on 200', async () => {
      const receiver = await makeReceiver(() => ({ status: 200, body: '{"ok":true}' }));
      try {
        const create = await request(app.getHttpServer())
          .post('/api/v1/webhooks')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ url: receiver.url, events: ['article.completed'] })
          .expect(201);
        const webhookId = create.body.data.id as string;
        const secret = create.body.data.secret as string;

        const deliveryId = uuidv7();
        await prisma.webhookDelivery.create({
          data: {
            id: deliveryId,
            webhookId,
            event: 'article.completed',
            payloadJson: { hello: 'world' },
            attemptCount: 0,
          },
        });

        await runner.run(deliveryId, 0);

        expect(receiver.received).toHaveLength(1);
        const got = receiver.received[0]!;
        expect(got.headers['x-mkt-event']).toBe('article.completed');
        expect(got.headers['x-mkt-delivery']).toBe(deliveryId);
        const sigHeader = got.headers['x-mkt-signature'] as string;
        expect(sigHeader.startsWith('sha256=')).toBe(true);
        const expected = WebhooksService.signPayload(secret, got.body);
        expect(sigHeader).toBe(`sha256=${expected}`);

        const row = await prisma.webhookDelivery.findUnique({ where: { id: deliveryId } });
        expect(row!.responseStatus).toBe(200);
        expect(row!.deliveredAt).not.toBeNull();
        expect(row!.attemptCount).toBe(1);
      } finally {
        await receiver.close();
      }
    });

    it('throws and marks failure on 5xx (BullMQ retries)', async () => {
      const receiver = await makeReceiver(() => ({ status: 503, body: 'busy' }));
      try {
        const create = await request(app.getHttpServer())
          .post('/api/v1/webhooks')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ url: receiver.url, events: ['article.completed'] })
          .expect(201);
        const webhookId = create.body.data.id as string;
        const deliveryId = uuidv7();
        await prisma.webhookDelivery.create({
          data: {
            id: deliveryId,
            webhookId,
            event: 'article.completed',
            payloadJson: {},
            attemptCount: 0,
          },
        });

        await expect(runner.run(deliveryId, 0)).rejects.toThrow(/HTTP 503/);
        const row = await prisma.webhookDelivery.findUnique({ where: { id: deliveryId } });
        expect(row!.responseStatus).toBe(503);
        expect(row!.deliveredAt).toBeNull();
      } finally {
        await receiver.close();
      }
    });

    it('throws UnrecoverableError on 4xx (no retry)', async () => {
      const receiver = await makeReceiver(() => ({ status: 410, body: 'gone' }));
      try {
        const create = await request(app.getHttpServer())
          .post('/api/v1/webhooks')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ url: receiver.url, events: ['article.completed'] })
          .expect(201);
        const webhookId = create.body.data.id as string;
        const deliveryId = uuidv7();
        await prisma.webhookDelivery.create({
          data: {
            id: deliveryId,
            webhookId,
            event: 'article.completed',
            payloadJson: {},
            attemptCount: 0,
          },
        });

        const err = (await runner.run(deliveryId, 0).catch((e: Error) => e)) as Error;
        expect(err.constructor.name).toBe('UnrecoverableError');
        const row = await prisma.webhookDelivery.findUnique({ where: { id: deliveryId } });
        expect(row!.responseStatus).toBe(410);
      } finally {
        await receiver.close();
      }
    });
  });

  // ----- dispatcher (event-bus → enqueue) -----

  describe('event dispatcher → enqueue', () => {
    it('creates a delivery row for each subscribed webhook when event fires', async () => {
      const receiver = await makeReceiver(() => ({ status: 200, body: 'ok' }));
      try {
        // Two subscribers, one matching the event, one for a different event.
        const matched = await request(app.getHttpServer())
          .post('/api/v1/webhooks')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ url: receiver.url, events: ['article.completed'] })
          .expect(201);
        await request(app.getHttpServer())
          .post('/api/v1/webhooks')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ url: 'https://example.com/other', events: ['publish.failed'] })
          .expect(201);

        // Fire the event directly through the service (skips BullMQ).
        await webhooksService.dispatchEvent('article.completed', { article_id: 'abc' });

        const matchedDeliveries = await prisma.webhookDelivery.findMany({
          where: { webhookId: matched.body.data.id },
        });
        expect(matchedDeliveries).toHaveLength(1);
        expect(matchedDeliveries[0]!.event).toBe('article.completed');

        const otherDeliveries = await prisma.webhookDelivery.findMany({
          where: { event: 'publish.failed' },
        });
        expect(otherDeliveries).toHaveLength(0);
      } finally {
        await receiver.close();
      }
    });

    it('inactive webhooks are skipped by the dispatcher', async () => {
      const create = await request(app.getHttpServer())
        .post('/api/v1/webhooks')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ url: 'https://example.com/hook', events: ['article.completed'] })
        .expect(201);
      await request(app.getHttpServer())
        .patch(`/api/v1/webhooks/${create.body.data.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ is_active: false })
        .expect(200);

      await webhooksService.dispatchEvent('article.completed', { x: 1 });
      const deliveries = await prisma.webhookDelivery.count({
        where: { webhookId: create.body.data.id },
      });
      expect(deliveries).toBe(0);
    });

    it('EventBusService emit also triggers dispatcher (via @OnEvent)', async () => {
      const create = await request(app.getHttpServer())
        .post('/api/v1/webhooks')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ url: 'https://example.com/hook', events: ['brand_voice.trained'] })
        .expect(201);

      await eventBus.emit('brand_voice.trained', { brand_voice_id: 'bv1' });
      // The handler is async; give the listener a tick to settle.
      await new Promise((r) => setTimeout(r, 50));

      const deliveries = await prisma.webhookDelivery.findMany({
        where: { webhookId: create.body.data.id },
      });
      expect(deliveries).toHaveLength(1);
      expect(deliveries[0]!.event).toBe('brand_voice.trained');
    });
  });

  // ----- POST /webhooks/:id/test -----

  describe('POST /webhooks/:id/test', () => {
    it('enqueues a webhook.test delivery row', async () => {
      const create = await request(app.getHttpServer())
        .post('/api/v1/webhooks')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ url: 'https://example.com/hook', events: ['article.completed'] })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/webhooks/${create.body.data.id}/test`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(201);
      expect(res.body.data.delivery_id).toBeTruthy();

      const row = await prisma.webhookDelivery.findUnique({
        where: { id: res.body.data.delivery_id },
      });
      expect(row!.event).toBe('webhook.test');
    });

    it('400 when webhook is disabled', async () => {
      const create = await request(app.getHttpServer())
        .post('/api/v1/webhooks')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ url: 'https://example.com/hook', events: ['article.completed'] })
        .expect(201);
      await request(app.getHttpServer())
        .patch(`/api/v1/webhooks/${create.body.data.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ is_active: false })
        .expect(200);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/webhooks/${create.body.data.id}/test`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(400);
    });
  });
});
