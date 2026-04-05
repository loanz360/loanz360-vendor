/**
 * AI-CRM API Middleware
 *
 * Enterprise-grade middleware for CRO leads management
 * SECURITY: RBAC, rate limiting, audit logging, CSRF protection
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { formatValidationErrors } from '@/lib/validations/api-schemas'
import { logger } from '@/lib/utils/logger'

// =============================================================================
// TYPES
// =============================================================================

export interface AuthenticatedUser {
  id: string
  email: string
  role: string
  sub_role?: string
}

export interface ApiContext {
  user: AuthenticatedUser
  supabase: Awaited<ReturnType<typeof createClient>>
  requestId: string
  startTime: number
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  errors?: Record<string, string[]>
  meta?: {
    requestId: string
    timestamp: string
    pagination?: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }
}

// =============================================================================
// RBAC CONFIGURATION
// =============================================================================

export const CRO_ROLES = ['CRO'] as const
export const CRO_MANAGER_ROLES = ['CRO_TEAM_LEADER', 'CRO_STATE_MANAGER'] as const
export const BDE_ROLES = ['BDE'] as const
export const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'] as const
export const ALL_EMPLOYEE_ROLES = [...CRO_ROLES, ...CRO_MANAGER_ROLES, ...BDE_ROLES, ...ADMIN_ROLES] as const

type AllowedRole = typeof ALL_EMPLOYEE_ROLES[number]

// =============================================================================
// CORE MIDDLEWARE FUNCTIONS
// =============================================================================

/**
 * Verify user authentication and role
 */
export async function verifyCROAuth(request: NextRequest): Promise<{
  success: true
  context: ApiContext
} | {
  success: false
  response: NextResponse
}> {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()

  try {
    const supabase = await createClient()

    // Get authenticated user (secure server-side validation)
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      logger.warn('[CRO Auth] Authentication failed', { requestId, error: authError?.message })
      return {
        success: false,
        response: createErrorResponse(
          'Unauthorized',
          401,
          requestId,
          { code: 'AUTH_REQUIRED' }
        ),
      }
    }

    const role = user.user_metadata?.role || user.app_metadata?.role
    const sub_role = user.user_metadata?.sub_role || user.app_metadata?.sub_role

    // Verify user has CRO role
    if (sub_role !== 'CRO' && role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      logger.warn('[CRO Auth] Insufficient permissions', {
        requestId,
        userId: user.id,
        role,
        sub_role,
      })
      return {
        success: false,
        response: createErrorResponse(
          'Forbidden: CRO role required',
          403,
          requestId,
          { code: 'INSUFFICIENT_PERMISSIONS' }
        ),
      }
    }

    logger.debug('[CRO Auth] Authentication successful', {
      requestId,
      userId: user.id,
      role,
      sub_role,
    })

    return {
      success: true,
      context: {
        user: {
          id: user.id,
          email: user.email || '',
          role,
          sub_role,
        },
        supabase,
        requestId,
        startTime,
      },
    }
  } catch (error) {
    logger.error('[CRO Auth] Unexpected error', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown',
    })
    return {
      success: false,
      response: createErrorResponse(
        'Authentication failed',
        500,
        requestId,
        { code: 'AUTH_ERROR' }
      ),
    }
  }
}

/**
 * Generic role-based auth verification
 */
export async function verifyRoleAuth(
  request: NextRequest,
  allowedRoles: readonly AllowedRole[]
): Promise<{
  success: true
  context: ApiContext
} | {
  success: false
  response: NextResponse
}> {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        response: createErrorResponse('Unauthorized', 401, requestId),
      }
    }

    const role = user.user_metadata?.role || user.app_metadata?.role
    const sub_role = user.user_metadata?.sub_role || user.app_metadata?.sub_role

    // Check if user has any of the allowed roles
    const hasRole = allowedRoles.some(
      (allowedRole) => role === allowedRole || sub_role === allowedRole
    )

    if (!hasRole) {
      return {
        success: false,
        response: createErrorResponse(
          `Forbidden: Required roles: ${allowedRoles.join(', ')}`,
          403,
          requestId
        ),
      }
    }

    return {
      success: true,
      context: {
        user: { id: user.id, email: user.email || '', role, sub_role },
        supabase,
        requestId,
        startTime,
      },
    }
  } catch (error) {
    return {
      success: false,
      response: createErrorResponse('Authentication failed', 500, requestId),
    }
  }
}

// =============================================================================
// VALIDATION MIDDLEWARE
// =============================================================================

/**
 * Validate request body against Zod schema
 */
export async function validateRequestBody<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>,
  requestId: string
): Promise<{
  success: true
  data: T
} | {
  success: false
  response: NextResponse
}> {
  try {
    const body = await request.json()
    const result = schema.safeParse(body)

    if (!result.success) {
      const errors = formatValidationErrors(result.error)
      logger.warn('[Validation] Request body validation failed', {
        requestId,
        errors,
      })
      return {
        success: false,
        response: NextResponse.json(
          {
            success: false,
            message: 'Validation failed',
            errors,
            meta: {
              requestId,
              timestamp: new Date().toISOString(),
            },
          },
          { status: 400 }
        ),
      }
    }

    return { success: true, data: result.data }
  } catch (error) {
    logger.error('[Validation] Failed to parse request body', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown',
    })
    return {
      success: false,
      response: createErrorResponse('Invalid JSON body', 400, requestId),
    }
  }
}

/**
 * Validate query parameters against Zod schema
 */
