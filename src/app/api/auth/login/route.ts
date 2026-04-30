import { parseBody } from '@/lib/utils/parse-body'

/**
 * User Login API
 * Authenticates users and returns session
 *
 * SECURITY FIX HIGH-06: Proper TypeScript types
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, recordFailedAttempt, clearFailedAttempts, getRateLimitHeaders } from '@/lib/auth/database-rate-limiter'
import { logAuthEvent } from '@/lib/auth/secure-logger'
import { logger } from '@/lib/utils/logger'
import { z } from 'zod'
import { sanitizeAuthInput } from '@/lib/security/input-sanitizer'
import { validateJsonContentType, createContentTypeErrorResponse } from '@/lib/middleware/content-type-validator'
import { getClientIP } from '@/lib/utils/request-helpers'
import type { UserProfile } from '@/types/database'
import { API_ERRORS, createErrorResponse } from '@/lib/utils/api-errors'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long'),
})

export async function POST(request: NextRequest) {
  // SECURITY: Validate Content-Type header (prevents CSRF, content smuggling, XSS)
  const contentTypeValidation = validateJsonContentType(request)
  if (!contentTypeValidation.valid) {
    return createContentTypeErrorResponse(
      contentTypeValidation.error || 'Invalid Content-Type',
      contentTypeValidation.status
    )
  }

  const clientIP = getClientIP(request)
  const userAgent = request.headers.get('user-agent') || 'unknown'

  try {
    // Rate limiting
    const rateLimitResult = await checkRateLimit(clientIP, '/api/auth/login')

    if (!rateLimitResult.allowed) {
      await logAuthEvent.warn('LOGIN_RATE_LIMIT_EXCEEDED', {
        ip: clientIP,
        userAgent,
        isLockedOut: rateLimitResult.isLockedOut,
      })

      return NextResponse.json(
        {
          error: rateLimitResult.isLockedOut
            ? API_ERRORS.RATE_LIMIT_ACCOUNT_LOCKED
            : API_ERRORS.RATE_LIMIT_EXCEEDED,
          rateLimited: true,
          resetTime: rateLimitResult.resetTime,
        },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult),
        }
      )
    }

    // Parse and validate request body
    const { data: body, error: _valErr } = await parseBody(request, z.object({}).passthrough())
    if (_valErr) return _valErr
    // SECURITY FIX: Sanitize inputs BEFORE validation
    const sanitizedBody = sanitizeAuthInput(body)
    const validation = loginSchema.safeParse(sanitizedBody)

    if (!validation.success) {
      await recordFailedAttempt(clientIP, '/api/auth/login', undefined, userAgent)

      // SECURITY FIX HIGH-02: Generic error message, log details server-side
      return NextResponse.json(
        createErrorResponse(API_ERRORS.VALIDATION_FAILED, validation.error, { ip: clientIP }),
        { status: 400 }
      )
    }

    const { email, password } = validation.data

    // Attempt login with Supabase
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error || !data.user) {
      await recordFailedAttempt(clientIP, '/api/auth/login', email, userAgent)

      await logAuthEvent.warn('LOGIN_FAILED', {
        email,
        ip: clientIP,
        error: error?.message,
      })

      return NextResponse.json(
        { error: API_ERRORS.AUTH_INVALID_CREDENTIALS },
        {
          status: 401,
          headers: getRateLimitHeaders(await checkRateLimit(clientIP, '/api/auth/login')),
        }
      )
    }

    // Check email verification
    if (!data.user.email_confirmed_at) {
      await supabase.auth.signOut()

      await logAuthEvent.warn('LOGIN_EMAIL_NOT_VERIFIED', {
        email,
        userId: data.user.id,
        ip: clientIP,
      })

      return NextResponse.json(
        { error: API_ERRORS.AUTH_EMAIL_NOT_VERIFIED },
        { status: 403 }
      )
    }

    // Get user profile and check status
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, status, account_status, avatar_url')
      .eq('id', data.user.id)
      .maybeSingle()

    if (profileError || !profileData) {
      await supabase.auth.signOut()

      await logAuthEvent.error('LOGIN_PROFILE_NOT_FOUND', {
        email,
        userId: data.user.id,
        ip: clientIP,
      })

      return NextResponse.json(
        createErrorResponse(API_ERRORS.DATABASE_ERROR, profileError, { userId: data.user.id }),
        { status: 500 }
      )
    }

    // ✅ SECURITY FIX HIGH-06: Proper TypeScript type instead of 'as any'
    const profile = profileData as UserProfile

    // Check account status
    const status = (profile.status || profile.account_status)?.toLowerCase()
    if (status === 'suspended' || status === 'banned' || status === 'inactive' || status === 'deleted') {
      await supabase.auth.signOut()

      await logAuthEvent.warn('LOGIN_ACCOUNT_STATUS_BLOCKED', {
        email,
        userId: data.user.id,
        status,
        ip: clientIP,
      })

      return NextResponse.json(
        { error: API_ERRORS.AUTH_ACCOUNT_DISABLED },
        { status: 403 }
      )
    }

    // Check role exists
    if (!profile.role) {
      await supabase.auth.signOut()

      await logAuthEvent.error('LOGIN_NO_ROLE_ASSIGNED', {
        email,
        userId: data.user.id,
        ip: clientIP,
      })

      return NextResponse.json(
        createErrorResponse(API_ERRORS.DATABASE_ERROR, 'No role assigned', { userId: data.user.id }),
        { status: 500 }
      )
    }

    // Clear failed login attempts
    await clearFailedAttempts(clientIP, '/api/auth/login')

    // Log successful login
    await logAuthEvent.info('LOGIN_SUCCESS', {
      userId: data.user.id,
      email,
      role: profile.role,
      ip: clientIP,
      userAgent,
    })

    // SECURITY: Tokens are set in HTTP-Only cookies by Supabase client
    // DO NOT expose tokens in JSON response - prevents token interception
    return NextResponse.json({
      success: true,
      message: 'Login successful',
      user: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role,
        avatar_url: profile.avatar_url,
      },
      // Note: Session tokens are securely stored in HTTP-Only cookies
      // and are NOT included in this response for security
    })
  } catch (error) {
    logger.error('Login error', error as Error, { ip: clientIP })

    await logAuthEvent.error('LOGIN_ERROR', {
      ip: clientIP,
      error: 'Internal server error',
    })

    return NextResponse.json(
      createErrorResponse(API_ERRORS.INTERNAL_ERROR, error, { ip: clientIP }),
      { status: 500 }
    )
  }
}
