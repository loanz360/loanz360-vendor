/**
 * Generic API Error Messages
 * Security: Prevents information disclosure through error messages
 *
 * SECURITY FIX HIGH-02: Generic error messages for production
 */

import { logger } from './logger'

/**
 * Generic error messages that don't reveal implementation details
 * Use these in API responses to prevent information disclosure
 */
export const API_ERRORS = {
  // Authentication errors
  AUTH_INVALID_CREDENTIALS: 'Invalid email or password',
  AUTH_EMAIL_NOT_VERIFIED: 'Please verify your email address before logging in',
  AUTH_ACCOUNT_DISABLED: 'Your account has been disabled. Please contact support',
  AUTH_UNAUTHORIZED: 'Unauthorized access',
  AUTH_SESSION_EXPIRED: 'Your session has expired. Please log in again',
  AUTH_REGISTRATION_FAILED: 'Unable to create account. Please try again later',

  // Validation errors
  VALIDATION_FAILED: 'Invalid request data',
  VALIDATION_EMAIL_INVALID: 'Please enter a valid email address',
  VALIDATION_PASSWORD_WEAK: 'Password does not meet security requirements',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again later',
  RATE_LIMIT_ACCOUNT_LOCKED: 'Account temporarily locked due to too many failed attempts',

  // Generic errors
  INTERNAL_ERROR: 'An unexpected error occurred. Please try again later',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable. Please try again later',
  DATABASE_ERROR: 'Unable to process your request. Please try again later',

  // Resource errors
  RESOURCE_NOT_FOUND: 'The requested resource was not found',
  RESOURCE_CONFLICT: 'This resource already exists',

  // Permission errors
  PERMISSION_DENIED: 'You do not have permission to perform this action',

  // Token errors
  TOKEN_INVALID: 'Invalid or expired token',
  TOKEN_MISSING: 'Authentication token is required',

  // CSRF errors
  CSRF_INVALID: 'Invalid request. Please refresh the page and try again',

  // Content-type errors
  CONTENT_TYPE_INVALID: 'Invalid request format',
} as const

/**
 * Log detailed error server-side while returning generic message to client
 *
 * @param genericMessage - Generic error message to return to client
 * @param detailedError - Detailed error for server logs only
 * @param context - Additional context for logging
 */
export function createGenericError(
  genericMessage: string,
  detailedError?: unknown,
  context?: Record<string, unknown>
) {
  // Server-side logging with full details using logger
  if (detailedError) {
    const error = detailedError instanceof Error ? detailedError : new Error(String(detailedError))
    logger.error(genericMessage, error, context)
  }

  // Client response with only generic message
  return {
    error: genericMessage,
  }
}

/**
 * Check if we should expose detailed errors (development only)
 */
export function shouldExposeDetailedErrors(): boolean {
  return (
    process.env.NODE_ENV === 'development' &&
    process.env.SHOW_ERROR_DETAILS === 'true'
  )
}

/**
 * Create error response with conditional detail exposure
 */
export function createErrorResponse(
  genericMessage: string,
  detailedError?: unknown,
  context?: Record<string, unknown>
) {
  if (shouldExposeDetailedErrors() && detailedError) {
    const errorMessage = detailedError instanceof Error
      ? detailedError.message
      : String(detailedError)

    return {
      error: genericMessage,
      details: errorMessage,
      _dev: context,
    }
  }

  return createGenericError(genericMessage, detailedError, context)
}
