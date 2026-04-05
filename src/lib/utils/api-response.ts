import { NextResponse } from 'next/server'

interface ApiResponseOptions<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
  meta?: Record<string, unknown>
  code?: string
}

export function apiResponse<T>(options: ApiResponseOptions<T>, status = 200) {
  return NextResponse.json(options, { status })
}

export function apiSuccess<T>(data: T, message?: string, meta?: Record<string, unknown>) {
  return apiResponse({ success: true, data, message, meta })
}

export function apiError(error: string, status = 500, code?: string) {
  return apiResponse({ success: false, error, code }, status)
}

export function apiValidationError(errors: unknown[]) {
  return apiResponse({ success: false, error: 'Validation error', code: 'VALIDATION_ERROR', meta: { details: errors } }, 400)
}

export function apiUnauthorized(message = 'Unauthorized') {
  return apiResponse({ success: false, error: message, code: 'UNAUTHORIZED' }, 401)
}

export function apiForbidden(message = 'Forbidden') {
  return apiResponse({ success: false, error: message, code: 'FORBIDDEN' }, 403)
}

export function apiNotFound(message = 'Not found') {
  return apiResponse({ success: false, error: message, code: 'NOT_FOUND' }, 404)
}
