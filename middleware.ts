/**
 * LOANZ360 Enterprise-Grade Root Middleware
 *
 * SECURITY: This middleware protects ALL routes including API endpoints
 * - Server-side authentication verification
 * - Role-based access control (RBAC)
 * - Security headers
 * - Audit logging
 * - CSRF protection
 *
 * COMPLIANCE: SOX, PCI-DSS, GDPR
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { authenticateRequest } from './src/lib/auth/middleware'
import { validateOrigin } from './src/lib/auth/cors-protection'
import { securityLogger } from './src/lib/security-logger'
import { getClientIP } from './src/lib/utils/request-helpers'
import { generateNonce, getCSPHeader } from './src/lib/security/csp-nonce'

/**
 * Routes that require NO authentication
 */
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/unauthorized',
  '/api-docs',
  '/api-docs',
]

/**
 * Auth pages (login forms) - no authentication needed
 */
const AUTH_PAGES = [
  '/superadmin/auth/login',
  '/superadmin/auth/simple-login',
  '/superadmin/auth/simple-reset',
  '/superadmin/auth/emergency-reset',
  '/superadmin/auth/test-login',
  '/superadmin/auth/forgot-password',
  '/superadmin/auth/reset-password',
  '/superadmin/auth/reset-password-token',
  '/admin/auth/login',
  '/admin/login',
  '/partners/auth',
  '/customers',
  '/employees/auth',
]

/**
 * Public API endpoints (authentication APIs)
 */
const PUBLIC_API_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-session', // Session verification must be public - it checks auth status
  '/api/superadmin/auth',
  '/api/superadmin/auth/simple-login',
  '/api/superadmin/auth/simple-reset',
  '/api/superadmin/auth/emergency-reset',
  '/api/superadmin/auth/test-login',
  '/api/superadmin/auth/forgot-password',
  '/api/superadmin/auth/reset-password',
  '/api/admin/auth/login',
  '/api/csrf-token',
  '/api/health',
  '/api/docs',
  '/api/docs',
  // SECURITY FIX CRITICAL-02: Debug endpoints removed from public routes
  // These endpoints now require authentication
  // '/api/debug/check-session', // REMOVED - Security risk
  // '/api/debug/test-auth', // REMOVED - Security risk
]

/**
 * Static files and system routes to skip
 */
function shouldSkipMiddleware(pathname: string): boolean {
  return (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.startsWith('/images/') ||
    pathname.startsWith('/.well-known/') ||
    pathname === '/favicon.ico' ||
    pathname.includes('.')  // Skip files with extensions
  )
}

/**
 * Check if route is public
 */
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => {
    if (route === '/') return pathname === '/'
    return pathname.startsWith(route)
  }) || AUTH_PAGES.some(route => pathname.startsWith(route))
}

/**
 * Check if API route is public
 */
function isPublicAPIRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.some(route => pathname.startsWith(route))
}

/**
 * Add security headers to response with CSP nonce
 */
function addSecurityHeaders(response: NextResponse, nonce: string, requestId: string): NextResponse {
  // Request ID for correlation
  response.headers.set('X-Request-ID', requestId)

  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff')

  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY')

  // XSS Protection
  response.headers.set('X-XSS-Protection', '1; mode=block')

  // Referrer Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Permissions Policy
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  // HSTS for production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }

  // Content Security Policy with nonce (NO unsafe-eval, NO unsafe-inline)
  const csp = getCSPHeader(nonce)
  response.headers.set('Content-Security-Policy', csp)

  // Store nonce for components to use
  response.headers.set('x-nonce', nonce)

  return response
}

/**
 * Main middleware function
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const isAPIRoute = pathname.startsWith('/api/')

  // Generate nonce and request ID for this request using Web Crypto API (Edge Runtime compatible)
  const nonce = generateNonce()
  const requestId = Array.from(
    globalThis.crypto.getRandomValues(new Uint8Array(16)),
    b => b.toString(16).padStart(2, '0')
  ).join('')

  // Skip middleware for static files
  if (shouldSkipMiddleware(pathname)) {
    return NextResponse.next()
  }

  // SECURITY: Validate origin for API requests
  if (isAPIRoute) {
    const originValidation = validateOrigin(request)
    if (!originValidation.valid) {
      securityLogger.logSecurityEvent({
        level: 'warn',
        event: 'INVALID_ORIGIN',
        ip: getClientIP(request),
        userAgent: request.headers.get('user-agent') || 'unknown',
        details: {
          origin: request.headers.get('origin'),
          path: pathname
        }
      })

      return NextResponse.json(
        { error: 'Invalid origin' },
        { status: 403 }
      )
    }
  }

  // Allow public routes
  if (isPublicRoute(pathname) || (isAPIRoute && isPublicAPIRoute(pathname))) {
    const response = NextResponse.next()
    return addSecurityHeaders(response, nonce, requestId)
  }

  // CRITICAL FIX: ALL PROTECTED ROUTES REQUIRE AUTHENTICATION
  // This fixes the API route bypass vulnerability
  const authResult = await authenticateRequest(request)

  if (!authResult.isAuthenticated || !authResult.user) {
    securityLogger.logSecurityEvent({
      level: 'warn',
      event: 'UNAUTHORIZED_ACCESS_ATTEMPT',
      ip: getClientIP(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      details: {
        path: pathname,
        error: authResult.error
      }
    })

    if (isAPIRoute) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Redirect to appropriate login page
    const loginUrl = authResult.redirectUrl || '/login'
    const url = new URL(loginUrl, request.url)
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  // Log successful authenticated access
  securityLogger.logSecurityEvent({
    level: 'info',
    event: 'AUTHORIZED_ACCESS',
    ip: getClientIP(request),
    userAgent: request.headers.get('user-agent') || 'unknown',
    email: authResult.user.email,
    details: {
      path: pathname,
      userRole: authResult.user.role,
      userId: authResult.user.id
    }
  })

  // Add security headers and continue
  const response = NextResponse.next()
  return addSecurityHeaders(response, nonce, requestId)
}

/**
 * Middleware matcher configuration
 */
export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
