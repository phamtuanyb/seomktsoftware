import { ComingSoon } from '@/components/shared/coming-soon';

export const metadata = { title: 'Hình ảnh — MKT SEO AI' };

export default function ImagesPage() {
  return (
    <ComingSoon
      title="AI Image Generation"
      sprint="Sprint 5"
      spec="Section 8 — TN6"
      description="Sinh ảnh Flux Schnell (mặc định) hoặc DALL-E 3 (premium), auto alt text, resize + compress qua TinyPNG, lưu trên Cloudflare R2."
    />
  );
}
