import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => 'a'.repeat(64)) },
        },
      ],
    }).compile();
    strategy = moduleRef.get(JwtStrategy);
  });

  it('maps a TokenPayload to AuthenticatedUser', () => {
    const u = strategy.validate({
      sub: 'u1',
      email: 'a@b.co',
      plan: 'pro',
      role: 'user',
      jti: 'j1',
    });
    expect(u).toEqual({ id: 'u1', email: 'a@b.co', plan: 'pro', role: 'user', jti: 'j1' });
  });
});
