import Link from 'next/link';
import {
  BarChart3,
  FileText,
  Files,
  Image as ImageIcon,
  KeyRound,
  LayoutDashboard,
  Mic2,
  Send,
  Settings,
  Shield,
  ShieldCheck,
  Webhook,
} from 'lucide-react';
import { headers } from 'next/headers';
import { LogoutButton } from '@/components/features/auth/logout-button';
import { readAccessToken } from '@/lib/auth/session';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { href: '/keywords', label: 'Từ khóa', icon: KeyRound },
  { href: '/content', label: 'Nội dung', icon: FileText },
  { href: '/articles', label: 'Bài viết', icon: Files },
  { href: '/brand-voices', label: 'Brand Voice', icon: Mic2 },
  { href: '/images', label: 'Hình ảnh', icon: ImageIcon },
  { href: '/audit', label: 'Chấm điểm SEO', icon: BarChart3 },
  { href: '/publisher', label: 'Xuất bản', icon: Send },
  { href: '/webhooks', label: 'Webhook', icon: Webhook },
  { href: '/settings', label: 'Cài đặt', icon: Settings },
];

const ADMIN_NAV = { href: '/admin', label: 'Admin', icon: Shield };

/**
 * UI-only role check — decodes the JWT payload without verifying the
 * signature. The backend remains the source of truth (RolesGuard on
 * /admin/*). A forged cookie would just see the admin link briefly before
 * every API call returns 403.
 */
async function isAdminFromToken(): Promise<boolean> {
  const token = await readAccessToken();
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8')) as {
      role?: string;
    };
    return payload.role === 'admin';
  } catch {
    return false;
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await headers(); // mark this layout dynamic — depends on session cookies.
  const showAdmin = await isAdminFromToken();
  const navItems = showAdmin ? [...NAV_ITEMS, ADMIN_NAV] : NAV_ITEMS;

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
          {navItems.map((item) => {
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
