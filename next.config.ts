import { createMDX } from 'fumadocs-mdx/next';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { imageRemoteHostPatterns } from './src/config/image-hosts';

/**
 * https://nextjs.org/docs/app/api-reference/config/next-config-js
 */
const nextConfig: NextConfig = {
  // Docker standalone output
  ...(process.env.DOCKER_BUILD === 'true' && { output: 'standalone' }),

  /* config options here */
  devIndicators: false,

  // Increase Server Actions body size limit for image uploads (default 1MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },

  // https://nextjs.org/docs/architecture/nextjs-compiler#remove-console
  // Remove all console.* calls in production only
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  images: {
    // https://vercel.com/docs/image-optimization/managing-image-optimization-costs#minimizing-image-optimization-costs
    // https://nextjs.org/docs/app/api-reference/components/image#unoptimized
    // vercel has limits on image optimization, 1000 images per month
    unoptimized: process.env.DISABLE_IMAGE_OPTIMIZATION === 'true',

    // Enable modern image formats for better compression
    // AVIF offers ~50% smaller files than WebP, with WebP as fallback
    formats: ['image/avif', 'image/webp'],

    // Device breakpoints for responsive images (srcset generation)
    // Optimized for common device widths
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],

    // Image sizes for smaller images (thumbnails, avatars, icons)
    // Combined with deviceSizes for full srcset
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],

    remotePatterns: imageRemoteHostPatterns.map((hostname) => ({
      protocol: 'https',
      hostname,
    })),
  },
  async headers() {
    const securityHeaders = [
      {
        key: 'Content-Security-Policy',
        value:
          "base-uri 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'",
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'X-Frame-Options',
        value: 'DENY',
      },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=()',
      },
    ];

    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

type NextConfigWithLegacyTurbo = NextConfig & {
  experimental?: NonNullable<NextConfig['experimental']> & {
    turbo?: NextConfig['turbopack'];
  };
};

function migrateLegacyTurboConfig(
  config: NextConfigWithLegacyTurbo
): NextConfig {
  const { experimental, turbopack, ...restConfig } = config;
  const { turbo: legacyTurbo, ...experimentalConfig } = experimental ?? {};

  if (!legacyTurbo) {
    return config;
  }

  return {
    ...restConfig,
    experimental: experimentalConfig,
    turbopack: {
      ...legacyTurbo,
      ...turbopack,
      resolveAlias: {
        ...legacyTurbo.resolveAlias,
        ...turbopack?.resolveAlias,
      },
      rules: {
        ...legacyTurbo.rules,
        ...turbopack?.rules,
      },
    },
  };
}

/**
 * You can specify the path to the request config file or use the default one (@/i18n/request.ts)
 *
 * https://next-intl.dev/docs/getting-started/app-router/with-i18n-routing#next-config
 */
const withNextIntl = createNextIntlPlugin();

/**
 * https://fumadocs.dev/docs/ui/manual-installation
 * https://fumadocs.dev/docs/mdx/plugin
 */
const withMDX = createMDX();

export default migrateLegacyTurboConfig(withMDX(withNextIntl(nextConfig)));
