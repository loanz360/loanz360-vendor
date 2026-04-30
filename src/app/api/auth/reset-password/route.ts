
/**
 * Reset Password API
 * Updates user password using reset token
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseAdmin, createClient } from '@/lib/supabase/server'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/auth/database-rate-limiter'
import { logAuthEvent } from '@/lib/auth/secure-logger'
import { logger } from '@/lib/utils/logger'
import { z } from 'zod'
import { validateJsonContentType, createContentTypeErrorResponse } from '@/lib/middleware/content-type-validator'
import { passwordSchema } from '@/lib/validation/password-policy'
import { checkPasswordHistory, savePasswordHistory } from '@/lib/auth/password-history'
import { getClientIP } from '@/lib/utils/request-helpers'
import { API_ERRORS, createErrorResponse } from '@/lib/utils/api-errors'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

const resetPasswordSchema = z.object({
  password: passwordSchema, // Enterprise-grade 12+ character password policy
  token: z.string().optional(), // Recovery token from URL
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
    const rateLimitResult = await checkRateLimit(clientIP, '/api/auth/reset-password')

    if (!rateLimitResult.allowed) {
      await logAuthEvent.warn('PASSWORD_RESET_RATE_LIMIT_EXCEEDED', {
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

    // Parse and validate request body
    const body = await request.json()
    const validation = resetPasswordSchema.safeParse(body)

    if (!validation.success) {
      // SECURITY FIX HIGH-02: Generic error message
      return NextResponse.json(
        createErrorResponse(API_ERRORS.VALIDATION_PASSWORD_WEAK, validation.error, { ip: clientIP }),
        { status: 400 }
      )
    }

    const { password } = validation.data

    // Get authenticated user from Supabase session (password reset flow sets a session)
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      await logAuthEvent.warn('PASSWORD_RESET_NO_SESSION', {
        ip: clientIP,
        error: userError?.message,
      })

      return NextResponse.json(
        { error: API_ERRORS.TOKEN_INVALID },
        { status: 401 }
      )
    }

    // SECURITY FIX HIGH-02: Check password history before allowing password reset
    const historyCheck = await checkPasswordHistory(user.id, password)
    if (!historyCheck.allowed) {
      await logAuthEvent.warn('PASSWORD_RESET_REUSED', {
        userId: user.id,
        email: user.email,
        ip: clientIP,
      })

      return NextResponse.json(
        {
          success: false,
          error: historyCheck.message || 'Password was used recently. Please choose a different password.',
        },
        { status: 400 }
      )
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    })

    if (updateError) {
      logger.error('Failed to update password', updateError as Error, {
        userId: user.id,
        email: user.email,
        ip: clientIP
      })

      await logAuthEvent.error('PASSWORD_UPDATE_FAILED', {
        userId: user.id,
        email: user.email,
        ip: clientIP,
        error: updateError.message,
      })

      return NextResponse.json(
        createErrorResponse(API_ERRORS.INTERNAL_ERROR, updateError, { userId: user.id }),
        { status: 500 }
      )
    }

    // Record password change timestamp in profiles
    // Create Supabase admin client
    const supabaseAdmin = createSupabaseAdmin()

    await supabaseAdmin
      .from('profiles')
      .update({
        password_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', user.id)

    // SECURITY FIX HIGH-02: Save password to history for future checks
    // Note: We need to get the password hash from auth.users since Supabase handles hashing
    // For now, we'll hash it ourselves for history tracking (suboptimal but necessary)
    const bcrypt = await import('bcrypt')
    const passwordHash = await bcrypt.hash(password, 12)
    await savePasswordHistory(user.id, passwordHash)

    await logAuthEvent.info('PASSWORD_RESET_SUCCESS', {
      userId: user.id,
      email: user.email,
      ip: clientIP,
      userAgent,
    })

    return NextResponse.json({
      success: true,
      message: 'Password has been successfully reset. You can now log in with your new password.',
    })
  } catch (error) {
    logger.error('Reset password error', error as Error, { ip: clientIP })

    await logAuthEvent.error('PASSWORD_RESET_ERROR', {
      ip: clientIP,
      error: 'Internal server error',
    })

    return NextResponse.json(
      createErrorResponse(API_ERRORS.INTERNAL_ERROR, error, { ip: clientIP }),
      { status: 500 }
    )
  }
}
