import type { NextConfig } from 'next';

// Media files are addressed by their public delivery path (/public/media/...)
// so that seeded and authored content stays host agnostic: the same page tree
// works in development and behind any deployment hostname. The runtime proxies
// those requests to the API, which owns the bytes.
function apiBase(): string {
  return process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

// Only the browser-visible API origin belongs in connect-src: API_INTERNAL_URL
// is the container to container address and is never dialled from a page.
// headers() is evaluated by `next build`, the same moment NEXT_PUBLIC_API_URL
// is inlined into the client bundle, so both always describe the same origin.
function browserApiOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

// Allowlisted video embed hosts. Kept in sync with normalizeEmbedUrl in
// lib/renderer/template.ts, which rewrites every embed prop to one of these
// two origins and drops everything else.
const EMBED_HOSTS = ['https://www.youtube-nocookie.com', 'https://player.vimeo.com'];

// Content Security Policy for the whole app, admin and public runtime alike.
//
// script-src keeps 'unsafe-inline' on purpose. A nonce policy would need a
// per-request middleware and would still break three things this app depends
// on: the theme init script inlined in app/layout.tsx and Mantine's
// ColorSchemeScript (neither carries a nonce), and the Block script sandbox in
// lib/renderer/block-script-sandbox.tsx, whose srcDoc document inherits this
// policy and whose inline scripts could never match a parent nonce. A nonce
// would also force every published page out of static rendering. The sandbox
// itself stays the real containment boundary for block authored JavaScript:
// opaque origin, no same-origin permission, and its own default-src 'none'.
function contentSecurityPolicy(isDev: boolean): string {
  const apiOrigin = browserApiOrigin();
  const connect = ["'self'", ...(apiOrigin === null ? [] : [apiOrigin])];
  if (isDev) {
    // The HMR client and the dev overlay talk over a websocket on this origin.
    connect.push('ws:', 'wss:');
  }
  const script = ["'self'", "'unsafe-inline'"];
  if (isDev) {
    // The dev bundler evaluates module code at runtime, and React Refresh
    // compiles replacement components the same way.
    script.push("'unsafe-eval'");
  }
  const frame = ["'self'", 'blob:', ...EMBED_HOSTS];

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
    'frame-ancestors': ["'self'"],
    'form-action': ["'self'"],
    'script-src': script,
    // Style Book CSS, per template CSS and per instance node styles are all
    // injected as inline <style> by the block renderer.
    'style-src': ["'self'", "'unsafe-inline'"],
    // Block props carry arbitrary author supplied image URLs, and media is
    // proxied same origin through /public/media.
    'img-src': ["'self'", 'data:', 'blob:', 'https:', 'http:'],
    'media-src': ["'self'", 'data:', 'blob:', 'https:', 'http:'],
    'font-src': ["'self'", 'data:', 'https:'],
    'connect-src': connect,
    // Allowlisted embeds plus the srcDoc Block sandbox, which is an opaque
    // origin document created from this same page.
    'frame-src': frame,
    'child-src': frame,
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
  };

  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');
}

function securityHeaders(): { key: string; value: string }[] {
  const isDev = process.env.NODE_ENV !== 'production';
  return [
    { key: 'Content-Security-Policy', value: contentSecurityPolicy(isDev) },
    { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    // Redundant with frame-ancestors above, kept for browsers that predate it.
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  ];
}

const nextConfig: NextConfig = {
  // Ships a self-contained server bundle in .next/standalone, so the
  // production image needs neither pnpm nor the full node_modules tree.
  output: 'standalone',
  transpilePackages: ['@neriva/ui'],
  devIndicators: false,
  poweredByHeader: false,
  experimental: {
    webpackBuildWorker: false,
    // Mantine re-exports its whole surface from one barrel, so an
    // `import { Button } from '@mantine/core'` pulls every component into the
    // route in development. Rewriting those to deep imports cuts the module
    // graph per admin screen. @tabler/icons-react is already handled by the
    // framework default list.
    optimizePackageImports: ['@mantine/core', '@mantine/hooks'],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders() }];
  },
  async rewrites() {
    return [{ source: '/public/media/:path*', destination: `${apiBase()}/public/media/:path*` }];
  },
};

export default nextConfig;
