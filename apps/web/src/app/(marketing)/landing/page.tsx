import Link from 'next/link';
import {
  BarChart3,
  FileText,
  Image as ImageIcon,
  KeyRound,
  Mic2,
  Search,
  Send,
  Sparkles,
} from 'lucide-react';
import { EmailCaptureForm } from '@/components/features/marketing/email-capture-form';

const FEATURES = [
  {
    icon: Search,
    title: 'Nghiên cứu từ khóa',
    description:
      'Lấy 500+ keyword unique từ Google Suggest, Bing, People Also Ask — dedupe + cache 7 ngày.',
    sprint: 'Sprint 3',
  },
  {
    icon: BarChart3,
    title: 'Phân tích volume + KD + intent',
    description: 'Volume DataForSEO, KD công thức 4 yếu tố, intent qua Claude Haiku batch 50.',
    sprint: 'Sprint 3',
  },
  {
    icon: FileText,
    title: 'AI Outline Generator',
    description:
      'Crawl top 5 SERP, sinh outline 8-12 heading dùng Claude Sonnet 4, accept rate ≥80%.',
    sprint: 'Sprint 4',
  },
  {
    icon: Sparkles,
    title: 'Full Article Writer (streaming)',
    description: 'Viết bài 2000 từ <90s, streaming SSE, có schema markup, FAQ, meta description.',
    sprint: 'Sprint 4',
  },
  {
    icon: Mic2,
    title: 'Brand Voice Training',
    description: 'Học phong cách từ 5 bài mẫu, similarity ≥75% với reference khi viết bài mới.',
    sprint: 'Sprint 4',
  },
  {
    icon: ImageIcon,
    title: 'AI Image Generation',
    description: 'Flux Schnell mặc định, DALL-E 3 premium, auto alt text, resize + compress.',
    sprint: 'Sprint 5',
  },
  {
    icon: KeyRound,
    title: 'Content Score 0-100',
    description:
      '12 rule SEO (Chain of Responsibility), auto-fix cho rule <80, correlate ranking ≥0.6.',
    sprint: 'Sprint 5',
  },
  {
    icon: Send,
    title: 'WordPress Auto Publisher',
    description:
      'Connect site <60s, publish bài (ảnh + schema + meta) <10s, support Yoast/RankMath/SEOPress.',
    sprint: 'Sprint 6',
  },
];

export default function LandingPage() {
  return (
    <>
      <section className="bg-gradient-to-b from-brand to-brand-700 py-20 text-white">
        <div className="container max-w-4xl text-center">
          <h1 className="text-4xl font-bold leading-tight md:text-5xl">
            SEO từ khóa đến bài đăng chỉ trong <span className="text-accent-300">15 phút</span>
          </h1>
          <p className="mt-6 text-lg text-blue-100 md:text-xl">
            Tự động hóa toàn bộ pipeline SEO: nghiên cứu từ khóa, sinh nội dung AI đúng brand voice,
            đăng bài WordPress.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="rounded-md bg-accent px-8 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-accent-600"
            >
              Dùng thử miễn phí 14 ngày
            </Link>
            <Link
              href="#features"
              className="rounded-md border border-white/30 px-8 py-3 text-base font-semibold text-white hover:bg-white/10"
            >
              Xem 8 tính năng
            </Link>
          </div>
        </div>
      </section>

      <section id="features" className="py-20">
        <div className="container">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold">8 tính năng cốt lõi trong 1 nền tảng</h2>
            <p className="mt-3 text-muted-foreground">
              Mỗi tính năng được thiết kế để giải quyết một phần của pipeline SEO
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="rounded-lg border bg-card p-6 transition hover:border-brand hover:shadow-md"
                >
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-brand/10 text-brand">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
                  <span className="mt-3 inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {feature.sprint}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-muted/50 py-20">
        <div className="container max-w-2xl text-center">
          <h2 className="text-3xl font-bold">Nhận quyền truy cập sớm</h2>
          <p className="mt-3 text-muted-foreground">
            Để lại email — chúng tôi sẽ gửi link kích hoạt khi bản beta sẵn sàng.
          </p>
          <div className="mt-8">
            <EmailCaptureForm />
          </div>
        </div>
      </section>
    </>
  );
}
