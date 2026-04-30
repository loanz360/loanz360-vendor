
/**
 * Super Admin Login
 * SECURITY FIX HIGH-01: Full security controls added
 * - Rate limiting
 * - CSRF validation
 * - Comprehensive logging
 * - No debug information in responses
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { checkRateLimit, recordFailedAttempt, getRateLimitHeaders } from '@/lib/auth/database-rate-limiter'
import { logAuthEvent } from '@/lib/auth/secure-logger'
import { validateCSRFToken } from '@/lib/security/csrf'
import { getClientIP } from '@/lib/utils/request-helpers'
import { validateJsonContentType, createContentTypeErrorResponse } from '@/lib/middleware/content-type-validator'
import { API_ERRORS } from '@/lib/utils/api-errors'
import bcrypt from 'bcrypt'
import crypto from 'crypto'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

// API Route Runtime: Node.js (uses crypto/bcrypt)
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  // SECURITY FIX HIGH-01: Validate Content-Type header
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
    // SECURITY FIX HIGH-01: Rate limiting
    const rateLimitResult = await checkRateLimit(clientIP, '/api/superadmin/auth/simple-login', 5, 900000) // 5 attempts per 15 min

    if (!rateLimitResult.allowed) {
      await logAuthEvent.warn('SUPER_ADMIN_LOGIN_RATE_LIMIT_EXCEEDED', {
        ip: clientIP,
        userAgent,
      })

      return NextResponse.json(
        {
          error: API_ERRORS.RATE_LIMIT_EXCEEDED,
          rateLimited: true,
        },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult),
        }
      )
    }

    // SECURITY FIX HIGH-01: CSRF validation
    const csrfValid = await validateCSRFToken(request)
    if (!csrfValid) {
      await logAuthEvent.error('SUPER_ADMIN_LOGIN_CSRF_FAILED', {
        ip: clientIP,
        userAgent,
      })

      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      await recordFailedAttempt(clientIP, '/api/superadmin/auth/simple-login', undefined, userAgent)
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 }
      )
    }

    // Create Supabase admin client with error handling
    let supabaseAdmin
    try {
      supabaseAdmin = createSupabaseAdmin()
    } catch (error) {
      logger.error('Failed to create Supabase admin client', error as Error, {
        endpoint: '/api/superadmin/auth/simple-login',
        hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      })
      return NextResponse.json(
        { error: 'Server configuration error. Please contact administrator.' },
        { status: 500 }
      )
    }

    // Find admin
    const { data: admin, error } = await supabaseAdmin
      .from('super_admins')
      .select('id, email, full_name, password_hash, is_active, is_locked')
      .eq('email', email)
      .maybeSingle()

    if (error || !admin) {
      await recordFailedAttempt(clientIP, '/api/superadmin/auth/simple-login', email, userAgent)
      await logAuthEvent.warn('SUPER_ADMIN_LOGIN_INVALID_EMAIL', {
        email,
        ip: clientIP,
        userAgent,
      })

      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Check account status (handle NULL values explicitly)
    // If is_active is NULL, treat as TRUE (active by default)
    // If is_locked is NULL, treat as FALSE (unlocked by default)
    const isActive = admin.is_active !== false // NULL or TRUE = active
    const isLocked = admin.is_locked === true  // Only TRUE = locked

    if (!isActive || isLocked) {
      await logAuthEvent.error('SUPER_ADMIN_LOGIN_ACCOUNT_DISABLED', {
        email,
        adminId: admin.id,
        isActive: admin.is_active,
        isLocked: admin.is_locked,
        ip: clientIP,
      })

      return NextResponse.json(
        { success: false, error: 'Account inactive or locked' },
        { status: 403 }
      )
    }

    // Check if password_hash exists (critical security check)
    if (!admin.password_hash || admin.password_hash.trim() === '') {
      await logAuthEvent.error('SUPER_ADMIN_LOGIN_MISSING_PASSWORD_HASH', {
        email,
        adminId: admin.id,
        ip: clientIP,
      })

      return NextResponse.json(
        { success: false, error: 'Account configuration error. Please contact administrator.' },
        { status: 500 }
      )
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, admin.password_hash)
    if (!passwordMatch) {
      await recordFailedAttempt(clientIP, '/api/superadmin/auth/simple-login', email, userAgent)
      await logAuthEvent.warn('SUPER_ADMIN_LOGIN_INVALID_PASSWORD', {
        email,
        adminId: admin.id,
        ip: clientIP,
        userAgent,
      })

      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // SECURITY FIX C4: Use cryptographically secure session ID
    const sessionId = `sa_${crypto.randomUUID()}_${crypto.randomBytes(16).toString('hex')}`
    // Hash the session ID before storing in database
    const tokenHash = crypto.createHash('sha256').update(sessionId).digest('hex')

    // Get IP address - extract first IP if multiple (handles proxy chains)
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     request.headers.get('x-real-ip') ||
                     null

    try {
      // Try to use database function for atomic session creation
      // This handles all validation, updates, and audit logging in a single transaction
      const { data: sessionResult, error: sessionError } = await supabaseAdmin
        .rpc('create_super_admin_session', {
          p_super_admin_id: admin.id,
          p_session_id: sessionId,
          p_token_hash: tokenHash, // SECURITY FIX C4: Store hash, not plaintext
          p_ip_address: ipAddress,
          p_user_agent: request.headers.get('user-agent') || 'unknown',
          p_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
        })

      // Check if function doesn't exist (backward compatibility during deployment)
      if (sessionError && (sessionError.message?.includes('function') || sessionError.code === '42883')) {
        logger.warn('Database function not found, falling back to direct insert', {
          error: sessionError.message,
          admin_id: admin.id
        })

        // FALLBACK: Direct INSERT (will be removed once all instances have the function)
        const { error: insertError } = await supabaseAdmin
          .from('super_admin_sessions')
          .insert({
            super_admin_id: admin.id,
            session_id: sessionId,
            token_hash: tokenHash, // SECURITY FIX C4: Store hash, not plaintext
            ip_address: ipAddress,
            user_agent: request.headers.get('user-agent') || 'unknown',
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            created_at: new Date().toISOString(),
            last_activity: new Date().toISOString(),
            is_active: true
          })

        if (insertError) {
          logger.error('Fallback session creation failed', new Error(insertError.message), {
            error: insertError,
            admin_id: admin.id,
            table: 'super_admin_sessions'
          })
          return NextResponse.json(
            { success: false, error: 'Failed to create session. Please contact administrator.' },
            { status: 500 }
          )
        }

        // Update last login manually in fallback mode
        await supabaseAdmin
          .from('super_admins')
          .update({
            last_login: new Date().toISOString(),
            failed_login_attempts: 0,
            last_failed_login: null
          })
          .eq('id', admin.id)

        logger.info('Session created successfully (fallback mode)', {
          admin_id: admin.id,
          email: admin.email
        })

      } else if (sessionError) {
        // Other RPC errors
        logger.error('Session creation RPC error', new Error(sessionError.message), {
          error: sessionError,
          function: 'create_super_admin_session',
          admin_id: admin.id,
          error_code: sessionError.code,
          error_details: JSON.stringify(sessionError)
        })
        return NextResponse.json(
          { success: false, error: 'Failed to create session. Please contact administrator.' },
          { status: 500 }
        )
      } else {
        // Success case - function returned result
        const result = Array.isArray(sessionResult) && sessionResult.length > 0 ? sessionResult[0] : null

        if (!result || !result.success) {
          const errorMsg = result?.error_message || 'Unknown session creation error'
          logger.error('Session creation failed', new Error(errorMsg), {
            admin_id: admin.id,
            error_message: errorMsg,
            result: JSON.stringify(result)
          })
          return NextResponse.json(
            { success: false, error: 'Failed to create session. Please contact administrator.' },
            { status: 500 }
          )
        }

        logger.info('Session created successfully', {
          admin_id: admin.id,
          session_uuid: result.session_uuid,
          email: admin.email
        })
      }

    } catch (sessionErr) {
      logger.error('Session error', sessionErr instanceof Error ? sessionErr : new Error(String(sessionErr)), {
        admin_id: admin.id,
        error_type: sessionErr instanceof Error ? sessionErr.constructor.name : typeof sessionErr,
        error_message: sessionErr instanceof Error ? sessionErr.message : String(sessionErr),
        stack: sessionErr instanceof Error ? sessionErr.stack : undefined
      })
      return NextResponse.json(
        { success: false, error: 'Session error. Please try again or contact administrator.' },
        { status: 500 }
      )
    }

    // SECURITY FIX HIGH-01: Log successful login
    await logAuthEvent.info('SUPER_ADMIN_LOGIN_SUCCESS', {
      email,
      adminId: admin.id,
      ip: clientIP,
      userAgent,
    })

    // Success response (NO DEBUG INFO)
    const response = NextResponse.json({
      success: true,
      user: {
        id: admin.id,
        email: admin.email,
        fullName: admin.full_name,
        role: 'SUPER_ADMIN'
      }
      // SECURITY FIX HIGH-01: Debug information removed
    })

    // Set simple cookie with proper settings for Vercel
    const isProduction = process.env.NODE_ENV === 'production';

    response.cookies.set('super_admin_session', sessionId, {
      httpOnly: true,
      secure: isProduction, // Only use secure in production (HTTPS)
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours in seconds
      path: '/',
      // Don't set domain - let it default to current domain
    })

    // Also set a non-httpOnly cookie for client-side verification
    response.cookies.set('super_admin_auth', 'true', {
      httpOnly: false, // Allow JavaScript to read this
      secure: isProduction, // Only use secure in production (HTTPS)
      sameSite: 'lax',
      maxAge: 24 * 60 * 60,
      path: '/'
    })

    return response

  } catch (error) {
    logger.error('Super admin login error', error instanceof Error ? error : new Error(String(error)), {
      ip: clientIP,
      userAgent,
      errorStack: error instanceof Error ? error.stack : undefined,
    })

    await logAuthEvent.error('SUPER_ADMIN_LOGIN_ERROR', {
      ip: clientIP,
      userAgent,
      error: 'Internal server error',
    })

    // SECURITY FIX HIGH-01: No stack trace or detailed error info exposed
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    )
  }
}
