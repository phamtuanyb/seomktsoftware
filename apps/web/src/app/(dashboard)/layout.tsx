import Link from 'next/link';
import {
  BarChart3,
  FileText,
  Image as ImageIcon,
  KeyRound,
  LayoutDashboard,
  Mic2,
  Send,
  Settings,
  ShieldCheck,
  Webhook,
} from 'lucide-react';
import { headers } from 'next/headers';
import { LogoutButton } from '@/components/features/auth/logout-button';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { href: '/keywords', label: 'Từ khóa', icon: KeyRound },
  { href: '/content', label: 'Nội dung', icon: FileText },
  { href: '/brand-voices', label: 'Brand Voice', icon: Mic2 },
  { href: '/images', label: 'Hình ảnh', icon: ImageIcon },
  { href: '/audit', label: 'Chấm điểm SEO', icon: BarChart3 },
  { href: '/publisher', label: 'Xuất bản', icon: Send },
  { href: '/webhooks', label: 'Webhook', icon: Webhook },
  { href: '/settings', label: 'Cài đặt', icon: Settings },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await headers(); // mark this layout dynamic — depends on session cookies.

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 flex-col border-r bg-card lg:flex">
        <div className="flex h-16 items-center border-b px-6">
          <Link href="/dashboard" className="flex items-center gap-2 text-lg font-bold text-brand">
            <ShieldCheck className="h-5 w-5" />
            MKT SEO AI
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-4">
          <LogoutButton />
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-background px-4 lg:px-8">
          <span className="text-sm text-muted-foreground">
            Pipeline: từ khóa → nội dung → publish
          </span>
          <Link href="/landing" className="text-sm text-brand hover:underline lg:hidden">
            Đăng xuất
          </Link>
        </header>
        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
