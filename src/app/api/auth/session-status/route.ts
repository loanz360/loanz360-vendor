/**
 * Session Status API
 *
 * Provides session timeout information for client-side countdown/warning
 * SECURITY: Enforces session timeout validation
 */

import { NextRequest } from 'next/server'
import { getSessionInfo } from '@/lib/auth/session-validation'
import { handleApiError, createSuccessResponse } from '@/lib/errors/error-handler'
import { ErrorCode } from '@/lib/errors/error-codes'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/session-status
 *
 * Returns current session status including time until expiry
 * Used by client to show countdown/warning UI
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  const requestId = request.headers.get('x-request-id') || undefined

  try {
    const sessionInfo = await getSessionInfo()

    if (!sessionInfo || !sessionInfo.valid) {
      return handleApiError(
        {
          code: ErrorCode.AUTH_SESSION_EXPIRED,
          message: 'Session expired',
          userMessage: 'Your session has expired. Please log in again.',
          httpStatus: 401,
        },
        {
          endpoint: '/api/auth/session-status',
          method: 'GET',
          requestId,
        }
      )
    }

    return createSuccessResponse(
      {
        valid: sessionInfo.valid,
        timeUntilExpiry: sessionInfo.timeUntilExpiry,
        expiresAt: sessionInfo.expiresAt,
        sessionAge: sessionInfo.sessionAge,
        idleTime: sessionInfo.idleTime,
        shouldWarn: (sessionInfo.timeUntilExpiry || 0) <= 5 * 60 * 1000, // 5 minutes
      },
      {
        requestId,
      }
    )
  } catch (error) {
    return handleApiError(error, {
      endpoint: '/api/auth/session-status',
      method: 'GET',
      requestId,
    })
  }
}
