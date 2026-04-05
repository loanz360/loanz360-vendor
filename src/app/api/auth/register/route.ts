export const dynamic = 'force-dynamic'

/**
 * User Registration API
 * Creates user account and profile in database
 *
 * SECURITY FIX HIGH-06: Proper TypeScript types
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { checkRateLimit, recordFailedAttempt, getRateLimitHeaders } from '@/lib/auth/database-rate-limiter'
import { logAuthEvent } from '@/lib/auth/secure-logger'
import { logger } from '@/lib/utils/logger'
import { sanitizeAuthInput } from '@/lib/security/input-sanitizer'
import { z } from 'zod'
import { validateJsonContentType, createContentTypeErrorResponse } from '@/lib/middleware/content-type-validator'
import { passwordSchema } from '@/lib/validation/password-policy'
import { getClientIP } from '@/lib/utils/request-helpers'
import type { UserProfile } from '@/types/database'
import { API_ERRORS, createErrorResponse } from '@/lib/utils/api-errors'
import { generatePartnerUniqueId } from '@/lib/utils/partner-id-generator'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: passwordSchema, // Enterprise-grade 12+ character password policy
  full_name: z.string().min(1, 'Full name is required').max(255),
  mobile: z.string().optional(),
  role: z.enum(['CUSTOMER', 'BUSINESS_PARTNER', 'BUSINESS_ASSOCIATE', 'CHANNEL_PARTNER']).optional(),
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

  // Create Supabase admin client
  const supabaseAdmin = createSupabaseAdmin()

  try {
    // Rate limiting - prevent registration abuse
    const rateLimitResult = await checkRateLimit(clientIP, '/api/auth/register')

    if (!rateLimitResult.allowed) {
      await logAuthEvent.warn('REGISTRATION_RATE_LIMIT_EXCEEDED', {
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

    // Sanitize inputs before validation
    const sanitizedBody = sanitizeAuthInput(body)

    const validation = registerSchema.safeParse(sanitizedBody)

    if (!validation.success) {
      await recordFailedAttempt(clientIP, '/api/auth/register', undefined, userAgent)

      // SECURITY FIX HIGH-02: Generic error message, log details server-side
      return NextResponse.json(
        createErrorResponse(API_ERRORS.VALIDATION_FAILED, validation.error, { ip: clientIP }),
        { status: 400 }
      )
    }

    const { email, password, full_name, mobile, role = 'CUSTOMER' } = validation.data

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('email', email)
      .maybeSingle()

    if (existingUser) {
      await logAuthEvent.warn('REGISTRATION_DUPLICATE_EMAIL', {
        email,
        ip: clientIP,
      })

      // SECURITY FIX HIGH-02: Generic error - don't reveal that email exists
      return NextResponse.json(
        { error: API_ERRORS.RESOURCE_CONFLICT },
        { status: 400 }
      )
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // Require email verification
      user_metadata: {
        full_name,
        mobile,
        role,
      },
    })

    if (authError || !authData.user) {
      logger.error('Failed to create auth user', authError as Error, {
        email,
        ip: clientIP
      })

      await logAuthEvent.error('REGISTRATION_AUTH_FAILED', {
        email,
        ip: clientIP,
        error: authError?.message,
      })

      return NextResponse.json(
        createErrorResponse(API_ERRORS.AUTH_REGISTRATION_FAILED, authError, { ip: clientIP }),
        { status: 500 }
      )
    }

    // Create profile record
    // ✅ SECURITY FIX HIGH-06: Proper TypeScript type instead of 'as any'
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        email,
        full_name,
        phone_number: mobile,
        role,
        status: 'active',
        account_status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    } as never)

    if (profileError) {
      logger.error('Failed to create profile', profileError as Error, {
        email,
        userId: authData.user.id,
        ip: clientIP
      })

      // Rollback: Delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)

      await logAuthEvent.error('REGISTRATION_PROFILE_FAILED', {
        email,
        userId: authData.user.id,
        ip: clientIP,
        error: profileError.message,
      })

      return NextResponse.json(
        createErrorResponse(API_ERRORS.DATABASE_ERROR, profileError, { userId: authData.user.id }),
        { status: 500 }
      )
    }

    // Create partner profile with unique ID if registering as partner
    const partnerRoles = ['BUSINESS_PARTNER', 'BUSINESS_ASSOCIATE', 'CHANNEL_PARTNER']
    if (partnerRoles.includes(role)) {
      try {
        // Generate unique ID for partner
        const uniqueId = await generatePartnerUniqueId(role)

        // Create partner profile
        const { error: partnerProfileError } = await supabaseAdmin
          .from('partner_profiles')
          .insert({
            user_id: authData.user.id,
            partner_type: role,
            full_name,
            email,
            phone_number: mobile,
            unique_id: uniqueId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as never)

        if (partnerProfileError) {
          logger.warn('Failed to create partner profile', {
            userId: authData.user.id,
            role,
            error: partnerProfileError.message
          })
          // Don't fail registration if partner profile creation fails
          // It can be created later when they access their profile page
        } else {
          logger.info('Partner profile created', {
            userId: authData.user.id,
            role,
            uniqueId
          })
        }
      } catch (error) {
        logger.warn('Error creating partner profile', {
          userId: authData.user.id,
          role,
          error: 'Internal server error'
        })
        // Don't fail registration
      }
    }

    // Send verification email
    const { error: emailError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
      },
    })

    if (emailError) {
      logger.warn('Failed to send verification email', {
        email,
        userId: authData.user.id,
        error: emailError.message
      })
      // Don't fail registration if email sending fails
    }

    await logAuthEvent.info('REGISTRATION_SUCCESS', {
      userId: authData.user.id,
      email,
      role,
      ip: clientIP,
      userAgent,
    })

    return NextResponse.json({
      success: true,
      message: 'Account created successfully! Please check your email to verify your account.',
      user: {
        id: authData.user.id,
        email,
        full_name,
        role,
      },
    })
  } catch (error) {
    logger.error('Registration error', error as Error, { ip: clientIP })

    await logAuthEvent.error('REGISTRATION_ERROR', {
      ip: clientIP,
      error: 'Internal server error',
    })

    return NextResponse.json(
      createErrorResponse(API_ERRORS.INTERNAL_ERROR, error, { ip: clientIP }),
      { status: 500 }
    )
  }
}
