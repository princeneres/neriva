import type { NextConfig } from 'next';

// Media files are addressed by their public delivery path (/public/media/...)
// so that seeded and authored content stays host agnostic: the same page tree
// works in development and behind any deployment hostname. The runtime proxies
// those requests to the API, which owns the bytes.
function apiBase(): string {
  return process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

const nextConfig: NextConfig = {
  transpilePackages: ['@neriva/ui'],
  devIndicators: false,
  async rewrites() {
    return [{ source: '/public/media/:path*', destination: `${apiBase()}/public/media/:path*` }];
  },
};

export default nextConfig;
