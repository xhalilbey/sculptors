import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Next compiles this file to CommonJS before loading it, so __dirname is
    // the project root here (the pattern the Turbopack docs use).
    root: __dirname,
  },

  // Cache Components (includes Partial Prerendering).
  cacheComponents: true,

  // Since 16.3, `next dev` writes AGENTS.md and a CLAUDE.md that loads it
  // whenever it detects an AI coding agent. Off: a dependency would be
  // authoring the instructions every agent session reads, and each agent
  // run of `npm run dev` would leave both files untracked in the tree.
  agentRules: false,

  // Only TypeScript files are routes. A stray page.js or route.js (a build
  // artifact, a copied snippet) would otherwise become a live route that
  // neither the typechecker nor the route-guard ratchet reads.
  pageExtensions: ["ts", "tsx"],

  // lucide-react is not listed in experimental.optimizePackageImports: Next
  // already optimizes it by default (next/dist/server/config.js).

  // No compiler.removeConsole: src/lib/logger.ts writes every production
  // line through console, and stripping console.log silenced all of them
  // until 24 Sep 2026. The no-console lint rule keeps stray calls out
  // instead (src/next-config.test.ts pins this).

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [100, 75],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 14400, // 4 hours (Next.js 16 default, reduces revalidation costs)
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Headers for security
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },

  // Output configuration
  output: 'standalone',

  // Power user settings
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
};

export default nextConfig;
