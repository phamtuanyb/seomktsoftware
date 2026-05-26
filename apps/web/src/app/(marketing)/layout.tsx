import Link from 'next/link';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/landing" className="text-xl font-bold text-brand">
            MKT SEO AI
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/login" className="text-muted-foreground hover:text-foreground">
              Đăng nhập
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-accent px-4 py-2 text-white hover:bg-accent-600"
            >
              Dùng thử miễn phí
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t bg-muted">
        <div className="container flex flex-col items-center gap-3 py-8 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} MKT SEO AI. Built for Vietnamese SEO teams.</span>
          <nav className="flex flex-wrap items-center gap-4">
            <Link href="/help" className="hover:text-foreground">
              Trợ giúp
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Điều khoản
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Bảo mật
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
