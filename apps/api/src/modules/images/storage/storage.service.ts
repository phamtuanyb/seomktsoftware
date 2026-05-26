import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { isPlaceholderToken } from '../providers/image-provider.interface';

export interface UploadInput {
  /** Buffer to upload. */
  bytes: Buffer;
  /** Key (path) within the bucket — already namespaced (e.g. images/userId/uuid.png). */
  key: string;
  contentType: string;
  /** Optional original/source URL — when set + storage is in stub mode, we return it as-is. */
  fallbackUrl?: string;
}

export interface UploadResult {
  url: string;
  key: string;
  size_bytes: number;
  is_stub: boolean;
}

/**
 * Section 4 — Cloudflare R2 (S3-compatible). Section 13 — credentials via env.
 *
 * R2 endpoint: `https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com`.
 * Public delivery: `{R2_PUBLIC_URL}/{key}` when the bucket is fronted by a
 * CDN/custom domain; otherwise the SDK can sign URLs (deferred to Sprint 9
 * — for MVP we treat the bucket as public-read).
 *
 * Stub mode (any credential missing or still placeholder): the service
 * short-circuits and returns the `fallbackUrl` directly. That lets TN6 run
 * end-to-end with placehold.co URLs without paying for storage.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly publicUrlBase: string;
  readonly available: boolean;

  constructor(cfg: ConfigService) {
    const accountId = cfg.get<string>('R2_ACCOUNT_ID') ?? process.env.R2_ACCOUNT_ID ?? '';
    const accessKeyId = cfg.get<string>('R2_ACCESS_KEY_ID') ?? process.env.R2_ACCESS_KEY_ID ?? '';
    const secretAccessKey =
      cfg.get<string>('R2_SECRET_ACCESS_KEY') ?? process.env.R2_SECRET_ACCESS_KEY ?? '';
    this.bucket = cfg.get<string>('R2_BUCKET_NAME') ?? process.env.R2_BUCKET_NAME ?? '';
    this.publicUrlBase = cfg.get<string>('R2_PUBLIC_URL') ?? process.env.R2_PUBLIC_URL ?? '';

    this.available =
      !isPlaceholderToken(accountId) &&
      !isPlaceholderToken(accessKeyId) &&
      !isPlaceholderToken(secretAccessKey) &&
      !!this.bucket;

    this.client = this.available
      ? new S3Client({
          region: 'auto',
          endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
          credentials: { accessKeyId, secretAccessKey },
        })
      : null;

    if (!this.available) {
      this.logger.warn(
        'StorageService running in STUB mode — R2 credentials missing/placeholder; uploads will return the source URL directly',
      );
    }
  }

  async upload(input: UploadInput): Promise<UploadResult> {
    if (!this.client || !this.available) {
      return {
        url: input.fallbackUrl ?? `stub://uploads/${input.key}`,
        key: input.key,
        size_bytes: input.bytes.length,
        is_stub: true,
      };
    }

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.bytes,
        ContentType: input.contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    return {
      url: this.publicUrl(input.key),
      key: input.key,
      size_bytes: input.bytes.length,
      is_stub: false,
    };
  }

  publicUrl(key: string): string {
    if (this.publicUrlBase) {
      return this.publicUrlBase.replace(/\/$/, '') + '/' + key.replace(/^\//, '');
    }
    return `r2://${this.bucket}/${key}`;
  }
}
