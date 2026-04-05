/**
 * LOANZ360 API Request Validation Middleware
 *
 * SECURITY: Server-side validation for all API requests
 * - Validates request body, query params, headers
 * - Sanitizes all inputs
 * - Rate limiting integration
 * - Audit logging
 *
 * Usage:
 * ```typescript
 * export async function POST(request: Request) {
 *   const validation = await validateAPIRequest(request, loginSchema)
 *   if (!validation.valid) {
 *     return NextResponse.json({ errors: validation.errors }, { status: 400 })
 *   }
 *   const { email, password } = validation.sanitized
 *   // ... rest of handler
 * }
 * ```
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { ValidationRule } from '@/lib/validations/input-sanitization'
import { validateSchema } from '@/lib/validations/input-sanitization'
import { logger } from '@/lib/utils/logger'

export interface APIValidationResult {
  valid: boolean
  sanitized?: Record<string, unknown>
  errors?: Record<string, string>
  statusCode?: number
}

/**
 * Validate API request body against schema
 */
export async function validateAPIRequest(
  request: NextRequest,
  schema: Record<string, ValidationRule>
): Promise<APIValidationResult> {
  try {
    // Parse request body
    let body: Record<string, unknown>

    try {
      body = await request.json()
    } catch (error) {
      logger.warn('Invalid JSON in request body', { error })
      return {
        valid: false,
        errors: { _body: 'Invalid JSON format' },
        statusCode: 400
      }
    }

    // Validate against schema
    const result = validateSchema(body, schema)

    if (!result.valid) {
      logger.warn('API request validation failed', {
        path: request.nextUrl.pathname,
        errors: result.errors
      })

      return {
        valid: false,
        errors: result.errors,
        statusCode: 400
      }
    }

    return {
      valid: true,
      sanitized: result.sanitized
    }
  } catch (error) {
    logger.error('API validation error', error as Error, {
      path: request.nextUrl.pathname
    })

    return {
      valid: false,
      errors: { _system: 'Validation system error' },
      statusCode: 500
    }
  }
}

/**
 * Validate query parameters
 */
export function validateQueryParams(
  request: NextRequest,
  schema: Record<string, ValidationRule>
): APIValidationResult {
  try {
    const params: Record<string, unknown> = {}

    // Extract query parameters
    request.nextUrl.searchParams.forEach((value, key) => {
      params[key] = value
    })

    // Validate against schema
    const result = validateSchema(params, schema)

    if (!result.valid) {
      logger.warn('Query parameter validation failed', {
        path: request.nextUrl.pathname,
        errors: result.errors
      })

      return {
        valid: false,
        errors: result.errors,
        statusCode: 400
      }
    }

    return {
      valid: true,
      sanitized: result.sanitized
    }
  } catch (error) {
    logger.error('Query parameter validation error', error as Error, {
      path: request.nextUrl.pathname
    })

    return {
      valid: false,
      errors: { _system: 'Validation system error' },
      statusCode: 500
    }
  }
}

/**
 * Common validation schemas for reuse
 */

// Authentication schemas
// SECURITY: Enterprise-grade password policy - 12+ characters (Fortune 500 standard)
export const loginSchema: Record<string, ValidationRule> = {
  email: {
    type: 'email',
    required: true
  },
  password: {
    type: 'string',
    required: true,
    minLength: 12,  // Enterprise-grade password policy
    maxLength: 128
  }
}

export const registerSchema: Record<string, ValidationRule> = {
  email: {
    type: 'email',
    required: true
  },
  password: {
    type: 'string',
    required: true,
    minLength: 12,  // Enterprise-grade password policy
    maxLength: 128
  },
  fullName: {
    type: 'string',
    required: true,
    minLength: 2,
    maxLength: 100
  },
  phone: {
    type: 'phone',
    required: true
  }
}

// Super admin schemas
// SECURITY: Super admins must use same enterprise password policy (12+ chars)
export const superAdminLoginSchema: Record<string, ValidationRule> = {
  email: {
    type: 'email',
    required: true
  },
  password: {
    type: 'string',
    required: true,
    minLength: 12  // Enterprise-grade password policy
  },
  mfaCode: {
    type: 'string',
    required: false,
    pattern: /^\d{6}$/
  }
}

