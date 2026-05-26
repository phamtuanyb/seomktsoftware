import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@mkt-seo/shared', '@mkt-seo/ui'],
  experimental: {
    typedRoutes: false,
  },
  images: {
    // TN6 stub mode serves placehold.co URLs; production R2 will use a
    // custom CDN domain configured via R2_PUBLIC_URL.
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: 'replicate.delivery' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
    ],
  },
  // /api/proxy/* is handled by the catch-all route handler at
  // src/app/api/proxy/[...path]/route.ts so the server can translate
  // httpOnly cookies into a Bearer header before forwarding. Do NOT add a
  // rewrite for /api/proxy — it would bypass the handler.
};

export default withNextIntl(nextConfig);
