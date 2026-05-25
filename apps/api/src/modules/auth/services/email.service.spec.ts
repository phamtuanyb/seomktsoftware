import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

describe('EmailService (stub mode)', () => {
  let svc: EmailService;
  const cfg = {
    get: jest.fn((key: string) => (key === 'app.appUrl' ? 'http://localhost:3006' : '')),
  };

  beforeEach(async () => {
    process.env.SENDGRID_API_KEY = '';
    const moduleRef = await Test.createTestingModule({
      providers: [EmailService, { provide: ConfigService, useValue: cfg }],
    }).compile();
    svc = moduleRef.get(EmailService);
  });

  it('logs a verify URL when SENDGRID_API_KEY is empty', async () => {
    const warn = jest.spyOn(svc['logger'], 'warn').mockImplementation(() => undefined);
    await svc.sendVerifyEmail('a@b.co', 'tok-1');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('http://localhost:3006/verify-email?token=tok-1'),
    );
  });

  it('logs a reset URL when SENDGRID_API_KEY is empty', async () => {
    const warn = jest.spyOn(svc['logger'], 'warn').mockImplementation(() => undefined);
    await svc.sendPasswordReset('a@b.co', 'tok-2');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('reset-password?token=tok-2'));
  });
});
