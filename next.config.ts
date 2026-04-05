import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Fix workspace root detection - explicitly set the output file tracing root
  outputFileTracingRoot: path.join(__dirname),
  // TypeScript/ESLint: Checked separately via `npm run typecheck` and `npm run lint`
  // Kept disabled during build to speed up builds on Vercel
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  // Prevent packages with internal HTML/document conflicts from being bundled during static generation
  // This resolves the "<Html> should not be imported outside of pages/_document" error
  // Moved from experimental in Next.js 15+
  serverExternalPackages: [
    '@react-email/components',
    '@react-email/render',
    'resend',
    '@react-pdf/renderer',
    '@react-pdf/layout',
    '@react-pdf/render',
    '@react-pdf/primitives',
    '@react-pdf/reconciler',
    '@react-pdf/pdfkit',
    '@react-pdf/font',
    '@react-pdf/fns',
    '@react-pdf/types',
    // Heavy packages that should be server-only
    'sharp',
    'bcrypt',
    'bcryptjs',
    '@tensorflow/tfjs',
    'brain.js',
    'xlsx',
    'exceljs',
    'jspdf',
    'jspdf-autotable',
    'nodemailer',
    'twilio',
    'web-push',
    'googleapis',
  ],

  experimental: {
    // Optimize compilation for large icon/utility packages - reduces build time and memory
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      '@heroicons/react',
      '@headlessui/react',
      'date-fns',
      'framer-motion',
      'recharts',
      '@tanstack/react-query',
      'chart.js',
      'react-chartjs-2',
      'reactflow',
      'zod',
      '@aws-sdk/client-s3',
      '@aws-sdk/client-ses',
      '@aws-sdk/client-sesv2',
      '@aws-sdk/client-lambda',
      '@supabase/supabase-js',
      '@supabase/ssr',
      'openai',
      '@anthropic-ai/sdk',
      '@google/generative-ai',
    ],
    serverActions: {
      bodySizeLimit: '2mb',
      allowedOrigins: [
        'localhost:3000',
        'localhost:3006',
        'vendor.loanz360.com',
        'loanz360-vendor.vercel.app',
      ],
    },
    // Single core to minimize memory on Vercel 8GB build machine
    workerThreads: false,
    cpus: 1,
  },

  // Note: Do NOT use output: 'standalone' on Vercel - it bypasses Vercel's
  // build optimizations and significantly increases build time/memory

  // Timeout for static page generation (seconds per page)
  staticPageGenerationTimeout: 30,

  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self)' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'strict-dynamic' https://vercel.live",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vercel.live",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-src 'self' https://vercel.live",
              "object-src 'none'",
              "upgrade-insecure-requests"
            ].join('; ')
          }
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' }
        ],
      },
    ]
  },

  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,
  productionBrowserSourceMaps: false,

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'logo.clearbit.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  env: {
    CUSTOM_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
  },

  webpack: (config, { isServer, dev }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }

    // Production build optimizations for memory - CRITICAL for Vercel Hobby plan
    if (!dev) {
      config.devtool = false;
      config.parallelism = 1;
      config.cache = false;
    }

    return config;
  },

  async redirects() {
    return []
  },
};

export default nextConfig;