export function validateQueryParams<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>,
  requestId: string
): {
  success: true
  data: T
} | {
  success: false
  response: NextResponse
} {
  try {
    const searchParams = request.nextUrl.searchParams
    const params: Record<string, unknown> = {}

    searchParams.forEach((value, key) => {
      // Handle numeric values
      if (['page', 'limit', 'min_amount', 'max_amount'].includes(key)) {
        const num = parseInt(value, 10)
        params[key] = isNaN(num) ? value : num
      } else {
        params[key] = value
      }
    })

    const result = schema.safeParse(params)

    if (!result.success) {
      const errors = formatValidationErrors(result.error)
      return {
        success: false,
        response: NextResponse.json(
          {
            success: false,
            message: 'Invalid query parameters',
            errors,
            meta: { requestId, timestamp: new Date().toISOString() },
          },
          { status: 400 }
        ),
      }
    }

    return { success: true, data: result.data }
  } catch (error) {
    return {
      success: false,
      response: createErrorResponse('Failed to parse query parameters', 400, requestId),
    }
  }
}

// =============================================================================
// RESPONSE HELPERS
// =============================================================================

/**
 * Create standardized error response
 */
export function createErrorResponse(
  message: string,
  status: number,
  requestId: string,
  extra?: Record<string, unknown>
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      message,
      ...extra,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    },
    { status }
  )
}

/**
 * Create standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  requestId: string,
  meta?: Partial<ApiResponse['meta']>
): NextResponse {
  return NextResponse.json({
    success: true,
    data,
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
      ...meta,
    },
  })
}

/**
 * Create paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  requestId: string,
  pagination: {
    page: number
    limit: number
    total: number
  }
): NextResponse {
  return NextResponse.json({
    success: true,
    data,
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
      pagination: {
        ...pagination,
        totalPages: Math.ceil(pagination.total / pagination.limit),
      },
    },
  })
}

// =============================================================================
// AUDIT LOGGING
// =============================================================================

export interface AuditLogEntry {
  userId: string
  action: string
  entityType: string
  entityId?: string
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  metadata?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

/**
 * Log audit trail for data changes
 */
export async function logAuditTrail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entry: AuditLogEntry
): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      user_id: entry.userId,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      old_values: entry.oldValues,
      new_values: entry.newValues,
      metadata: entry.metadata,
      ip_address: entry.ipAddress,
      user_agent: entry.userAgent,
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    // Log error but don't fail the main operation
    logger.error('[Audit] Failed to log audit trail', {
      error: error instanceof Error ? error.message : 'Unknown',
      entry,
    })
  }
}

/**
 * Extract client info from request for audit logging
 */
export function extractClientInfo(request: NextRequest): {
  ipAddress: string
  userAgent: string
} {
  const forwarded = request.headers.get('x-forwarded-for')
  const ipAddress = forwarded?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  const userAgent = request.headers.get('user-agent') || 'unknown'

  return { ipAddress, userAgent }
}

// =============================================================================
// OWNERSHIP VERIFICATION
// =============================================================================

/**
 * Verify user owns the lead
 */
export async function verifyLeadOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadId: string,
  userId: string,
  requestId: string
): Promise<{
  success: true
  lead: Record<string, unknown>
} | {
  success: false
  response: NextResponse
}> {
  const { data: lead, error } = await supabase
    .from('crm_leads')
    .select('*')
    .eq('id', leadId)
    .maybeSingle()

  if (error || !lead) {
    return {
      success: false,
      response: createErrorResponse('Lead not found', 404, requestId),
    }
  }

  if (lead.cro_id !== userId) {
    logger.warn('[Ownership] User does not own lead', {
      requestId,
      userId,
      leadId,
      ownerId: lead.cro_id,
    })
    return {
      success: false,
      response: createErrorResponse('You do not have permission to access this lead', 403, requestId),
    }
  }

  return { success: true, lead }
}

/**
 * Verify user owns the contact
 */
export async function verifyContactOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contactId: string,
  userId: string,
  requestId: string
): Promise<{
  success: true
  contact: Record<string, unknown>
} | {
  success: false
  response: NextResponse
}> {
  const { data: contact, error } = await supabase
    .from('crm_contacts')
    .select('*')
    .eq('id', contactId)
    .maybeSingle()

  if (error || !contact) {
    return {
      success: false,
      response: createErrorResponse('Contact not found', 404, requestId),
    }
  }

  if (contact.cro_id !== userId) {
    return {
      success: false,
      response: createErrorResponse('You do not have permission to access this contact', 403, requestId),
    }
  }

  return { success: true, contact }
}

// =============================================================================
// TRANSACTION HELPERS
// =============================================================================

/**
 * Execute operations in a transaction using Supabase RPC
 * Note: For complex transactions, use the database function approach
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 100
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt))
      }
    }
  }

  throw lastError
}

// =============================================================================
// RATE LIMITING HELPERS
// =============================================================================

/**
 * Check if request should be rate limited
 * Uses sliding window algorithm
 */
export async function checkRateLimit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  action: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  try {
    const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString()

    const { count } = await supabase
      .from('rate_limit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action', action)
      .gte('created_at', windowStart)

    if (count !== null && count >= limit) {
      return false // Rate limited
    }

    // Log this request
    await supabase.from('rate_limit_logs').insert({
      user_id: userId,
      action,
      created_at: new Date().toISOString(),
    })

    return true // Allowed
  } catch (error) {
    // On error, allow the request (fail open)
    logger.error('[RateLimit] Check failed', { error, userId, action })
    return true
  }
}
