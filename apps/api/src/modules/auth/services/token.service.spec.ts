import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';
import { REDIS_CLIENT } from '../../../common/services/redis.service';

interface RedisMock {
  set: jest.Mock;
  get: jest.Mock;
  del: jest.Mock;
  exists: jest.Mock;
  scan: jest.Mock;
  mget: jest.Mock;
}

describe('TokenService', () => {
  let svc: TokenService;
  let redis: RedisMock;
  let jwt: { sign: jest.Mock; verify: jest.Mock };

  beforeEach(async () => {
    redis = {
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn(),
      del: jest.fn().mockResolvedValue(1),
      exists: jest.fn(),
      scan: jest.fn(),
      mget: jest.fn(),
    };
    jwt = {
      sign: jest.fn(
        (_payload, opts: { expiresIn?: string } = {}) => `signed.${opts.expiresIn ?? 'default'}`,
      ),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: JwtService, useValue: jwt },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((k: string) =>
              k === 'jwt.accessExpiresIn' ? '15m' : k === 'jwt.refreshExpiresIn' ? '30d' : null,
            ),
          },
        },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();
    svc = module.get(TokenService);
  });

  describe('issueTokens', () => {
    it('signs an access + refresh pair and persists the refresh jti in Redis', async () => {
      const result = await svc.issueTokens({
        id: 'u1',
        email: 'a@b.c',
        plan: 'pro',
        role: 'user',
      });
      expect(result.access_token).toMatch(/^signed\./);
      expect(result.refresh_token).toMatch(/^signed\./);
      expect(result.expires_in).toBe(900);
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^auth:refresh:/),
        expect.stringContaining('"userId":"u1"'),
        'EX',
        30 * 86400,
      );
    });
  });

  describe('verifyRefreshToken', () => {
    it('returns payload when JWT valid AND Redis session exists', async () => {
      jwt.verify.mockReturnValue({
        sub: 'u1',
        email: 'a@b.c',
        plan: 'pro',
        role: 'user',
        jti: 'j1',
      });
      redis.exists.mockResolvedValue(1);
      const payload = await svc.verifyRefreshToken('rt');
      expect(payload.jti).toBe('j1');
    });

    it('throws REFRESH_REVOKED when Redis session was deleted', async () => {
      jwt.verify.mockReturnValue({
        sub: 'u1',
        email: 'a@b.c',
        plan: 'pro',
        role: 'user',
        jti: 'j2',
      });
      redis.exists.mockResolvedValue(0);
      await expect(svc.verifyRefreshToken('rt')).rejects.toThrow('REFRESH_REVOKED');
    });
  });

  describe('revokeAllRefreshTokensForUser', () => {
    it('deletes only the keys belonging to the user', async () => {
      redis.scan.mockResolvedValueOnce(['0', ['auth:refresh:j1', 'auth:refresh:j2']]);
      redis.mget.mockResolvedValueOnce([
        JSON.stringify({ userId: 'u1', issuedAt: 1 }),
        JSON.stringify({ userId: 'u2', issuedAt: 1 }),
      ]);
      await svc.revokeAllRefreshTokensForUser('u1');
      expect(redis.del).toHaveBeenCalledWith('auth:refresh:j1');
    });

    it('handles malformed values gracefully', async () => {
      redis.scan.mockResolvedValueOnce(['0', ['auth:refresh:bad']]);
      redis.mget.mockResolvedValueOnce(['not-json']);
      await expect(svc.revokeAllRefreshTokensForUser('u1')).resolves.toBeUndefined();
    });
  });

  describe('password reset token', () => {
    it('creates → consumes → cannot be consumed twice', async () => {
      const raw = await svc.createPasswordResetToken('u1');
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^auth:reset:/),
        'u1',
        'EX',
        3600,
      );
      // Simulate Redis returning the userId on first GET then nothing on the next.
      redis.get.mockResolvedValueOnce('u1');
      redis.get.mockResolvedValueOnce(null);
      expect(await svc.consumePasswordResetToken(raw)).toBe('u1');
      expect(await svc.consumePasswordResetToken(raw)).toBeNull();
    });
  });

  describe('email verify token', () => {
    it('roundtrips a token then invalidates it', async () => {
      const raw = await svc.createEmailVerifyToken('u1');
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^auth:verify:/),
        'u1',
        'EX',
        86400,
      );
      redis.get.mockResolvedValueOnce('u1');
      expect(await svc.consumeEmailVerifyToken(raw)).toBe('u1');
    });
  });
});
