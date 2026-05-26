import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail, MessageCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Trợ giúp — MKT SEO AI',
  description:
    'FAQ + hướng dẫn sử dụng MKT SEO AI: keyword research, AI viết bài, brand voice, publish WordPress.',
};

interface FaqItem {
  q: string;
  a: string;
}

const FAQS: { title: string; items: FaqItem[] }[] = [
  {
    title: 'Bắt đầu',
    items: [
      {
        q: 'Tôi có cần Anthropic API key không?',
        a: 'Trong môi trường dev/trial bạn có thể chạy MKT SEO AI mà không có key — hệ thống dùng stub provider để demo. Khi muốn AI thật (Claude Sonnet 4), paste key vào trang Cài đặt hoặc set ANTHROPIC_API_KEY trong .env.',
      },
      {
        q: 'Trial dùng được bao lâu?',
        a: '14 ngày trial cho mọi tài khoản mới. Trong thời gian này bạn được 5 bài viết AI / tháng, 100 keyword / tháng, 1 site WP, 1 brand voice. Sau trial chọn plan Starter / Pro / Agency.',
      },
      {
        q: 'Có cần cài đặt gì trên WordPress không?',
        a: 'Không cần plugin riêng. Hệ thống publish qua REST API mặc định của WordPress (5.6+). Bạn chỉ cần tạo Application Password trong Profile → Application Passwords và nhập vào trang Xuất bản.',
      },
    ],
  },
  {
    title: 'Sinh nội dung AI',
    items: [
      {
        q: 'Bài viết AI mất bao lâu?',
        a: 'Outline 8-12 heading: dưới 20 giây. Full article 2000 từ: 60-90 giây tuỳ model. Pipeline đầy đủ (Outline → Article → Audit → Image → Publish): 3-5 phút.',
      },
      {
        q: 'Content Score tính như thế nào?',
        a: '12 rule chấm điểm theo Section 8 TN7: keyword density, title chứa keyword, meta description độ dài, H1 unique, cấu trúc heading, word count, internal/external links, alt text, schema markup, LSI keywords, intro hook, FAQ section. Mỗi rule có trọng số, tổng 100 điểm.',
      },
      {
        q: 'Brand Voice hoạt động ra sao?',
        a: 'Bạn upload 3-20 bài mẫu (paste content hoặc URL). Hệ thống dùng Claude Sonnet 4 phân tích phong cách: tone, cấu trúc câu, xưng hô, cụm từ đặc trưng, emoji, opening/closing patterns. Profile JSON này được inject vào system prompt khi viết bài mới.',
      },
      {
        q: 'AI có bị detector phát hiện không?',
        a: 'Mục tiêu nội bộ: AI detection (Originality.ai) <30%. Brand voice + LSI keywords + đa dạng cấu trúc câu giúp giảm dấu hiệu AI. Vẫn nên đọc lại + edit bằng tay những đoạn quan trọng.',
      },
    ],
  },
  {
    title: 'Xuất bản WordPress',
    items: [
      {
        q: 'Hệ thống có hỗ trợ Yoast / RankMath / SEOPress không?',
        a: 'Có. Khi connect site, hệ thống tự dò endpoint /wp-json để phát hiện plugin SEO nào đang cài và fill meta title + description đúng định dạng (Yoast: _yoast_wpseo_title, RankMath: rank_math_title, ...).',
      },
      {
        q: 'Schedule bài có chính xác không?',
        a: 'Sai số schedule <30 giây. Bài viết được lưu vào WP với status="future" + scheduled_at, WordPress tự publish khi đến giờ — không phụ thuộc vào MKT SEO AI online.',
      },
      {
        q: 'Bulk publish nhiều bài có bị WP chặn không?',
        a: 'Rate limit nội bộ: 10 bài / site / giờ + random delay 2-15 giây giữa các bài. Đủ để tránh WP cảnh báo "too many requests".',
      },
    ],
  },
  {
    title: 'Bảo mật + dữ liệu',
    items: [
      {
        q: 'Mật khẩu Application Password WordPress lưu thế nào?',
        a: 'Mã hoá AES-256-GCM với master key xoay 90 ngày. Plaintext không bao giờ ghi ra log hoặc database.',
      },
      {
        q: 'Webhook payload có ký không?',
        a: 'Có. HMAC-SHA256 với secret riêng cho từng webhook. Header X-MKT-Signature: sha256=<hex>. Bạn verify bên consumer trước khi xử lý payload.',
      },
      {
        q: 'Xoá bài / xoá tài khoản thì dữ liệu đi đâu?',
        a: 'Soft-delete mặc định (status="deleted" + deleted_at). Hard-delete + GDPR-style export có thể request qua support@mkt-seo-ai.com (sẽ ra UI ở phase 2).',
      },
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="container py-12">
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trợ giúp & FAQ</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Câu hỏi thường gặp. Không tìm thấy đáp án?{' '}
            <a href="mailto:support@mkt-seo-ai.com" className="text-brand hover:underline">
              support@mkt-seo-ai.com
            </a>
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <a
            href="mailto:support@mkt-seo-ai.com"
            className="flex items-center gap-3 rounded-lg border bg-card p-4 hover:bg-muted"
          >
            <Mail className="h-5 w-5 text-brand" />
            <div>
              <p className="font-medium">Email support</p>
              <p className="text-xs text-muted-foreground">Trả lời trong 24 giờ làm việc</p>
            </div>
          </a>
          <Link
            href="/docs"
            className="flex items-center gap-3 rounded-lg border bg-card p-4 hover:bg-muted"
          >
            <MessageCircle className="h-5 w-5 text-brand" />
            <div>
              <p className="font-medium">API docs (Swagger)</p>
              <p className="text-xs text-muted-foreground">REST API reference đầy đủ</p>
            </div>
          </Link>
        </div>

        {FAQS.map((group) => (
          <section key={group.title} className="space-y-3">
            <h2 className="text-xl font-bold">{group.title}</h2>
            <div className="space-y-2">
              {group.items.map((item, i) => (
                <details key={i} className="rounded-lg border bg-card open:bg-muted/30">
                  <summary className="cursor-pointer list-none p-4 font-medium hover:bg-muted/50">
                    <span className="mr-2 text-muted-foreground">▸</span>
                    {item.q}
                  </summary>
                  <div className="border-t p-4 text-sm leading-relaxed text-muted-foreground">
                    {item.a}
                  </div>
                </details>
              ))}
            </div>
          </section>
        ))}

        <div className="rounded-lg border bg-card p-6 text-sm">
          <p className="font-medium">Tài liệu thêm</p>
          <ul className="mt-3 space-y-1.5 text-muted-foreground">
            <li>
              •{' '}
              <Link href="/terms" className="text-brand hover:underline">
                Điều khoản sử dụng
              </Link>
            </li>
            <li>
              •{' '}
              <Link href="/privacy" className="text-brand hover:underline">
                Chính sách bảo mật
              </Link>
            </li>
            <li>
              •{' '}
              <a href="/docs" className="text-brand hover:underline">
                API documentation (Swagger)
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
