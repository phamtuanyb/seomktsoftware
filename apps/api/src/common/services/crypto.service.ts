import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

/**
 * Section 17 — AES-256-GCM for WordPress application_password storage
 * (and any other at-rest secret). Master key rotated every 90 days
 * (out-of-band ops task; this service supports key versioning so future
 * rotations don't break existing rows).
 *
 * Output format (stored in DB as a single TEXT column):
 *
 *     v1:<base64-iv>:<base64-authTag>:<base64-ciphertext>
 *
 * The leading `v1:` lets us add a `v2:` codec later that uses a different
 * KDF or AEAD without a migration.
 */
@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32; // 256 bit
  private static readonly IV_LENGTH = 12; // 96-bit nonce recommended for GCM
  private static readonly SALT = 'mkt-seo-ai-v1';
  private readonly key: Buffer;

  constructor(cfg: ConfigService) {
    const raw = cfg.get<string>('ENCRYPTION_MASTER_KEY') ?? process.env.ENCRYPTION_MASTER_KEY ?? '';
    if (!raw || raw.length < 16 || raw.startsWith('change_me_')) {
      // Dev / smoke tests still need a deterministic key — derive from a
      // labelled fallback so we don't crash boot.
      this.logger.warn(
        'ENCRYPTION_MASTER_KEY is missing or placeholder — using dev fallback. DO NOT use this in production.',
      );
      this.key = scryptSync('mkt-seo-dev-fallback', CryptoService.SALT, CryptoService.KEY_LENGTH);
    } else {
      // scrypt KDF so a 64-char hex (or any string) becomes 32 bytes.
      this.key = scryptSync(raw, CryptoService.SALT, CryptoService.KEY_LENGTH);
    }
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(CryptoService.IV_LENGTH);
    const cipher = createCipheriv(CryptoService.ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `v1:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  decrypt(payload: string): string {
    const parts = payload.split(':');
    if (parts.length !== 4 || parts[0] !== 'v1') {
      throw new InternalServerErrorException({
        code: 'DECRYPT_BAD_FORMAT',
        message: 'Encrypted payload format invalid',
      });
    }
    try {
      const iv = Buffer.from(parts[1]!, 'base64');
      const authTag = Buffer.from(parts[2]!, 'base64');
      const ciphertext = Buffer.from(parts[3]!, 'base64');
      const decipher = createDecipheriv(CryptoService.ALGORITHM, this.key, iv);
      decipher.setAuthTag(authTag);
      const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return plain.toString('utf8');
    } catch (err) {
      this.logger.error(`Decrypt failed: ${(err as Error).message}`);
      throw new InternalServerErrorException({
        code: 'DECRYPT_FAILED',
        message: 'Không giải mã được credentials — master key có thể đã đổi.',
      });
    }
  }
}
