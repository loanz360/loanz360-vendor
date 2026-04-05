export const dynamic = 'force-dynamic'

/**
 * Emergency Super Admin Password Reset API
 * Direct password reset for super admins without email requirement
 * USE ONLY for emergency access recovery
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { checkRateLimit, recordFailedAttempt, getRateLimitHeaders } from '@/lib/auth/database-rate-limiter'
import { logAuthEvent } from '@/lib/auth/secure-logger'
import { logger } from '@/lib/utils/logger'
import { z } from 'zod'
import { validateJsonContentType, createContentTypeErrorResponse } from '@/lib/middleware/content-type-validator'
import { getClientIP } from '@/lib/utils/request-helpers'
import { API_ERRORS, createErrorResponse } from '@/lib/utils/api-errors'
import { passwordSchema } from '@/lib/validation/password-policy'
import { checkSuperAdminPasswordHistory, saveSuperAdminPasswordHistory } from '@/lib/auth/password-history'
import bcrypt from 'bcrypt'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

// SECURITY FIX HIGH-03: Use enterprise-grade password policy (12+ chars)
const emergencyResetSchema = z.object({
  email: z.string().email('Invalid email address'),
  newPassword: passwordSchema, // Enterprise-grade: 12+ characters with complexity
  emergencyKey: z.string().min(1, 'Emergency key is required'),
})

// SECURITY FIX CRITICAL-01: Emergency key MUST be set in environment variables
// No default fallback to prevent security vulnerabilities
const EMERGENCY_KEY = process.env.SUPER_ADMIN_EMERGENCY_KEY

// Validate emergency key exists and is strong enough
if (!EMERGENCY_KEY) {
  throw new Error(
    'FATAL SECURITY ERROR: SUPER_ADMIN_EMERGENCY_KEY environment variable is not set. ' +
    'This endpoint cannot function without a secure emergency key.'
  )
}

if (EMERGENCY_KEY.length < 32) {
  throw new Error(
    'FATAL SECURITY ERROR: SUPER_ADMIN_EMERGENCY_KEY must be at least 32 characters long. ' +
    'Current length: ' + EMERGENCY_KEY.length
  )
}

// Optional: IP whitelist for additional security
const EMERGENCY_ALLOWED_IPS = process.env.EMERGENCY_RESET_ALLOWED_IPS?.split(',').map(ip => ip.trim()) || []

// API Route Runtime: Node.js (uses crypto/bcrypt)
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  // SECURITY: Validate Content-Type header
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
    // SECURITY FIX CRITICAL-01: IP whitelist check (if configured)
    if (EMERGENCY_ALLOWED_IPS.length > 0 && !EMERGENCY_ALLOWED_IPS.includes(clientIP)) {
      await logAuthEvent.error('EMERGENCY_RESET_IP_NOT_WHITELISTED', {
        ip: clientIP,
        userAgent,
        allowedIPs: EMERGENCY_ALLOWED_IPS.length
      })

      return NextResponse.json(
        {
          success: false,
          error: 'Access denied. IP address not authorized for emergency reset.'
        },
        { status: 403 }
      )
    }

    // Rate limiting - strict for emergency endpoint
    const rateLimitResult = await checkRateLimit(clientIP, '/api/superadmin/auth/emergency-reset', 3, 3600000) // 3 attempts per hour

    if (!rateLimitResult.allowed) {
      await logAuthEvent.warn('SUPER_ADMIN_EMERGENCY_RESET_RATE_LIMIT_EXCEEDED', {
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
    const validation = emergencyResetSchema.safeParse(body)

    if (!validation.success) {
      await recordFailedAttempt(clientIP, '/api/superadmin/auth/emergency-reset', undefined, userAgent)

      return NextResponse.json(
        createErrorResponse(API_ERRORS.VALIDATION_FAILED, validation.error, { ip: clientIP }),
        { status: 400 }
      )
    }

    const { email, newPassword, emergencyKey } = validation.data

    // Verify emergency key
    if (emergencyKey !== EMERGENCY_KEY) {
      await logAuthEvent.error('SUPER_ADMIN_EMERGENCY_RESET_INVALID_KEY', {
        email,
        ip: clientIP,
        userAgent,
      })

      await recordFailedAttempt(clientIP, '/api/superadmin/auth/emergency-reset', undefined, userAgent)

      return NextResponse.json(
        {
          success: false,
          error: 'Invalid emergency key. Unauthorized access attempt logged.',
        },
        { status: 403 }
      )
    }

    const supabaseAdmin = createSupabaseAdmin()

    // Find super admin
    const { data: superAdmin, error: findError } = await supabaseAdmin
      .from('super_admins')
      .select('id, email, is_active, is_locked')
      .eq('email', email)
      .maybeSingle()

    if (findError || !superAdmin) {
      await logAuthEvent.warn('SUPER_ADMIN_EMERGENCY_RESET_NOT_FOUND', {
        email,
        ip: clientIP,
      })

      return NextResponse.json(
        {
          success: false,
          error: 'Super admin account not found.',
        },
        { status: 404 }
      )
    }

    // SECURITY FIX HIGH-02: Check password history before allowing emergency reset
    const historyCheck = await checkSuperAdminPasswordHistory(superAdmin.id, newPassword)
    if (!historyCheck.allowed) {
      await logAuthEvent.warn('SUPER_ADMIN_EMERGENCY_RESET_PASSWORD_REUSED', {
        email: superAdmin.email,
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

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12)

    // SECURITY FIX HIGH-02: Save to password history
    await saveSuperAdminPasswordHistory(superAdmin.id, passwordHash)

    // Update password and unlock account if locked
    const { error: updateError } = await supabaseAdmin
      .from('super_admins')
      .update({
        password_hash: passwordHash,
        password_changed_at: new Date().toISOString(),
        password_must_change: false,
        password_reset_token: null,
        password_reset_expires: null,
        failed_login_attempts: 0,
        last_failed_login: null,
        is_locked: false, // Unlock account
        is_active: true,  // Activate account
        updated_at: new Date().toISOString()
      } as never)
      .eq('id', superAdmin.id)

    if (updateError) {
      logger.error('Failed to emergency reset super admin password', updateError as Error, {
        email: superAdmin.email,
        ip: clientIP
      })

      await logAuthEvent.error('SUPER_ADMIN_EMERGENCY_RESET_UPDATE_FAILED', {
        email: superAdmin.email,
        ip: clientIP,
        error: updateError.message,
      })

      return NextResponse.json(
        createErrorResponse(API_ERRORS.SERVICE_UNAVAILABLE, updateError, { ip: clientIP }),
        { status: 500 }
      )
    }

    await logAuthEvent.info('SUPER_ADMIN_EMERGENCY_PASSWORD_RESET_SUCCESS', {
      email: superAdmin.email,
      ip: clientIP,
      userAgent,
      previouslyLocked: superAdmin.is_locked,
      previouslyInactive: !superAdmin.is_active,
    })

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully. Account is now active and unlocked. You can login immediately.',
      accountStatus: {
        wasLocked: superAdmin.is_locked,
        wasInactive: !superAdmin.is_active,
        nowActive: true,
        nowUnlocked: true,
      }
    })
  } catch (error) {
    logger.error('Super admin emergency reset error', error as Error, { ip: clientIP })

    await logAuthEvent.error('SUPER_ADMIN_EMERGENCY_RESET_ERROR', {
      ip: clientIP,
      error: 'Internal server error',
    })

    return NextResponse.json(
      createErrorResponse(API_ERRORS.INTERNAL_ERROR, error, { ip: clientIP }),
      { status: 500 }
    )
  }
}
