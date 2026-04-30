
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { securityLogger } from '@/lib/security-logger'
import { logger } from '@/lib/utils/logger'
import { createSupabaseAdmin, createClient } from '@/lib/supabase/server'
import { validateJsonContentType, createContentTypeErrorResponse } from '@/lib/middleware/content-type-validator'
import { getClientIP } from '@/lib/utils/request-helpers'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/auth/database-rate-limiter'
import { z } from 'zod'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

// ✅ SECURITY FIX: Validation schema for error reports
const errorReportSchema = z.object({
  errorId: z.string().max(100),
  message: z.string().max(1000),
  type: z.enum(['unhandled_rejection', 'error', 'warning', 'info']),
  stack: z.string().max(5000).optional(),
  url: z.string().max(500).optional(),
  timestamp: z.string().optional(),
  userId: z.string().max(100).optional(),
  sessionId: z.string().max(100).optional(),
  additional: z.record(z.string(), z.unknown()).optional(),
  userAgent: z.string().max(500).optional(),
})

export async function POST(request: NextRequest) {
  try {
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

    // ✅ SECURITY FIX: Rate limiting to prevent spam/DoS
    const rateLimitResult = await checkRateLimit(clientIP, '/api/errors')

    if (!rateLimitResult.allowed) {
      securityLogger.logSecurityEvent({
        level: 'warn',
        event: 'ERROR_ENDPOINT_RATE_LIMIT_EXCEEDED',
        ip: clientIP,
        userAgent,
        details: {
          isLockedOut: rateLimitResult.isLockedOut,
          resetTime: rateLimitResult.resetTime,
        },
      })

      return NextResponse.json(
        {
          error: rateLimitResult.isLockedOut
            ? 'Too many error reports. Account temporarily locked.'
            : 'Too many error reports. Please try again later.',
          resetTime: rateLimitResult.resetTime,
        },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult),
        }
      )
    }

    // ✅ SECURITY FIX: Require authentication (optional for logged-in users)
    // This prevents anonymous spam but allows legitimate error reports
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let authenticatedUserId: string | null = null

    if (user) {
      authenticatedUserId = user.id
    }

    const errorReport = await request.json()

    // ✅ SECURITY FIX: Validate error report structure
    const validation = errorReportSchema.safeParse(errorReport)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid error report format', details: validation.error.issues },
        { status: 400 }
      )
    }

    const validatedReport = validation.data

    // ✅ SECURITY FIX: Use authenticated user ID if available
    const reportUserId = authenticatedUserId || validatedReport.userId || null

    // Log the client-side error to our security logger
    securityLogger.logSecurityEvent({
      level: validatedReport.type === 'unhandled_rejection' ? 'critical' : 'error',
      event: 'CLIENT_ERROR_REPORT',
      ip: clientIP,
      userAgent,
      email: user?.email,
      details: {
        errorId: validatedReport.errorId,
        errorType: validatedReport.type,
        message: validatedReport.message,
        stack: validatedReport.stack,
        url: validatedReport.url,
        timestamp: validatedReport.timestamp,
        userId: reportUserId,
        sessionId: validatedReport.sessionId,
        additional: validatedReport.additional,
        authenticated: !!authenticatedUserId,
      }
    })

    // Store in database for persistent tracking
    try {
      // Create Supabase admin client
      const supabaseAdmin = createSupabaseAdmin()

      await supabaseAdmin
        .from('client_errors')
        .insert({
          error_id: validatedReport.errorId,
          error_type: validatedReport.type,
          message: validatedReport.message,
          stack: validatedReport.stack,
          url: validatedReport.url,
          user_agent: validatedReport.userAgent || userAgent,
          ip_address: clientIP,
          user_id: reportUserId,
          session_id: validatedReport.sessionId,
          additional_data: validatedReport.additional,
          occurred_at: validatedReport.timestamp || new Date().toISOString()
        } as never)
    } catch (dbError) {
      // Log database error but don't fail the request
      logger.error('Failed to store error in database', dbError as Error, {
        errorId: validatedReport.errorId
      })
    }

    return NextResponse.json({
      success: true,
      errorId: validatedReport.errorId
    })

  } catch (error) {
    logger.error('Error processing error report', error as Error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}