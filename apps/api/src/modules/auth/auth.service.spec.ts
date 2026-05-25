import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { TokenService } from './services/token.service';
import { EmailService } from './services/email.service';
import { PrismaService } from '../../common/services/prisma.service';
import { EventBusService } from '../../common/services/event-bus.service';

type Mock<T> = { [K in keyof T]?: jest.Mock };

const userRow = {
  id: '019e5dd2-0000-7000-8000-000000000001',
  email: 'user@example.com',
  passwordHash: 'hash',
  name: 'Test',
  avatarUrl: null,
  role: 'user',
  emailVerifiedAt: null,
  deletedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

function makePrismaMock(): Mock<PrismaService> & {
  user: {
    findUnique: jest.Mock;
    update: jest.Mock;
    create: jest.Mock;
  };
  subscription: { findFirst: jest.Mock; create: jest.Mock };
  quota: { create: jest.Mock };
  $transaction: jest.Mock;
} {
  return {
    user: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
    subscription: { findFirst: jest.fn(), create: jest.fn() },
    quota: { create: jest.fn() },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn({} as unknown)),
  } as never;
}

describe('AuthService', () => {
  let svc: AuthService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let tokens: {
    issueTokens: jest.Mock;
    verifyRefreshToken: jest.Mock;
    revokeRefreshToken: jest.Mock;
    revokeAllRefreshTokensForUser: jest.Mock;
    createPasswordResetToken: jest.Mock;
    consumePasswordResetToken: jest.Mock;
    createEmailVerifyToken: jest.Mock;
    consumeEmailVerifyToken: jest.Mock;
  };
  let email: { sendVerifyEmail: jest.Mock; sendPasswordReset: jest.Mock };
  let eventBus: { emit: jest.Mock };

  beforeEach(async () => {
    prisma = makePrismaMock();
    tokens = {
      issueTokens: jest
        .fn()
        .mockResolvedValue({ access_token: 'a', refresh_token: 'r', expires_in: 900 }),
      verifyRefreshToken: jest.fn(),
      revokeRefreshToken: jest.fn(),
      revokeAllRefreshTokensForUser: jest.fn(),
      createPasswordResetToken: jest.fn().mockResolvedValue('reset-token'),
      consumePasswordResetToken: jest.fn(),
      createEmailVerifyToken: jest.fn().mockResolvedValue('verify-token'),
      consumeEmailVerifyToken: jest.fn(),
    };
    email = {
      sendVerifyEmail: jest.fn().mockResolvedValue(undefined),
      sendPasswordReset: jest.fn().mockResolvedValue(undefined),
    };
    eventBus = { emit: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: TokenService, useValue: tokens },
        { provide: EmailService, useValue: email },
        { provide: EventBusService, useValue: eventBus },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => (key === 'jwt.bcryptRounds' ? 4 : null)) },
        },
      ],
    }).compile();

    svc = module.get(AuthService);
  });

  describe('register', () => {
    it('creates a user + trial subscription + 5 quota rows + issues tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(userRow);
      prisma.subscription.create.mockResolvedValue({});
      prisma.quota.create.mockResolvedValue({});
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
        fn({
          user: prisma.user,
          subscription: prisma.subscription,
          quota: prisma.quota,
        }),
      );

      const res = await svc.register({ email: 'user@example.com', password: 'P@ssw0rd1' });

      expect(res.user.plan).toBe('trial');
      expect(res.tokens.access_token).toBe('a');
      expect(prisma.subscription.create).toHaveBeenCalled();
      expect(prisma.quota.create).toHaveBeenCalledTimes(5);
      expect(email.sendVerifyEmail).toHaveBeenCalledWith('user@example.com', 'verify-token');
      expect(eventBus.emit).toHaveBeenCalledWith(
        'user.registered',
        expect.objectContaining({ email: 'user@example.com' }),
      );
    });

    it('throws ConflictException when email exists', async () => {
      prisma.user.findUnique.mockResolvedValue(userRow);
      await expect(
        svc.register({ email: 'user@example.com', password: 'P@ssw0rd1' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('swallows email dispatch failure (registration must not block)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(userRow);
      prisma.subscription.create.mockResolvedValue({});
      prisma.quota.create.mockResolvedValue({});
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
        fn({ user: prisma.user, subscription: prisma.subscription, quota: prisma.quota }),
      );
      email.sendVerifyEmail.mockRejectedValueOnce(new Error('SMTP down'));

      const res = await svc.register({ email: 'user@example.com', password: 'P@ssw0rd1' });
      expect(res.user.email).toBe('user@example.com');
    });
  });

  describe('login', () => {
    it('returns tokens on correct credentials', async () => {
      const password = 'P@ssw0rd1';
      const passwordHash = await bcrypt.hash(password, 4);
      prisma.user.findUnique.mockResolvedValue({ ...userRow, passwordHash });
      prisma.subscription.findFirst.mockResolvedValue({
        plan: 'pro',
        expiresAt: null,
        status: 'active',
      });

      const res = await svc.login({ email: userRow.email, password });
      expect(res.user.plan).toBe('pro');
      expect(tokens.issueTokens).toHaveBeenCalledWith(
        expect.objectContaining({ id: userRow.id, plan: 'pro' }),
      );
    });

    it('rejects unknown email with 401', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        svc.login({ email: 'unknown@example.com', password: 'x' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects wrong password with 401', async () => {
      const passwordHash = await bcrypt.hash('right-pw', 4);
      prisma.user.findUnique.mockResolvedValue({ ...userRow, passwordHash });
      await expect(
        svc.login({ email: userRow.email, password: 'wrong-pw' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects soft-deleted user with 401', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...userRow, deletedAt: new Date() });
      await expect(svc.login({ email: userRow.email, password: 'x' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('downgrades to trial when active subscription is expired', async () => {
      const passwordHash = await bcrypt.hash('p', 4);
      prisma.user.findUnique.mockResolvedValue({ ...userRow, passwordHash });
      prisma.subscription.findFirst.mockResolvedValue({
        plan: 'pro',
        expiresAt: new Date(Date.now() - 86_400_000),
        status: 'active',
      });
      const res = await svc.login({ email: userRow.email, password: 'p' });
      expect(res.user.plan).toBe('trial');
    });
  });

  describe('refresh', () => {
    it('rotates the refresh token on success', async () => {
      tokens.verifyRefreshToken.mockResolvedValue({
        sub: userRow.id,
        email: userRow.email,
        plan: 'pro',
        role: 'user',
        jti: 'jti-1',
      });
      await svc.refresh('refresh-token');
      expect(tokens.revokeRefreshToken).toHaveBeenCalledWith('jti-1');
      expect(tokens.issueTokens).toHaveBeenCalled();
    });

    it('maps REFRESH_REVOKED to UnauthorizedException', async () => {
      tokens.verifyRefreshToken.mockRejectedValue(new Error('REFRESH_REVOKED'));
      await expect(svc.refresh('x')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('maps jwt expired to UnauthorizedException', async () => {
      tokens.verifyRefreshToken.mockRejectedValue(new Error('jwt expired'));
      await expect(svc.refresh('x')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('revokes the supplied refresh token', async () => {
      tokens.verifyRefreshToken.mockResolvedValue({ jti: 'jti-2' });
      await svc.logout('refresh-token');
      expect(tokens.revokeRefreshToken).toHaveBeenCalledWith('jti-2');
    });

    it('is silent when refresh token is missing', async () => {
      await svc.logout(undefined);
      expect(tokens.revokeRefreshToken).not.toHaveBeenCalled();
    });

    it('is silent when refresh token is already invalid', async () => {
      tokens.verifyRefreshToken.mockRejectedValue(new Error('jwt malformed'));
      await expect(svc.logout('bad-token')).resolves.toBeUndefined();
    });
  });

  describe('forgotPassword', () => {
    it('emails a reset link when user exists', async () => {
      prisma.user.findUnique.mockResolvedValue(userRow);
      await svc.forgotPassword(userRow.email);
      expect(email.sendPasswordReset).toHaveBeenCalledWith(userRow.email, 'reset-token');
    });

    it('is silent (no leak) when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await svc.forgotPassword('unknown@example.com');
      expect(email.sendPasswordReset).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('hashes the new password + revokes every refresh token', async () => {
      tokens.consumePasswordResetToken.mockResolvedValue(userRow.id);
      prisma.user.update.mockResolvedValue(userRow);
      await svc.resetPassword('valid-token', 'NewP@ssw0rd1');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: userRow.id },
          data: expect.objectContaining({ passwordHash: expect.any(String) }),
        }),
      );
      expect(tokens.revokeAllRefreshTokensForUser).toHaveBeenCalledWith(userRow.id);
    });

    it('throws BadRequest on invalid token', async () => {
      tokens.consumePasswordResetToken.mockResolvedValue(null);
      await expect(svc.resetPassword('bad', 'P@ssw0rd1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('verifyEmail', () => {
    it('marks the user as verified', async () => {
      tokens.consumeEmailVerifyToken.mockResolvedValue(userRow.id);
      prisma.user.update.mockResolvedValue(userRow);
      await svc.verifyEmail('valid-token');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { emailVerifiedAt: expect.any(Date) } }),
      );
    });

    it('throws BadRequest on invalid token', async () => {
      tokens.consumeEmailVerifyToken.mockResolvedValue(null);
      await expect(svc.verifyEmail('bad')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('me', () => {
    it('returns the current user profile', async () => {
      prisma.user.findUnique.mockResolvedValue(userRow);
      prisma.subscription.findFirst.mockResolvedValue(null);
      const me = await svc.me(userRow.id);
      expect(me.email).toBe(userRow.email);
      expect(me.plan).toBe('trial');
    });

    it('throws NotFound for missing user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(svc.me('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
