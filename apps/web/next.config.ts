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
  experimental: {
    webpackBuildWorker: false,
    // Mantine re-exports its whole surface from one barrel, so an
    // `import { Button } from '@mantine/core'` pulls every component into the
    // route in development. Rewriting those to deep imports cuts the module
    // graph per admin screen. @tabler/icons-react is already handled by the
    // framework default list.
    optimizePackageImports: ['@mantine/core', '@mantine/hooks'],
  },
  async rewrites() {
    return [{ source: '/public/media/:path*', destination: `${apiBase()}/public/media/:path*` }];
  },
};

export default nextConfig;
