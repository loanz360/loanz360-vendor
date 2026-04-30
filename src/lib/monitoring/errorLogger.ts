/**
 * Error Logger
 * Centralized error logging for API endpoints
 */

import { NextRequest } from 'next/server'
import logger from './logger'

interface ErrorContext {
  [key: string]: unknown
}

/**
 * Log API errors with context
 */
export function logApiError(
  error: Error,
  request: NextRequest,
  context?: ErrorContext
): void {
  const errorInfo = {
    url: request.url,
    method: request.method,
    path: request.nextUrl.pathname,
    query: Object.fromEntries(request.nextUrl.searchParams),
    userAgent: request.headers.get('user-agent'),
    ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || request.ip,
    ...context,
  }

  logger.error(`API Error: ${error.message}`, error, errorInfo)
}

/**
 * Log validation errors
 */
export function logValidationError(
  message: string,
  request: NextRequest,
  validationErrors: unknown): void {
  logger.warn(`Validation Error: ${message}`, {
    url: request.url,
    method: request.method,
    path: request.nextUrl.pathname,
    errors: validationErrors,
  })
}

/**
 * Log authentication errors
 */
export function logAuthError(message: string, request: NextRequest, userId?: string): void {
  logger.warn(`Auth Error: ${message}`, {
    url: request.url,
    method: request.method,
    path: request.nextUrl.pathname,
    userId,
    ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || request.ip,
  })
}

/**
 * Get error statistics (placeholder)
 */
export function getErrorStats() {
  return {
    total: 0,
    by_level: {},
    by_endpoint: {},
    recent: []
  }
}

/**
 * Clear error logs (placeholder)
 */
export function clearErrorLogs() {
  // Placeholder - implement with actual storage
  return { success: true, message: 'Error logs cleared' }
}

/**
 * Get errors by level (placeholder)
 */
export function getErrorsByLevel(level: string) {
  return []
}

/**
 * Get errors by endpoint (placeholder)
 */
export function getErrorsByEndpoint(endpoint: string) {
  return []
}

/**
 * Get recent errors (placeholder)
 */
export function getRecentErrors(limit: number = 10) {
  return []
}
