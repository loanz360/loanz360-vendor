import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
// Commented out imports that don't exist - not needed for simple login
// import { verifySessionToken, verifyAccessToken } from './tokens-edge'
// import { isTokenOrSessionInvalid } from './token-blacklist-edge'
import { createMiddlewareClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'

export interface AuthUser {
  id: string
  email: string
  role: string
  sub_role?: string
  sessionId?: string
}

export interface AuthResult {
  isAuthenticated: boolean
  user?: AuthUser
  redirectUrl?: string
  error?: string
  response?: NextResponse
}

// Define route protection rules
export const ROUTE_PROTECTION = {
  // Super admin routes
  '/superadmin': ['SUPER_ADMIN'],
  '/api/superadmin': ['SUPER_ADMIN'],
  '/api/database': ['SUPER_ADMIN'],
  '/api/ulap': ['SUPER_ADMIN'], // ULAP loan categories API

  // Admin routes
  '/admin': ['ADMIN', 'SUPER_ADMIN'],
  '/api/admin': ['ADMIN', 'SUPER_ADMIN'],

  // Partner routes (plural) - General partner access
  '/partners': ['PARTNER', 'BUSINESS_ASSOCIATE', 'BUSINESS_PARTNER', 'CHANNEL_PARTNER', 'ADMIN', 'SUPER_ADMIN'],
  '/api/partners': ['PARTNER', 'BUSINESS_ASSOCIATE', 'BUSINESS_PARTNER', 'CHANNEL_PARTNER', 'ADMIN', 'SUPER_ADMIN'],

  // Partner sub-role specific routes - Granular access control
  '/partners/ba': ['BUSINESS_ASSOCIATE', 'ADMIN', 'SUPER_ADMIN'],
  '/api/partners/ba': ['BUSINESS_ASSOCIATE', 'ADMIN', 'SUPER_ADMIN'],
  '/partners/bp': ['BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'],
  '/api/partners/bp': ['BUSINESS_PARTNER', 'ADMIN', 'SUPER_ADMIN'],
  '/partners/cp': ['CHANNEL_PARTNER', 'ADMIN', 'SUPER_ADMIN'],
  '/api/partners/cp': ['CHANNEL_PARTNER', 'ADMIN', 'SUPER_ADMIN'],

  // Customer routes (plural) - General customer access
  '/customers': ['CUSTOMER', 'ADMIN', 'SUPER_ADMIN'],
  '/api/customers': ['CUSTOMER', 'ADMIN', 'SUPER_ADMIN'],

  // Customer sub-role specific routes - Granular access control
  '/customers/individual': ['INDIVIDUAL', 'ADMIN', 'SUPER_ADMIN'],
  '/customers/salaried': ['SALARIED', 'ADMIN', 'SUPER_ADMIN'],
  '/customers/proprietor': ['PROPRIETOR', 'ADMIN', 'SUPER_ADMIN'],
  '/customers/partnership': ['PARTNERSHIP', 'ADMIN', 'SUPER_ADMIN'],
  '/customers/pvt-ltd': ['PRIVATE_LIMITED_COMPANY', 'ADMIN', 'SUPER_ADMIN'],
  '/customers/public-ltd': ['PUBLIC_LIMITED_COMPANY', 'ADMIN', 'SUPER_ADMIN'],
  '/customers/llp': ['LLP', 'ADMIN', 'SUPER_ADMIN'],
  '/customers/doctor': ['DOCTOR', 'ADMIN', 'SUPER_ADMIN'],
  '/customers/lawyer': ['LAWYER', 'ADMIN', 'SUPER_ADMIN'],
  '/customers/rental': ['PURE_RENTAL', 'ADMIN', 'SUPER_ADMIN'],
  '/customers/agriculture': ['AGRICULTURE', 'ADMIN', 'SUPER_ADMIN'],
  '/customers/nri': ['NRI', 'ADMIN', 'SUPER_ADMIN'],
  '/customers/ca': ['CHARTERED_ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN'],
  '/customers/cs': ['COMPANY_SECRETARY', 'ADMIN', 'SUPER_ADMIN'],
  '/customers/huf': ['HUF', 'ADMIN', 'SUPER_ADMIN'],

  // Employee routes (plural)
  '/employees': ['EMPLOYEE', 'COLLECTION_AGENT', 'TELE_SALES', 'LOAN_OFFICER', 'ADMIN', 'SUPER_ADMIN'],
  '/api/employees': ['EMPLOYEE', 'COLLECTION_AGENT', 'TELE_SALES', 'LOAN_OFFICER', 'ADMIN', 'SUPER_ADMIN'],

  // Vendor routes (plural)
  '/vendors': ['VENDOR', 'ADMIN', 'SUPER_ADMIN'],
  '/api/vendors': ['VENDOR', 'ADMIN', 'SUPER_ADMIN'],

  // Public routes (no authentication required)
  '/login': null,
  '/register': null,
  '/api/auth': null,
  '/api/register': null,
  '/auth': null, // General auth routes
  '/superadmin/auth': null,
  '/api/superadmin/auth': null,
  '/admin/auth': null,
  '/partners/auth': null,
  '/employees/auth': null,
  '/customers/auth': null,
  '/auth': null,
  '/master': null, // Development portal directory page
} as const

// Extract authentication token from request
function extractToken(request: NextRequest): { token: string | null, tokenType: 'session' | 'bearer' | 'simple' } {
  // Check Authorization header first (for API routes)
  const authHeader = request.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return {
      token: authHeader.substring(7),
      tokenType: 'bearer'
    }
  }

  // Check cookies for session token (for browser requests)
  const sessionToken = request.cookies.get('session-token')?.value
  if (sessionToken) {
    return {
      token: sessionToken,
      tokenType: 'session'
    }
  }

  // Check for simple login session cookie
  const superAdminSession = request.cookies.get('super_admin_session')?.value
  if (superAdminSession) {
    return {
      token: superAdminSession,
      tokenType: 'simple'
    }
  }

  /**
   * SECURITY FIX: Query string token authentication removed
   * Tokens in URL query strings can be:
   * - Logged in browser history
   * - Logged in server logs
   * - Leaked via Referer headers
   * - Exposed in analytics/monitoring tools
   *
   * Only HTTP-Only cookies and Authorization headers are acceptable
   */

  return { token: null, tokenType: 'session' }
}

