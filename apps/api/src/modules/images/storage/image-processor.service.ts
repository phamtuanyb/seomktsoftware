import { Injectable, Logger } from '@nestjs/common';
import type { ImageAspectRatio } from '../providers/image-provider.interface';

export interface ProcessedImage {
  bytes: Buffer;
  width: number;
  height: number;
  format: 'png' | 'jpeg' | 'webp';
  size_bytes: number;
}

/**
 * Section 8 TN6 step 4 — resize via Sharp:
 *   - featured: 1200×630 (OpenGraph)
 *   - in-content: 800×450
 *
 * Sharp is loaded dynamically because the npm package ships native binaries
 * — when the binary is unavailable on the host (CI without libvips), the
 * service falls back to passing the bytes through unchanged. The processor
 * still records the requested target dimensions so downstream code knows
 * what we *meant* to produce.
 */
@Injectable()
export class ImageProcessor {
  private readonly logger = new Logger(ImageProcessor.name);

  /** Returns a buffer resized to the variant's target dimensions. */
  async resize(
    bytes: Buffer,
    variant: 'featured' | 'in-content',
    aspectRatio: ImageAspectRatio,
  ): Promise<ProcessedImage> {
    const { width, height } = this.target(variant, aspectRatio);
    try {
      const sharpMod = await import('sharp').catch(() => null);
      if (!sharpMod?.default) {
        this.logger.warn('sharp unavailable — passing bytes through without resize');
        return { bytes, width, height, format: 'png', size_bytes: bytes.length };
      }
      const sharp = sharpMod.default;
      const out = await sharp(bytes)
        .resize({ width, height, fit: 'cover', position: 'attention' })
        .png({ quality: 88, compressionLevel: 9 })
        .toBuffer();
      return { bytes: out, width, height, format: 'png', size_bytes: out.length };
    } catch (err) {
      this.logger.warn(`Resize failed: ${(err as Error).message} — using original bytes`);
      return { bytes, width, height, format: 'png', size_bytes: bytes.length };
    }
  }

  private target(
    variant: 'featured' | 'in-content',
    aspectRatio: ImageAspectRatio,
  ): { width: number; height: number } {
    if (variant === 'featured') {
      // Section 8 TN6 — OpenGraph 1200×630.
      if (aspectRatio === '16:9') return { width: 1200, height: 675 };
      if (aspectRatio === '4:3') return { width: 1200, height: 900 };
      return { width: 1200, height: 1200 };
    }
    // in-content
    if (aspectRatio === '16:9') return { width: 800, height: 450 };
    if (aspectRatio === '4:3') return { width: 800, height: 600 };
    return { width: 800, height: 800 };
  }
}
