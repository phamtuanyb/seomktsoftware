'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  ExternalLink,
  Loader2,
  Mic2,
  PlayCircle,
  Send,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usersApi, type UserProfile } from '@/lib/api/users';

type StepId = 'welcome' | 'wp' | 'voice' | 'tutorial' | 'complete';

const STEPS: { id: StepId; title: string; subtitle: string }[] = [
  { id: 'welcome', title: 'Welcome', subtitle: 'Tổng quan' },
  { id: 'wp', title: 'WordPress', subtitle: 'Connect site' },
  { id: 'voice', title: 'Brand Voice', subtitle: 'Phong cách viết' },
  { id: 'tutorial', title: 'Tutorial', subtitle: 'Bài viết đầu' },
  { id: 'complete', title: 'Xong', subtitle: 'Vào dashboard' },
];

/**
 * Sprint 10.5 — 5-step onboarding wizard.
 *
 * Marks `onboarded_at` in user.preferences_json when complete so users only
 * see this once. Skip-able at every step.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [step, setStep] = useState<StepId>('welcome');
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    usersApi
      .me()
      .then((p) => {
        setProfile(p);
        // Already onboarded → redirect.
        const prefs = p.preferences_json as { onboarded_at?: string };
        if (prefs?.onboarded_at) router.replace('/dashboard');
      })
      .catch(() => {});
  }, [router]);

  async function finish() {
    setFinishing(true);
    try {
      const current = (profile?.preferences_json ?? {}) as Record<string, unknown>;
      await usersApi.update({
        preferences_json: { ...current, onboarded_at: new Date().toISOString() },
      });
      router.replace('/dashboard');
    } finally {
      setFinishing(false);
    }
  }

  const stepIdx = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Chào mừng đến MKT SEO AI</h1>
        <p className="text-sm text-muted-foreground">
          5 bước thiết lập (~3 phút). Bạn có thể bỏ qua từng bước và quay lại sau.
        </p>
      </div>

      <ol className="flex flex-wrap items-center gap-2 text-xs">
        {STEPS.map((s, i) => {
          const active = i === stepIdx;
          const done = i < stepIdx;
          return (
            <li key={s.id} className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-medium ${
                  done
                    ? 'bg-emerald-100 text-emerald-800'
                    : active
                      ? 'bg-brand text-white'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className={active ? 'font-medium' : 'text-muted-foreground'}>{s.title}</span>
              {i < STEPS.length - 1 && <span className="text-muted-foreground">→</span>}
            </li>
          );
        })}
      </ol>

      {step === 'welcome' && (
        <StepCard
          icon={<Sparkles className="h-5 w-5 text-brand" />}
          title="Pipeline tổng quan"
          description="MKT SEO AI tự động hoá từ research keyword đến publish WordPress."
          onSkip={() => router.replace('/dashboard')}
          onNext={() => setStep('wp')}
          nextLabel="Bắt đầu thiết lập"
        >
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-brand">①</span>
              <span>
                <strong>Từ khoá:</strong> tìm 200+ keyword từ Google/Bing/PAA, phân tích volume + KD
                + intent.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand">②</span>
              <span>
                <strong>AI viết bài:</strong> Outline → Article 2000 từ trong brand voice của bạn,
                Content Score realtime.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand">③</span>
              <span>
                <strong>Hình ảnh:</strong> featured + in-content qua Flux/DALL-E.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand">④</span>
              <span>
                <strong>Publish:</strong> push lên WordPress (Yoast/RankMath/SEOPress auto-detect)
                hoặc schedule.
              </span>
            </li>
          </ul>
        </StepCard>
      )}

      {step === 'wp' && (
        <StepCard
          icon={<Send className="h-5 w-5 text-brand" />}
          title="Kết nối WordPress (tuỳ chọn)"
          description="Cần Application Password để publish tự động. Có thể bỏ qua + thêm sau."
          onSkip={() => setStep('voice')}
          onNext={() => setStep('voice')}
          nextLabel="Đã hiểu, tiếp tục"
        >
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li>
              1. Vào WordPress admin → <strong>Users → Profile</strong>
            </li>
            <li>
              2. Cuộn xuống <strong>Application Passwords</strong>, tạo password mới với tên
              &quot;MKT SEO AI&quot;
            </li>
            <li>
              3. Copy password (chỉ hiện 1 lần) → nhập vào{' '}
              <Link href="/publisher" className="text-brand hover:underline">
                trang Xuất bản
              </Link>
            </li>
          </ol>
          <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
            <strong>Lưu ý bảo mật:</strong> mật khẩu được mã hoá AES-256-GCM trước khi lưu DB. Bạn
            có thể revoke bất kỳ lúc nào trong WP admin.
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/publisher" target="_blank">
              Mở trang Xuất bản <ExternalLink className="ml-2 h-3 w-3" />
            </Link>
          </Button>
        </StepCard>
      )}

      {step === 'voice' && (
        <StepCard
          icon={<Mic2 className="h-5 w-5 text-brand" />}
          title="Tạo Brand Voice (tuỳ chọn)"
          description="USP — học phong cách viết của bạn từ 3-20 bài mẫu. Có thể bỏ qua + bài AI vẫn chạy với tone mặc định."
          onSkip={() => setStep('tutorial')}
          onNext={() => setStep('tutorial')}
          nextLabel="Đã hiểu, tiếp tục"
        >
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Upload 3-20 bài mẫu (paste content hoặc URL).</li>
            <li>• Claude Sonnet 4 phân tích tone, cấu trúc câu, xưng hô, cụm từ đặc trưng.</li>
            <li>• Profile được inject vào prompt mỗi lần viết bài mới.</li>
            <li>• Bạn có thể set 1 brand voice làm mặc định.</li>
          </ul>
          <Button asChild variant="outline" size="sm">
            <Link href="/brand-voices" target="_blank">
              Mở trang Brand Voice <ExternalLink className="ml-2 h-3 w-3" />
            </Link>
          </Button>
        </StepCard>
      )}

      {step === 'tutorial' && (
        <StepCard
          icon={<PlayCircle className="h-5 w-5 text-brand" />}
          title="Viết bài đầu tiên"
          description="Cách nhanh nhất: dùng Pipeline end-to-end. Keyword → bài viết draft trong 2-3 phút."
          onSkip={() => setStep('complete')}
          onNext={() => setStep('complete')}
          nextLabel="Hoàn tất setup"
        >
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Pipeline tự động chạy 5 bước: Outline → Article → Audit → Images → Publish (skip nếu
              chưa connect WP).
            </p>
            <Button asChild>
              <Link href="/pipeline" target="_blank">
                Mở Pipeline ngay <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <p className="text-xs text-muted-foreground">
              Hoặc bạn có thể vào <strong>Nội dung</strong> để tạo từng bước thủ công.
            </p>
          </div>
        </StepCard>
      )}

      {step === 'complete' && (
        <StepCard
          icon={<Check className="h-5 w-5 text-emerald-600" />}
          title="Sẵn sàng rồi!"
          description="Bắt đầu sinh bài đầu tiên. Trợ giúp có ở footer mọi trang."
          onSkip={() => router.replace('/dashboard')}
          onNext={() => void finish()}
          nextLabel={finishing ? 'Đang lưu...' : 'Vào dashboard'}
          nextDisabled={finishing}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/pipeline"
              className="flex items-center gap-3 rounded-md border bg-card p-3 hover:bg-muted"
            >
              <PlayCircle className="h-5 w-5 text-brand" />
              <div>
                <p className="font-medium">Pipeline end-to-end</p>
                <p className="text-xs text-muted-foreground">Auto 5 bước</p>
              </div>
            </Link>
            <Link
              href="/help"
              className="flex items-center gap-3 rounded-md border bg-card p-3 hover:bg-muted"
            >
              <Sparkles className="h-5 w-5 text-brand" />
              <div>
                <p className="font-medium">Trợ giúp + FAQ</p>
                <p className="text-xs text-muted-foreground">Câu hỏi thường gặp</p>
              </div>
            </Link>
          </div>
        </StepCard>
      )}
    </div>
  );
}

function StepCard({
  icon,
  title,
  description,
  children,
  onSkip,
  onNext,
  nextLabel,
  nextDisabled,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
  onSkip: () => void;
  onNext: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon} {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
      <div className="flex items-center justify-between border-t bg-muted/20 p-4">
        <Button variant="ghost" size="sm" onClick={onSkip}>
          Bỏ qua
        </Button>
        <Button onClick={onNext} disabled={nextDisabled}>
          {nextDisabled ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {nextLabel}
          {!nextDisabled && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>
      </div>
    </Card>
  );
}
