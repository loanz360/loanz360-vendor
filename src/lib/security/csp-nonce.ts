/**
 * Content Security Policy (CSP) Nonce Generator
 *
 * Generates cryptographically secure nonces for inline scripts and styles
 * This allows removing 'unsafe-inline' from CSP while maintaining functionality
 *
 * SECURITY: Each request gets a unique nonce to prevent CSP bypass attacks
 *
 * NOTE: Uses Web Crypto API for Edge Runtime compatibility (Vercel)
 */

import { headers } from 'next/headers'

/**
 * Generate a cryptographically secure nonce
 * Uses Web Crypto API which is available in Edge Runtime
 */
export function generateNonce(): string {
  // Use Web Crypto API (available in Edge Runtime)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    // Generate random UUID and use it as base for nonce
    return crypto.randomUUID().replace(/-/g, '').substring(0, 22)
  }

  // Fallback: Generate random string
  // This should work in all environments
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  const randomValues = new Uint8Array(22)

  // Use crypto.getRandomValues if available (Edge Runtime)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomValues)
    for (let i = 0; i < 22; i++) {
      result += chars[randomValues[i] % chars.length]
    }
  } else {
    // Last resort fallback (should never happen)
    for (let i = 0; i < 22; i++) {
      result += chars[Math.floor(Math.random() * chars.length)]
    }
  }

  return result
}

/**
 * Get nonce from request headers
 * This is set by middleware and available in components
 */
export async function getNonce(): Promise<string> {
  const headersList = await headers()
  return headersList.get('x-nonce') || ''
}

/**
 * CSP header with nonce placeholders
 * The middleware will replace {nonce} with actual nonce
 */
export function getCSPHeader(nonce: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://*.supabase.co'

  return [
    "default-src 'self'",
    // Scripts: Nonce-based + strict-dynamic for Next.js hydration
    // Next.js 15 supports nonce-based CSP without unsafe-eval in production
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://vercel.live${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
    // Styles: Allow self + unsafe-inline for styled components + Google Fonts
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    // Images: Allow self, data URLs, and HTTPS
    "img-src 'self' data: https: blob:",
    // Fonts: Allow self, data URLs, and Google Fonts
    "font-src 'self' data: https://fonts.gstatic.com",
    // Connections: Allow self, Supabase, and Vercel
    `connect-src 'self' ${supabaseUrl} wss://*.supabase.co https://vercel.live`,
    // Frames: Only self and Vercel
    "frame-ancestors 'self' https://vercel.com https://*.vercel.com https://vercel.live",
    "frame-src 'self' https://vercel.live",
    // Base URI: Only self
    "base-uri 'self'",
    // Form actions: Only self
    "form-action 'self'",
    // Objects: None (prevents Flash, Java applets, etc.)
    "object-src 'none'",
    // Media: Self only
    "media-src 'self'",
    // Workers: Self only
    "worker-src 'self' blob:",
    // Manifests: Self only
    "manifest-src 'self'",
  ].join('; ')
}

/**
 * Report-Only CSP for testing (logs violations without blocking)
 * Use this first to test new CSP rules before enforcing
 */
export function getCSPReportOnlyHeader(nonce: string, reportUri?: string): string {
  const csp = getCSPHeader(nonce)

  if (reportUri) {
    return `${csp}; report-uri ${reportUri}`
  }

  return csp
}

/**
 * CSP violation reporting endpoint configuration
 * POST /api/csp-report to receive violation reports
 */
export interface CSPViolationReport {
  'document-uri': string
  referrer: string
  'violated-directive': string
  'effective-directive': string
  'original-policy': string
  disposition: string
  'blocked-uri': string
  'line-number'?: number
  'column-number'?: number
  'source-file'?: string
  'status-code': number
  'script-sample'?: string
}
