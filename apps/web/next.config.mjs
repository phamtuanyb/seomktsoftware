import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@mkt-seo/shared', '@mkt-seo/ui'],
  experimental: {
    typedRoutes: false,
  },
  async rewrites() {
    // Proxy non-Next /api/* to the NestJS backend so cookies/CORS stay simple.
    const target = process.env.API_INTERNAL_URL ?? 'http://localhost:3005';
    return [
      {
        source: '/api/proxy/:path*',
        destination: `${target}/api/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
