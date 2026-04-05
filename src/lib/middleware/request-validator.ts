/**
 * Request Validation Middleware
 * E9: Standardized request validation for SuperAdmin routes
 */

import { NextRequest, NextResponse } from 'next/server'

/**
 * Sanitize a search string to prevent SQL injection via PostgREST
 */
export function sanitizeSearchInput(search: string): string {
  return search.replace(/[%_'";\\\[\]{}()]/g, '').trim()
}

/**
 * Validate and parse pagination parameters
 */
export function parsePagination(searchParams: URLSearchParams, defaults?: { page?: number; limit?: number; maxLimit?: number }) {
  const { page: defaultPage = 1, limit: defaultLimit = 20, maxLimit = 100 } = defaults || {}

  const page = Math.max(1, parseInt(searchParams.get('page') || String(defaultPage)))
  const limit = Math.min(maxLimit, Math.max(1, parseInt(searchParams.get('limit') || String(defaultLimit))))
  const offset = (page - 1) * limit

  return { page, limit, offset }
}

/**
 * Standard API error response
 */
export function apiError(message: string, status: number = 400, code?: string) {
  return NextResponse.json(
    { success: false, error: message, code: code || 'BAD_REQUEST' },
    { status }
  )
}

/**
 * Standard API success response
 */
export function apiSuccess<T>(data: T, meta?: { page?: number; limit?: number; total?: number }) {
  return NextResponse.json({
    success: true,
    data,
    ...(meta && {
      meta: {
        page: meta.page,
        limit: meta.limit,
        total: meta.total,
        totalPages: meta.total && meta.limit ? Math.ceil(meta.total / meta.limit) : undefined,
      },
    }),
  })
}