// Loan application schemas
export const loanApplicationSchema: Record<string, ValidationRule> = {
  applicantName: {
    type: 'string',
    required: true,
    minLength: 2,
    maxLength: 100
  },
  email: {
    type: 'email',
    required: true
  },
  phone: {
    type: 'phone',
    required: true
  },
  loanAmount: {
    type: 'currency',
    required: true,
    min: 10000,
    max: 10000000
  },
  loanPurpose: {
    type: 'string',
    required: true,
    minLength: 10,
    maxLength: 500
  },
  employmentType: {
    type: 'string',
    required: true,
    pattern: /^(SALARIED|SELF_EMPLOYED|BUSINESS|PROFESSIONAL)$/
  },
  monthlyIncome: {
    type: 'currency',
    required: true,
    min: 0
  },
  pan: {
    type: 'pan',
    required: true
  },
  aadhaar: {
    type: 'aadhaar',
    required: true
  }
}

// Partner schemas
export const partnerRegistrationSchema: Record<string, ValidationRule> = {
  businessName: {
    type: 'string',
    required: true,
    minLength: 2,
    maxLength: 200
  },
  partnerType: {
    type: 'string',
    required: true,
    pattern: /^(BUSINESS_ASSOCIATE|BUSINESS_PARTNER|CHANNEL_PARTNER)$/
  },
  email: {
    type: 'email',
    required: true
  },
  phone: {
    type: 'phone',
    required: true
  },
  pan: {
    type: 'pan',
    required: true
  },
  gstNumber: {
    type: 'string',
    required: false,
    pattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
  },
  bankAccountNumber: {
    type: 'string',
    required: true,
    pattern: /^\d{9,18}$/
  },
  ifscCode: {
    type: 'ifsc',
    required: true
  }
}

// Employee schemas
export const employeeSchema: Record<string, ValidationRule> = {
  fullName: {
    type: 'string',
    required: true,
    minLength: 2,
    maxLength: 100
  },
  email: {
    type: 'email',
    required: true
  },
  phone: {
    type: 'phone',
    required: true
  },
  employeeId: {
    type: 'alphanumeric',
    required: true,
    minLength: 4,
    maxLength: 20
  },
  department: {
    type: 'string',
    required: true
  },
  designation: {
    type: 'string',
    required: true
  },
  role: {
    type: 'string',
    required: true,
    pattern: /^(CREDIT_MANAGER|COLLECTION_MANAGER|SALES_MANAGER|HR_MANAGER|IT_SUPPORT|FINANCE_MANAGER)$/
  }
}

// Payout schemas
export const payoutApprovalSchema: Record<string, ValidationRule> = {
  payoutId: {
    type: 'string',
    required: true
  },
  approvalStatus: {
    type: 'string',
    required: true,
    pattern: /^(APPROVED|REJECTED)$/
  },
  approvalComments: {
    type: 'string',
    required: false,
    maxLength: 500
  },
  approvedAmount: {
    type: 'currency',
    required: true,
    min: 0
  }
}

// Customer schemas
export const customerKYCSchema: Record<string, ValidationRule> = {
  customerId: {
    type: 'string',
    required: true
  },
  pan: {
    type: 'pan',
    required: true
  },
  aadhaar: {
    type: 'aadhaar',
    required: true
  },
  addressProof: {
    type: 'string',
    required: true
  },
  incomeProof: {
    type: 'string',
    required: true
  }
}

/**
 * Validation error response builder
 */
export function validationErrorResponse(
  errors: Record<string, string>,
  statusCode: number = 400
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      errors,
      message: 'Validation failed'
    },
    { status: statusCode }
  )
}

/**
 * Rate limit exceeded response
 */
export function rateLimitErrorResponse(resetTime?: number): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again later.',
      resetTime
    },
    { status: 429 }
  )
}

/**
 * Unauthorized response
 */
export function unauthorizedResponse(message: string = 'Unauthorized'): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: 'Unauthorized',
      message
    },
    { status: 401 }
  )
}

/**
 * Forbidden response
 */
export function forbiddenResponse(message: string = 'Forbidden'): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: 'Forbidden',
      message
    },
    { status: 403 }
  )
}

/**
 * Success response builder
 */
export function successResponse(
  data: unknown,
  message?: string,
  statusCode: number = 200
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
      message
    },
    { status: statusCode }
  )
}
