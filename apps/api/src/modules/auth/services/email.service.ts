import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Sprint 1 ships in stub mode: SENDGRID_API_KEY is empty → log to console and
 * return ok. Production replaces this with a real SendGrid integration in
 * Sprint 3. Keep the same public surface so the rest of the auth code is
 * unaware of the backing transport.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly cfg: ConfigService) {}

  private get stubMode(): boolean {
    const key = this.cfg.get<string>('SENDGRID_API_KEY') ?? process.env.SENDGRID_API_KEY ?? '';
    return key.length === 0;
  }

  async sendVerifyEmail(to: string, token: string): Promise<void> {
    const url = `${this.cfg.get<string>('app.appUrl')}/verify-email?token=${token}`;
    if (this.stubMode) {
      this.logger.warn(`[EMAIL STUB] To: ${to}`);
      this.logger.warn(`[EMAIL STUB] Subject: Xác thực email MKT SEO AI`);
      this.logger.warn(`[EMAIL STUB] Verify URL: ${url}`);
      return;
    }
    // Real SendGrid integration deferred to Sprint 3.
    this.logger.error('SendGrid integration not yet wired — falling back to log');
    this.logger.warn(`Verify URL for ${to}: ${url}`);
  }

  async sendPasswordReset(to: string, token: string): Promise<void> {
    const url = `${this.cfg.get<string>('app.appUrl')}/reset-password?token=${token}`;
    if (this.stubMode) {
      this.logger.warn(`[EMAIL STUB] To: ${to}`);
      this.logger.warn(`[EMAIL STUB] Subject: Đặt lại mật khẩu MKT SEO AI`);
      this.logger.warn(`[EMAIL STUB] Reset URL: ${url}`);
      return;
    }
    this.logger.error('SendGrid integration not yet wired — falling back to log');
    this.logger.warn(`Reset URL for ${to}: ${url}`);
  }
}