// Verify super admin authentication
async function verifySuperAdminAuth(token: string, tokenType: 'session' | 'bearer' | 'simple'): Promise<AuthUser | null> {
  try {
    // Handle simple login sessions (direct database lookup)
    if (tokenType === 'simple') {
      const { createSupabaseAdmin } = await import('@/lib/supabase/server')
      const supabase = createSupabaseAdmin()

      // Verify session exists and is not expired (only query essential columns)
      const { data: session, error } = await supabase
        .from('super_admin_sessions')
        .select('super_admin_id, session_id, expires_at')
        .eq('session_id', token)
        .maybeSingle()

      if (error || !session) {
        logger.debug('[Simple Auth] Session not found', { error: error?.message })
        return null
      }

      // Check if session is expired
      const expiresAt = new Date(session.expires_at)
      if (expiresAt < new Date()) {
        logger.debug('[Simple Auth] Session expired', { expiresAt })
        return null
      }

      // Get admin details
      const { data: admin, error: adminError } = await supabase
        .from('super_admins')
        .select('id, email, full_name, is_active, is_locked')
        .eq('id', session.super_admin_id)
        .maybeSingle()

      if (adminError || !admin) {
        logger.debug('[Simple Auth] Admin not found', { error: adminError?.message })
        return null
      }

      // Check admin is active (only if columns exist)
      if (admin.is_active === false || admin.is_locked === true) {
        logger.debug('[Simple Auth] Admin inactive or locked')
        return null
      }

      logger.debug('[Simple Auth] Authentication successful', { adminId: admin.id })
      return {
        id: admin.id,
        email: admin.email,
        role: 'SUPER_ADMIN',
        sessionId: session.session_id
      }
    }

    if (tokenType === 'session' || tokenType === 'bearer') {
      // Complex token verification not available without token-edge imports
      // For now, only simple login is supported
      logger.debug('[Auth] Complex token types not supported yet')
      return null
    }

    return null
  } catch (error) {
    logger.debug('[Auth] Verification error', { error: error instanceof Error ? error.message : 'Unknown' })
    return null
  }
}

