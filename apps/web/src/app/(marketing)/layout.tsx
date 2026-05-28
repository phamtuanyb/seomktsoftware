import Link from 'next/link';

const navItems = [
  { href: '/landing#features', label: 'Tính năng' },
  { href: '/landing#pricing', label: 'Bảng giá' },
  { href: '/help', label: 'Hỗ trợ' },
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#f8fafc]">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
        <div className="container flex h-20 items-center justify-between gap-6">
          <div className="flex items-center gap-10">
            <Link href="/landing" className="text-2xl font-semibold tracking-normal text-slate-950">
              MKT SEO AI
            </Link>
            <nav className="hidden items-center gap-8 text-sm text-slate-500 lg:flex">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="font-medium transition hover:text-slate-950"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden text-sm font-medium text-slate-700 transition hover:text-slate-950 sm:inline-flex"
            >
              Đăng nhập
            </Link>
            <Link
              href="/register"
              className="inline-flex h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(249,115,22,0.2)] transition hover:bg-accent-600"
            >
              Dùng thử miễn phí
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="container flex flex-col gap-6 py-10 text-sm text-slate-500 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-2xl font-semibold tracking-normal text-slate-950">MKT SEO AI</div>
            <p className="mt-2">© {new Date().getFullYear()} MKT Software Marketing AI Tool</p>
          </div>
          <nav className="flex flex-wrap items-center gap-5">
            <Link href="/terms" className="transition hover:text-slate-950">
              Điều khoản
            </Link>
            <Link href="/privacy" className="transition hover:text-slate-950">
              Bảo mật
            </Link>
            <Link href="/help" className="transition hover:text-slate-950">
              Liên hệ
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
