/**
 * Content-Type Validation Middleware
 * Protects against CSRF, content smuggling, and XSS attacks
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export interface ContentTypeValidationOptions {
  allowedTypes?: string[]
  required?: boolean
  strict?: boolean
}

const DEFAULT_ALLOWED_TYPES = [
  'application/json',
  'application/x-www-form-urlencoded',
  'multipart/form-data'
]

/**
 * Validate Content-Type header for API requests
 *
 * SECURITY: This prevents:
 * - CSRF attacks (by requiring specific content types)
 * - Content smuggling attacks
 * - XSS through JSON endpoints
 * - Request header manipulation
 */
export function validateContentType(
  request: NextRequest,
  options: ContentTypeValidationOptions = {}
): { valid: boolean; error?: string; status?: number } {
  const {
    allowedTypes = DEFAULT_ALLOWED_TYPES,
    required = true,
    strict = true
  } = options

  // Only validate POST, PUT, PATCH, DELETE (not GET)
  const method = request.method
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return { valid: true }
  }

  const contentType = request.headers.get('content-type')

  // Check if Content-Type is required but missing
  if (required && !contentType) {
    return {
      valid: false,
      error: 'Content-Type header is required',
      status: 415 // Unsupported Media Type
    }
  }

  // If Content-Type is not required and missing, allow
  if (!required && !contentType) {
    return { valid: true }
  }

  // Extract base content type (before semicolon)
  const baseContentType = contentType?.split(';')[0].trim().toLowerCase()

  // Check if content type is allowed
  const isAllowed = allowedTypes.some(allowedType => {
    if (strict) {
      return baseContentType === allowedType.toLowerCase()
    } else {
      return baseContentType?.includes(allowedType.toLowerCase())
    }
  })

  if (!isAllowed) {
    return {
      valid: false,
      error: `Content-Type must be one of: ${allowedTypes.join(', ')}`,
      status: 415
    }
  }

  return { valid: true }
}

/**
 * Create content-type validation error response
 */
export function createContentTypeErrorResponse(
  error: string,
  status: number = 415
): NextResponse {
  return NextResponse.json(
    {
      error,
      code: 'INVALID_CONTENT_TYPE',
      acceptedTypes: DEFAULT_ALLOWED_TYPES
    },
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'X-Content-Type-Options': 'nosniff'
      }
    }
  )
}

/**
 * Validate JSON content type specifically
 */
export function validateJsonContentType(
  request: NextRequest
): { valid: boolean; error?: string; status?: number } {
  return validateContentType(request, {
    allowedTypes: ['application/json'],
    required: true,
    strict: true
  })
}

/**
 * Validate form data content type
 */
export function validateFormContentType(
  request: NextRequest
): { valid: boolean; error?: string; status?: number } {
  return validateContentType(request, {
    allowedTypes: [
      'application/x-www-form-urlencoded',
      'multipart/form-data'
    ],
    required: true,
    strict: false
  })
}

/**
 * Higher-order function to wrap API route handlers with content-type validation
 */
export function withContentTypeValidation(
  handler: (request: NextRequest, ...args: unknown[]) => Promise<NextResponse>,
  options?: ContentTypeValidationOptions
) {
  return async (request: NextRequest, ...args: unknown[]): Promise<NextResponse> => {
    const validation = validateContentType(request, options)

    if (!validation.valid) {
      return createContentTypeErrorResponse(
        validation.error || 'Invalid Content-Type',
        validation.status
      )
    }

    return handler(request, ...args)
  }
}

/**
 * Helper to validate and parse JSON body with content-type check
 */
export async function validateAndParseJson<T = unknown>(
  request: NextRequest
): Promise<{ success: true; data: T } | { success: false; error: NextResponse }> {
  const validation = validateJsonContentType(request)

  if (!validation.valid) {
    return {
      success: false,
      error: createContentTypeErrorResponse(
        validation.error || 'Invalid Content-Type',
        validation.status
      )
    }
  }

  try {
    const data = await request.json()
    return { success: true, data }
  } catch {
    return {
      success: false,
      error: NextResponse.json(
        {
          error: 'Invalid JSON body',
          code: 'INVALID_JSON'
        },
        { status: 400 }
      )
    }
  }
}
