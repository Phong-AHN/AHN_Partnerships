import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const here = path.dirname(fileURLToPath(import.meta.url));

const config: NextConfig = {
  reactStrictMode: true,
  devIndicators: { position: 'bottom-right' },
  // Pin the workspace root. Left to infer it, the build walks up past the
  // repository looking for a lockfile and trips over the junctions Windows
  // keeps in the user profile.
  outputFileTracingRoot: path.join(here, '..', '..'),
  // Prisma resolves its query engine through a dynamic `require` that Next's
  // file tracing cannot follow under pnpm's hashed `.pnpm/` layout - without
  // this, Vercel fails at runtime with "Prisma Client could not locate the
  // Query Engine for runtime rhel-openssl-3.0.x" (seen live on Mercator).
  // https://pris.ly/d/engine-not-found-nextjs
  outputFileTracingIncludes: {
    '/*': ['../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/**/*'],
  },
  // Workspace packages ship TypeScript source, not a build artefact.
  transpilePackages: [
    '@partners/ui',
    '@partners/core',
    '@partners/rbac',
    '@partners/auth',
    '@partners/db',
    '@partners/config',
    '@partners/observability',
  ],
  // Node libraries with dynamic requires: loaded directly, not bundled.
  serverExternalPackages: ['pino', 'pino-pretty', '@prisma/client'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  poweredByHeader: false,
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
        // Nothing loads a remote script, font or image: `next/font/google`
        // self-hosts the fonts at build time and avatars are CSS initials.
        // `unsafe-inline` is for the pre-paint theme script and inline styles;
        // `unsafe-eval` only in dev, for Fast Refresh.
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'"}`,
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "font-src 'self' data:",
            "connect-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
          ].join('; '),
        },
      ],
    },
  ],
};

export default config;