// Verify regular user authentication (Supabase)
async function verifySupabaseAuth(request: NextRequest): Promise<{ user: AuthUser | null; response: NextResponse }> {
  try {
    // Create response object for middleware client
    const response = NextResponse.next()
    const supabase = createMiddlewareClient(request, response)

    // Get session from Supabase
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error || !session) {
      logger.debug('[Supabase Auth] No session found', { error: error?.message })
      return { user: null, response }
    }

    logger.debug('[Supabase Auth] Session found', {
      userId: session.user.id,
      email: session.user.email,
      emailConfirmed: session.user.email_confirmed_at
    })

    // Check email verification
    if (!session.user.email_confirmed_at) {
      logger.debug('[Supabase Auth] Email not confirmed')
      return { user: null, response }
    }

    // Get role and sub_role from user metadata (Supabase Auth metadata)
    const role = session.user.user_metadata?.role || session.user.app_metadata?.role
    const sub_role = session.user.user_metadata?.sub_role || session.user.app_metadata?.sub_role

    logger.debug('[Supabase Auth] User data retrieved from metadata', { role, sub_role })
    if (!role || role.trim() === '') {
      logger.debug('[Supabase Auth] Role is empty or missing')
      return { user: null, response }
    }

    logger.debug('[Supabase Auth] Authentication successful', { userId: session.user.id, role, sub_role })

    return {
      user: {
        id: session.user.id,
        email: session.user.email || '',
        role: role,
        sub_role: sub_role
      },
      response
    }
  } catch (error) {
    logger.debug('[Supabase Auth] Exception occurred', { error: error instanceof Error ? error.message : 'Unknown' })
    return { user: null, response: NextResponse.next() }
  }
}

// Check if user has required role for route
function hasRequiredRole(user: AuthUser, requiredRoles: string[]): boolean {
  // Check main role first
  if (requiredRoles.includes(user.role)) {
    return true
  }

  // For partner sub-roles, also check sub_role field
  if (user.sub_role && requiredRoles.includes(user.sub_role)) {
    return true
  }

  return false
}

// Normalize path to prevent path traversal attacks
function normalizePath(pathname: string): string {
  // Remove query parameters and fragments
  const pathOnly = pathname.split('?')[0].split('#')[0]

  // Remove consecutive slashes
  const normalized = pathOnly.replace(/\/+/g, '/')

  // Remove trailing slash except for root
  const withoutTrailing = normalized === '/' ? normalized : normalized.replace(/\/$/, '')

  // Resolve any '..' or '.' segments
  const segments = withoutTrailing.split('/').filter(Boolean)
  const resolved: string[] = []

  for (const segment of segments) {
    if (segment === '..' && resolved.length > 0) {
      resolved.pop()
    } else if (segment !== '.' && segment !== '..') {
      resolved.push(segment)
    }
  }

  return '/' + resolved.join('/')
}

