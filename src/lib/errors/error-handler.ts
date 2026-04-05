/**
 * Error Handler Utility
 *
 * Centralized error handling for API routes
 * SECURITY: Sanitize all errors before sending to client
 *
 * COMPLIANCE: PCI-DSS 6.5.5 (Proper error handling)
 */

import { NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'
import { AppError, ErrorCode, sanitizeError, createErrorResponse } from './error-codes'

export interface ErrorContext {
  userId?: string
  endpoint?: string
  method?: string
  ip?: string
  userAgent?: string
  requestId?: string
  [key: string]: unknown
}

/**
 * Log error with context
 */
function logError(error: unknown, context: ErrorContext): void {
  const sanitized = sanitizeError(error, ErrorCode.SYS_INTERNAL_ERROR, context.requestId)

  logger.error('API Error', {
    code: sanitized.code,
    message: sanitized.message,
    httpStatus: sanitized.httpStatus,
    userId: context.userId,
    endpoint: context.endpoint,
    method: context.method,
    ip: context.ip,
    requestId: context.requestId,
    timestamp: sanitized.timestamp,
    // SECURITY: Log full error details only in non-production
    ...(process.env.NODE_ENV !== 'production' && error instanceof Error
      ? {
          errorName: error.name,
          errorStack: error.stack,
        }
      : {}),
  })
}

/**
 * Handle API errors and return sanitized response
 *
 * Usage in API routes:
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   try {
 *     // ... your code
 *   } catch (error) {
 *     return handleApiError(error, {
 *       endpoint: '/api/loan/apply',
 *       method: 'POST',
 *       requestId: request.headers.get('x-request-id') || undefined
 *     })
 *   }
 * }
 * ```
 */
export function handleApiError(error: unknown, context: ErrorContext = {}): NextResponse {
  // Log the error
  logError(error, context)

  // Sanitize error for client
  const sanitized = sanitizeError(error, ErrorCode.SYS_INTERNAL_ERROR, context.requestId)

  // Return sanitized response
  return NextResponse.json(
    {
      error: {
        code: sanitized.code,
        message: sanitized.userMessage, // Only user-safe message
        timestamp: sanitized.timestamp,
        requestId: sanitized.requestId,
        // DEVELOPMENT ONLY: Include full details
        ...(process.env.NODE_ENV === 'development' && process.env.SHOW_ERROR_DETAILS === 'true'
          ? {
              _dev: {
                internalMessage: sanitized.message,
                details: sanitized.details,
              },
            }
          : {}),
      },
    },
    {
      status: sanitized.httpStatus,
      headers: {
        'Content-Type': 'application/json',
        ...(context.requestId ? { 'X-Request-ID': context.requestId } : {}),
      },
    }
  )
}

/**
 * Create success response with consistent format
 */
export function createSuccessResponse<T>(
  data: T,
  options: {
    message?: string
    metadata?: Record<string, unknown>
    requestId?: string
    status?: number
  } = {}
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
      ...(options.message ? { message: options.message } : {}),
      ...(options.metadata ? { metadata: options.metadata } : {}),
      timestamp: new Date().toISOString(),
      ...(options.requestId ? { requestId: options.requestId } : {}),
    },
    {
      status: options.status || 200,
      headers: {
        'Content-Type': 'application/json',
        ...(options.requestId ? { 'X-Request-ID': options.requestId } : {}),
      },
    }
  )
}

/**
 * Throw standardized app error
 */
export function throwAppError(code: ErrorCode, details?: Record<string, unknown>): never {
  const error = createErrorResponse(code, details)
  throw error
}

/**
 * Validation error helper
 */
export function throwValidationError(field: string, issue: string): never {
  throwAppError(ErrorCode.VAL_INVALID_INPUT, {
    field,
    issue,
  })
}

/**
 * Check if error is AppError
 */
export function isAppError(error: unknown): error is AppError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'userMessage' in error &&
    'httpStatus' in error
  )
}
