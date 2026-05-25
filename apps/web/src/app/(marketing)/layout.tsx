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
        <div className="container py-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} MKT SEO AI. Built for Vietnamese SEO teams.
        </div>
      </footer>
    </div>
  );
}