// Get required roles for a route with path traversal protection
function getRequiredRoles(pathname: string): string[] | null {
  // Normalize path to prevent traversal attacks
  const normalizedPath = normalizePath(pathname)

  // Find exact match first
  if (ROUTE_PROTECTION.hasOwnProperty(normalizedPath)) {
    return ROUTE_PROTECTION[normalizedPath as keyof typeof ROUTE_PROTECTION] as string[] | null
  }

  // Find the most specific prefix match
  const matchingRoutes = Object.entries(ROUTE_PROTECTION)
    .filter(([route]) => {
      // Ensure we're matching complete path segments, not partial matches
      return normalizedPath === route || normalizedPath.startsWith(route + '/')
    })
    .sort((a, b) => b[0].length - a[0].length) // Sort by specificity (longest first)

  if (matchingRoutes.length > 0) {
    const roles = matchingRoutes[0][1]
    return roles ? Array.from(roles) : null
  }

  // Default to requiring authentication for unknown routes
  return ['AUTHENTICATED']
}

// Main authentication function
export async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  const pathname = request.nextUrl.pathname

  logger.debug('[Auth Middleware] Authenticating request', { pathname })

  // Get required roles for this route
  const requiredRoles = getRequiredRoles(pathname)

  // If route is public, allow access
  if (requiredRoles === null) {
    logger.debug('[Auth Middleware] Route is public, allowing access')
    return { isAuthenticated: true }
  }

  logger.debug('[Auth Middleware] Route requires roles', { requiredRoles })

  // Extract authentication token
  const { token, tokenType } = extractToken(request)

  let user: AuthUser | null = null
  let supabaseResponse: NextResponse | undefined = undefined

  // Try super admin authentication first if token is present
  if (token) {
    logger.debug('[Auth Middleware] Token found, attempting super admin authentication')
    user = await verifySuperAdminAuth(token, tokenType)
  }

  // If super admin auth failed or no token, try Supabase authentication
  if (!user) {
    logger.debug('[Auth Middleware] Attempting Supabase authentication')
    const supabaseResult = await verifySupabaseAuth(request)
    user = supabaseResult.user
    supabaseResponse = supabaseResult.response
  }

  if (!user) {
    logger.debug('[Auth Middleware] Authentication failed - no user found')
    return {
      isAuthenticated: false,
      redirectUrl: getLoginUrl(pathname),
      error: 'Invalid or expired authentication token',
      response: supabaseResponse
    }
  }

  logger.debug('[Auth Middleware] User authenticated', { userId: user.id, role: user.role, sub_role: user.sub_role })

  // Check if user has required role (checks both role and sub_role)
  if (!hasRequiredRole(user, requiredRoles) && !requiredRoles.includes('AUTHENTICATED')) {
    logger.debug('[Auth Middleware] User lacks required role', { userRole: user.role, userSubRole: user.sub_role, requiredRoles })
    return {
      isAuthenticated: false,
      redirectUrl: '/unauthorized',
      error: `Insufficient permissions. Required: ${requiredRoles.join(', ')}, Has: ${user.role}${user.sub_role ? ` (${user.sub_role})` : ''}`,
      response: supabaseResponse
    }
  }

  logger.debug('[Auth Middleware] Authorization successful')

  return {
    isAuthenticated: true,
    user,
    response: supabaseResponse
  }
}

// Get appropriate login URL based on route
function getLoginUrl(pathname: string): string {
  if (pathname.startsWith('/superadmin')) {
    return '/superadmin/auth/login'
  }
  if (pathname.startsWith('/admin')) {
    return '/admin/auth/login'
  }
  if (pathname.startsWith('/partners')) {
    return '/partners/auth/login'
  }
  if (pathname.startsWith('/employees')) {
    return '/employees/auth/login'
  }
  if (pathname.startsWith('/customers')) {
    return '/customers/auth/login'
  }
  if (pathname.startsWith('/vendors')) {
    return '/auth/login'
  }

  // Default login page
  return '/auth/login'
}

// Check if route should be protected
export function shouldProtectRoute(pathname: string): boolean {
  // Exclude static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') ||
    pathname === '/'
  ) {
    return false
  }

  return true
}