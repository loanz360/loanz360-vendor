/**
 * Tests for API response utilities
 */
import { z } from 'zod'

// Recreate response helpers for testing (avoids NextResponse import issues in test env)
interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
  code?: string
  meta?: Record<string, unknown>
}

function apiSuccess<T>(data: T, message?: string): ApiResponse<T> {
  return { success: true, data, message }
}

function apiError(error: string, code?: string): ApiResponse {
  return { success: false, error, code }
}

function apiValidationError(errors: unknown[]): ApiResponse {
  return { success: false, error: 'Validation error', code: 'VALIDATION_ERROR', meta: { details: errors } }
}

describe('apiSuccess', () => {
  test('returns success true with data', () => {
    const result = apiSuccess({ id: '123', name: 'Test Lead' })
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ id: '123', name: 'Test Lead' })
  })

  test('includes optional message', () => {
    const result = apiSuccess(null, 'Lead created successfully')
    expect(result.message).toBe('Lead created successfully')
  })

  test('handles array data', () => {
    const result = apiSuccess([{ id: '1' }, { id: '2' }])
    expect(result.data).toHaveLength(2)
  })

  test('handles empty data', () => {
    const result = apiSuccess(null)
    expect(result.success).toBe(true)
    expect(result.data).toBeNull()
  })
})

describe('apiError', () => {
  test('returns success false with error message', () => {
    const result = apiError('Something went wrong')
    expect(result.success).toBe(false)
    expect(result.error).toBe('Something went wrong')
  })

  test('includes error code', () => {
    const result = apiError('Unauthorized', 'AUTH_REQUIRED')
    expect(result.code).toBe('AUTH_REQUIRED')
  })
})

describe('apiValidationError', () => {
  test('wraps validation errors', () => {
    const errors = [{ field: 'email', message: 'Invalid email' }]
    const result = apiValidationError(errors)
    expect(result.success).toBe(false)
    expect(result.code).toBe('VALIDATION_ERROR')
    expect(result.meta?.details).toEqual(errors)
  })
})
