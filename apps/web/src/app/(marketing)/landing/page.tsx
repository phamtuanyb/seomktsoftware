import Link from 'next/link';
import {
  BarChart3,
  Check,
  FileText,
  Image as ImageIcon,
  KeyRound,
  Mic2,
  Search,
  Send,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { EmailCaptureForm } from '@/components/features/marketing/email-capture-form';

const STATS = [
  { value: '500+', label: 'Keywords / phiên', note: 'Gom từ Google Suggest, Bing, PAA' },
  { value: '90s', label: 'Thời gian viết bài', note: 'Từ outline đến bài hoàn thiện' },
  { value: '80%', label: 'Tỉ lệ chấp nhận AI', note: 'Outline bám intent, ít phải sửa tay' },
  { value: '10s', label: 'Thời gian đăng bài', note: 'Push WordPress kèm meta và schema' },
];

const FEATURES = [
  {
    icon: Search,
    title: 'Nghiên cứu từ khóa',
    description:
      'Lấy 500+ keyword unique từ Google Suggest, Bing, People Also Ask, tự loại trùng và cache 7 ngày.',
    sprint: 'SPRINT 3',
  },
  {
    icon: BarChart3,
    title: 'Phân tích Volume',
    description:
      'Volume DataForSEO, KD theo 4 yếu tố và gom intent để ưu tiên đúng cơ hội lên top.',
    sprint: 'SPRINT 3',
  },
  {
    icon: FileText,
    title: 'AI Outline Gen',
    description:
      'Phân tích SERP, gom góc nhìn cạnh tranh và sinh layout bài viết ngắn gọn, tự nhiên hơn.',
    sprint: 'SPRINT 4',
  },
  {
    icon: Sparkles,
    title: 'Article Writer',
    description:
      'Viết bài hoàn thiện từ outline, bám brand voice, có H1 H2 H3, bảng, media và CTA rõ ràng.',
    sprint: 'SPRINT 4',
  },
  {
    icon: Mic2,
    title: 'Brand Voice',
    description:
      'Học giọng viết từ bài mẫu, giữ cách dùng từ và nhịp câu gần với thương hiệu của bạn.',
    sprint: 'SPRINT 4',
  },
  {
    icon: ImageIcon,
    title: 'AI Image Gen',
    description:
      'Tạo ảnh minh họa, alt text và gợi ý vị trí chèn ảnh để bài viết sẵn sàng cho CMS.',
    sprint: 'SPRINT 5',
  },
  {
    icon: KeyRound,
    title: 'Content Score',
    description: 'Chấm nhanh tiêu chí SEO onpage, phát hiện chỗ yếu để chỉnh trước khi publish.',
    sprint: 'SPRINT 5',
  },
  {
    icon: Send,
    title: 'WP Publisher',
    description:
      'Kết nối WordPress trong ít phút, publish bài có ảnh, schema, meta và hỗ trợ plugin SEO.',
    sprint: 'SPRINT 6',
  },
];

const PRICING = [
  {
    name: 'Starter',
    price: 'Miễn phí',
    description: 'Dùng thử quy trình để kiểm tra chất lượng outline và bài viết.',
    features: ['1 workspace', 'Sinh outline + bài viết demo', 'Lưu brand voice cơ bản'],
    cta: 'Dùng thử miễn phí',
    href: '/register',
    highlight: false,
  },
  {
    name: 'Growth',
    price: 'Liên hệ',
    description: 'Cho team SEO cần chạy nhiều keyword, nhiều brand voice và publish liên tục.',
    features: ['Batch keyword', 'Manual outline', 'AI provider tùy chọn', 'WordPress publish'],
    cta: 'Nhận tư vấn',
    href: 'mailto:support@mkt-seo-ai.com',
    highlight: true,
  },
  {
    name: 'Agency',
    price: 'Tùy nhu cầu',
    description: 'Dành cho agency hoặc đội vận hành nhiều site, cần kiểm soát sâu hơn.',
    features: ['Nhiều workspace', 'Nhiều API key', 'Quy trình review nội dung', 'Ưu tiên hỗ trợ'],
    cta: 'Trao đổi triển khai',
    href: 'mailto:support@mkt-seo-ai.com',
    highlight: false,
  },
];

function HeroPreview() {
  return (
    <div className="relative mx-auto aspect-[1.42] w-full max-w-[560px] rounded-[28px] border border-slate-200 bg-white p-3 shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
      <div className="relative h-full overflow-hidden rounded-[22px] bg-[#09162a]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,0.35),transparent_35%),radial-gradient(circle_at_80%_30%,rgba(249,115,22,0.22),transparent_30%),linear-gradient(180deg,#0b1730_0%,#091221_100%)]" />
        <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-r from-white/8 via-white/4 to-transparent" />
        <div className="absolute left-6 top-6 flex items-center gap-2 rounded-full border border-sky-400/25 bg-sky-400/10 px-3 py-1 text-[11px] font-medium text-sky-100">
          <BarChart3 className="h-3.5 w-3.5" />
          Live optimization
        </div>
        <div className="absolute right-6 top-6 rounded-full border border-orange-300/20 bg-orange-400/10 px-3 py-1 text-[11px] font-medium text-orange-100">
          Keyword ranking
        </div>
        <div className="absolute left-[12%] top-[28%] h-[1px] w-[72%] bg-gradient-to-r from-transparent via-orange-300/80 to-transparent" />
        <div className="absolute left-[18%] top-[52%] h-[1px] w-[58%] bg-gradient-to-r from-transparent via-sky-300/70 to-transparent" />
        <div className="absolute inset-x-10 bottom-10 top-20 rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6 backdrop-blur-sm">
          <div className="grid h-full grid-cols-[1.2fr_0.8fr] gap-5">
            <div className="rounded-[18px] border border-white/8 bg-black/20 p-4">
              <div className="mb-4 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-slate-300">
                <span>Keyword pipeline</span>
                <span>CTR + Intent</span>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Keyword ranking', width: 'w-[88%]' },
                  { label: 'Competitor analysis', width: 'w-[74%]' },
                  { label: 'Outline quality', width: 'w-[68%]' },
                  { label: 'Article coverage', width: 'w-[82%]' },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="mb-1 text-xs text-slate-200">{item.label}</div>
                    <div className="h-2 rounded-full bg-white/10">
                      <div
                        className={`h-2 rounded-full bg-gradient-to-r from-orange-400 via-amber-300 to-sky-400 ${item.width}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="rounded-[18px] border border-white/8 bg-white/6 p-4">
                <div className="mb-3 text-[11px] uppercase tracking-[0.16em] text-slate-300">
                  Automation flow
                </div>
                <div className="space-y-2">
                  {['SERP scan', 'Outline draft', 'Brand voice fit', 'Publish ready'].map(
                    (item) => (
                      <div
                        key={item}
                        className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100"
                      >
                        <Check className="h-3.5 w-3.5 text-emerald-300" />
                        {item}
                      </div>
                    ),
                  )}
                </div>
              </div>
              <div className="rounded-[18px] border border-orange-300/20 bg-orange-400/10 p-4 text-slate-100">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Wand2 className="h-4 w-4 text-orange-200" />
                  AI article engine
                </div>
                <p className="text-sm leading-6 text-slate-200">
                  Sinh bài viết theo outline, brand voice và checklist SEO trong một quy trình liền
                  mạch.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="bg-[#f8fafc] text-slate-900">
      <section className="border-b border-slate-200/80 bg-[radial-gradient(circle_at_20%_20%,rgba(249,115,22,0.12),transparent_22%),radial-gradient(circle_at_85%_18%,rgba(59,130,246,0.08),transparent_18%),linear-gradient(180deg,#fffdfb_0%,#f8fafc_78%)]">
        <div className="container py-14 md:py-20">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(440px,560px)] lg:gap-14">
            <div className="max-w-[580px]">
              <div className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700">
                Mới: Tích hợp Claude 3.5 Sonnet
              </div>
              <h1 className="mt-6 text-5xl font-semibold leading-[1.02] tracking-normal text-slate-950 md:text-6xl">
                SEO từ khóa đến bài đăng chỉ trong <span className="text-accent">5 phút</span>
              </h1>
              <p className="mt-6 max-w-[540px] text-lg leading-8 text-slate-500">
                Tự động hóa toàn bộ pipeline SEO: nghiên cứu từ khóa, sinh nội dung AI đúng brand
                voice, dựng outline và đăng bài WordPress trực tiếp.
              </p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/register"
                  className="inline-flex h-14 items-center justify-center rounded-full bg-accent px-7 text-base font-semibold text-white shadow-[0_12px_24px_rgba(249,115,22,0.22)] transition hover:bg-accent-600"
                >
                  Dùng thử miễn phí 14 ngày
                </Link>
                <Link
                  href="#features"
                  className="inline-flex h-14 items-center justify-center rounded-full border border-[#19345d] px-7 text-base font-semibold text-[#19345d] transition hover:bg-slate-50"
                >
                  Xem 8 tính năng
                </Link>
              </div>
            </div>
            <HeroPreview />
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <div className="container grid gap-8 py-8 text-center md:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label}>
              <div className="text-4xl font-semibold tracking-normal text-[#19345d]">
                {stat.value}
              </div>
              <div className="mt-1 text-base font-medium text-slate-700">{stat.label}</div>
              <div className="mt-1 text-sm text-slate-500">{stat.note}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="py-20 md:py-24">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl font-semibold tracking-normal text-slate-950">
              8 tính năng cốt lõi trong 1 nền tảng
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-500">
              Mỗi tính năng được thiết kế để giải quyết một phần quan trọng của pipeline SEO, từ ý
              tưởng đến khi lên top.
            </p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;

              return (
                <article
                  key={feature.title}
                  className="rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_4px_20px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(15,23,42,0.08)]"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-accent shadow-[0_10px_20px_rgba(249,115,22,0.14)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-6 text-xl font-semibold text-slate-950">{feature.title}</h3>
                  <span className="mt-4 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] text-slate-500">
                    {feature.sprint}
                  </span>
                  <p className="mt-4 text-sm leading-7 text-slate-500">{feature.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="pricing" className="border-y border-slate-200 bg-white py-20 md:py-24">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl font-semibold tracking-normal text-slate-950">
              Gói phù hợp với cách bạn vận hành SEO
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-500">
              Bắt đầu bằng trial để kiểm tra chất lượng bài viết, sau đó mở rộng theo số lượng site
              và quy trình của team.
            </p>
          </div>
          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            {PRICING.map((plan) => (
              <article
                key={plan.name}
                className={`rounded-2xl border p-7 shadow-[0_4px_20px_rgba(15,23,42,0.05)] ${
                  plan.highlight
                    ? 'border-[#19345d] bg-[#19345d] text-white'
                    : 'border-slate-200 bg-white text-slate-950'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-semibold">{plan.name}</h3>
                  {plan.highlight ? (
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-[0.08em] text-orange-200">
                      PHỔ BIẾN
                    </span>
                  ) : null}
                </div>
                <div
                  className={`mt-5 text-4xl font-semibold ${plan.highlight ? 'text-white' : 'text-[#19345d]'}`}
                >
                  {plan.price}
                </div>
                <p
                  className={`mt-4 text-sm leading-7 ${plan.highlight ? 'text-slate-200' : 'text-slate-500'}`}
                >
                  {plan.description}
                </p>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm leading-6">
                      <Check
                        className={`mt-1 h-4 w-4 shrink-0 ${plan.highlight ? 'text-orange-200' : 'text-emerald-600'}`}
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={`mt-8 inline-flex h-12 w-full items-center justify-center rounded-full px-5 text-sm font-semibold transition ${
                    plan.highlight
                      ? 'bg-accent text-white hover:bg-accent-600'
                      : 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {plan.cta}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="trial" className="py-20 md:py-24">
        <div className="container">
          <div className="rounded-[32px] bg-[#19345d] px-6 py-14 shadow-[0_24px_60px_rgba(15,23,42,0.22)] md:px-12 md:py-16">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-4xl font-semibold tracking-normal text-white">
                Để lại thông tin để nhận trải nghiệm
              </h2>
              <p className="mt-4 text-lg leading-8 text-slate-300">
                Để lại email, chúng tôi sẽ gửi link kích hoạt khi bản beta sẵn sàng. Phù hợp nếu bạn
                muốn thử luồng SEO AI trước khi đưa vào team vận hành.
              </p>
            </div>
            <div className="mx-auto mt-10 max-w-2xl">
              <EmailCaptureForm />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
