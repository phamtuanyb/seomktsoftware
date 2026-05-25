import { type INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import type { Redis as RedisClient } from 'ioredis';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/services/prisma.service';
import { REDIS_CLIENT } from '../../src/common/services/redis.service';
import { EmailService } from '../../src/modules/auth/services/email.service';

class NoopGuard {
  canActivate(): boolean {
    return true;
  }
}

/**
 * Auth integration — boots the full Nest app against TEST_DATABASE_URL +
 * the dev Redis. Each test starts from a truncated user table.
 */

class CapturingEmailService extends EmailService {
  public lastVerifyToken: string | null = null;
  public lastResetToken: string | null = null;

  override async sendVerifyEmail(_to: string, token: string): Promise<void> {
    this.lastVerifyToken = token;
  }
  override async sendPasswordReset(_to: string, token: string): Promise<void> {
    this.lastResetToken = token;
  }
}

describe('Auth (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisClient;
  let email: CapturingEmailService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmailService)
      .useClass(CapturingEmailService)
      .overrideGuard(ThrottlerGuard)
      .useClass(NoopGuard)
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();

    prisma = moduleRef.get(PrismaService);
    redis = moduleRef.get(REDIS_CLIENT);
    email = moduleRef.get(EmailService) as CapturingEmailService;
  });

  beforeEach(async () => {
    await prisma.truncateAll();
    // Clear any auth: keys lingering from prior runs.
    const keys = await redis.keys('auth:*');
    if (keys.length) await redis.del(...keys);
    email.lastResetToken = null;
    email.lastVerifyToken = null;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/register issues tokens and a trial plan', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'alice@example.com', password: 'P@ssw0rd1', name: 'Alice' })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.user.plan).toBe('trial');
    expect(res.body.data.tokens.access_token).toBeTruthy();
    expect(res.body.data.tokens.refresh_token).toBeTruthy();
    // Quotas seeded
    const quotas = await prisma.quota.findMany({ where: { userId: res.body.data.user.id } });
    expect(quotas).toHaveLength(5);
  });

  it('POST /auth/register rejects duplicate email with 409', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'alice@example.com', password: 'P@ssw0rd1' })
      .expect(201);
    const dup = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'alice@example.com', password: 'P@ssw0rd1' })
      .expect(409);
    expect(dup.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('POST /auth/register validates password complexity', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'alice@example.com', password: 'short' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /auth/login + GET /auth/me roundtrip', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'alice@example.com', password: 'P@ssw0rd1' });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'alice@example.com', password: 'P@ssw0rd1' })
      .expect(200);
    const access = login.body.data.tokens.access_token;
    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${access}`)
      .expect(200);
    expect(me.body.data.email).toBe('alice@example.com');
  });

  it('POST /auth/login rejects wrong password with 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'alice@example.com', password: 'P@ssw0rd1' });
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'alice@example.com', password: 'WrongPw99' })
      .expect(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('GET /auth/me without bearer token returns 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('POST /auth/refresh rotates the refresh token', async () => {
    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'alice@example.com', password: 'P@ssw0rd1' });
    const refresh = reg.body.data.tokens.refresh_token;

    const r1 = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: refresh })
      .expect(200);
    expect(r1.body.data.tokens.refresh_token).not.toBe(refresh);

    // Old refresh token must now be rejected.
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: refresh })
      .expect(401);
  });

  it('POST /auth/logout invalidates refresh token', async () => {
    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'alice@example.com', password: 'P@ssw0rd1' });
    const refresh = reg.body.data.tokens.refresh_token;
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ refresh_token: refresh })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: refresh })
      .expect(401);
  });

  it('POST /auth/forgot-password + /reset-password completes the cycle', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'alice@example.com', password: 'P@ssw0rd1' });
    await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'alice@example.com' })
      .expect(200);
    expect(email.lastResetToken).toBeTruthy();

    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token: email.lastResetToken, password: 'NewP@ssw0rd1' })
      .expect(200);

    // Old password no longer works.
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'alice@example.com', password: 'P@ssw0rd1' })
      .expect(401);
    // New password works.
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'alice@example.com', password: 'NewP@ssw0rd1' })
      .expect(200);
  });

  it('POST /auth/forgot-password is silent (200) for unknown email', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'unknown@example.com' })
      .expect(200);
    expect(email.lastResetToken).toBeNull();
  });

  it('POST /auth/verify-email flips email_verified_at', async () => {
    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'alice@example.com', password: 'P@ssw0rd1' });
    expect(reg.body.data.user.email_verified).toBe(false);
    expect(email.lastVerifyToken).toBeTruthy();

    await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .send({ token: email.lastVerifyToken })
      .expect(200);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'alice@example.com', password: 'P@ssw0rd1' });
    expect(login.body.data.user.email_verified).toBe(true);
  });

  it('POST /auth/reset-password rejects an invalid token with 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token: 'a'.repeat(64), password: 'NewP@ssw0rd1' })
      .expect(400);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });
});
