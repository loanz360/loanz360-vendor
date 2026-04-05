/**
 * CRO Manager Middleware
 * Authentication and authorization for CRO Team Leader and CRO State Manager roles
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { createErrorResponse, createSuccessResponse, createPaginatedResponse } from './ai-crm-middleware'
import type { ApiContext } from './ai-crm-middleware'

// Re-export response helpers for convenience
export { createErrorResponse, createSuccessResponse, createPaginatedResponse }

export type CROManagerRole = 'CRO_TEAM_LEADER' | 'CRO_STATE_MANAGER'

export interface CROManagerContext extends ApiContext {
  teamCROIds: string[]
  managerSubRole: CROManagerRole
}

/**
 * Verify CRO Team Leader authentication and get team CRO IDs
 */
export async function verifyCROTeamLeaderAuth(request: NextRequest): Promise<{
  success: true
  context: CROManagerContext
} | {
  success: false
  response: NextResponse
}> {
  return verifyCROManagerAuth(request, 'CRO_TEAM_LEADER')
}

/**
 * Verify CRO State Manager authentication and get team CRO IDs
 */
export async function verifyCROStateManagerAuth(request: NextRequest): Promise<{
  success: true
  context: CROManagerContext
} | {
  success: false
  response: NextResponse
}> {
  return verifyCROManagerAuth(request, 'CRO_STATE_MANAGER')
}

/**
 * Generic CRO manager auth verification
 * Accepts either CRO_TEAM_LEADER or CRO_STATE_MANAGER
 */
async function verifyCROManagerAuth(
  request: NextRequest,
  requiredRole: CROManagerRole
): Promise<{
  success: true
  context: CROManagerContext
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
      logger.warn(`[CRO Manager Auth] Authentication failed`, { requestId, error: authError?.message })
      return {
        success: false,
        response: createErrorResponse('Unauthorized', 401, requestId, { code: 'AUTH_REQUIRED' }),
      }
    }

    const role = user.user_metadata?.role || user.app_metadata?.role
    const sub_role = user.user_metadata?.sub_role || user.app_metadata?.sub_role

    // Allow the specific manager role OR admin roles
    if (sub_role !== requiredRole && role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      logger.warn(`[CRO Manager Auth] Insufficient permissions`, {
        requestId,
        userId: user.id,
        role,
        sub_role,
        requiredRole,
      })
      return {
        success: false,
        response: createErrorResponse(
          `Forbidden: ${requiredRole} role required`,
          403,
          requestId,
          { code: 'INSUFFICIENT_PERMISSIONS' }
        ),
      }
    }

    // Get team CRO IDs using the database function
    const { data: teamCROIds, error: rpcError } = await supabase.rpc('get_team_cro_ids', {
      manager_user_id: user.id,
      manager_subrole: sub_role || requiredRole,
    })

    if (rpcError) {
      logger.error(`[CRO Manager Auth] Failed to get team CRO IDs`, {
        requestId,
        userId: user.id,
        error: rpcError,
      })
      // Don't fail - just return empty array
    }

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
        teamCROIds: teamCROIds || [],
        managerSubRole: (sub_role as CROManagerRole) || requiredRole,
      },
    }
  } catch (error) {
    logger.error(`[CRO Manager Auth] Unexpected error`, {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown',
    })
    return {
      success: false,
      response: createErrorResponse('Authentication failed', 500, requestId, { code: 'AUTH_ERROR' }),
    }
  }
}

/**
 * Get team CRO IDs for a manager (utility function for use outside middleware)
 */
export async function getTeamCROIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  subrole: CROManagerRole
): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_team_cro_ids', {
    manager_user_id: userId,
    manager_subrole: subrole,
  })

  if (error) {
    logger.error('[CRO Manager] Failed to get team CRO IDs', { userId, subrole, error })
    return []
  }

  return data || []
}

/**
 * Get Team Leader IDs for a State Manager
 */
export async function getTeamLeaderIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  smUserId: string
): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_team_leader_ids', {
    sm_user_id: smUserId,
  })

  if (error) {
    logger.error('[CRO Manager] Failed to get team leader IDs', { smUserId, error })
    return []
  }

  return data || []
}
