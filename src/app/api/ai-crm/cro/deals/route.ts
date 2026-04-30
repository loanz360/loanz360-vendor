/**
 * CRO Deals API
 *
 * Enterprise-grade API for viewing deals created from CRO leads
 * Features:
 * - RBAC authentication
 * - Pagination
 * - Soft delete filtering
 * - Read-only access for CRO
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import {
  verifyCROAuth,
  validateQueryParams,
  createErrorResponse,
} from '@/lib/api/ai-crm-middleware'
import { sanitizeSearchForPostgrest } from '@/lib/constants/sales-pipeline'
import { dealsQuerySchema } from '@/lib/validations/ai-crm-schemas'


export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  // Authenticate and verify CRO role
  const authResult = await verifyCROAuth(request)
  if (!authResult.success) {
    return authResult.response
  }

  const { user, supabase, requestId } = authResult.context

  try {
    // Validate query parameters
    const queryResult = validateQueryParams(
      request,
      dealsQuerySchema,
      requestId
    )
    if (!queryResult.success) {
      return queryResult.response
    }

    const {
      page = 1,
      limit = 20,
      sort_by = 'created_at',
      sort_order = 'desc',
      stage,
      status,
      search,
      from_date,
      to_date,
    } = queryResult.data

    // Calculate offset
    const offset = (page - 1) * limit

    // Build query with specific columns (CRO has read-only access)
    // Exclude `documents` from list view to reduce payload
    let query = supabase
      .from('crm_deals')
      .select(
        `
        id,
        lead_id,
        customer_name,
        phone,
        email,
        location,
        loan_type,
        loan_amount,
        loan_purpose,
        business_name,
        stage,
        status,
        bde_id,
        sanctioned_amount,
        disbursed_amount,
        sanctioned_at,
        disbursed_at,
        drop_reason,
        assigned_at,
        assigned_to_bde_at,
        last_updated_by_bde_at,
        notes,
        created_at,
        updated_at
      `,
        { count: 'exact' }
      )
      .eq('cro_id', user.id)
      .is('deleted_at', null)

    // Apply filters
    if (stage) {
      query = query.eq('stage', stage)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (search) {
      const sanitized = sanitizeSearchForPostgrest(search)
      if (sanitized) {
        query = query.or(
          `customer_name.ilike.%${sanitized}%,phone.ilike.%${sanitized}%,location.ilike.%${sanitized}%`
        )
      }
    }

    if (from_date) {
      query = query.gte('created_at', from_date)
    }

    if (to_date) {
      query = query.lte('created_at', to_date)
    }

    // Apply sorting
    const validSortColumns = ['created_at', 'updated_at', 'customer_name', 'stage', 'loan_amount']
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'created_at'
    query = query.order(sortColumn, { ascending: sort_order === 'asc' })

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    // Execute query
    const { data: deals, error, count } = await query

    if (error) {
      logApiError(error as Error, request, { action: 'list_deals', requestId })
      return createErrorResponse('Failed to fetch deals', 500, requestId)
    }

    // Get summary stats using efficient count queries instead of fetching all rows
    const [totalResult, inProgressResult, sanctionedResult, disbursedResult, droppedResult] = await Promise.all([
      supabase.from('crm_deals').select('id', { count: 'exact', head: true }).eq('cro_id', user.id).is('deleted_at', null),
      supabase.from('crm_deals').select('id', { count: 'exact', head: true }).eq('cro_id', user.id).is('deleted_at', null).eq('status', 'in_progress'),
      supabase.from('crm_deals').select('id', { count: 'exact', head: true }).eq('cro_id', user.id).is('deleted_at', null).eq('status', 'sanctioned'),
      supabase.from('crm_deals').select('id', { count: 'exact', head: true }).eq('cro_id', user.id).is('deleted_at', null).eq('status', 'disbursed'),
      supabase.from('crm_deals').select('id', { count: 'exact', head: true }).eq('cro_id', user.id).is('deleted_at', null).eq('status', 'dropped'),
    ])

    const summary = {
      total: totalResult.count || 0,
      by_status: {
        in_progress: inProgressResult.count || 0,
        sanctioned: sanctionedResult.count || 0,
        disbursed: disbursedResult.count || 0,
        dropped: droppedResult.count || 0,
      },
    }

    return NextResponse.json({
      success: true,
      data: deals || [],
      summary,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      },
    })
  } catch (error) {
    logApiError(error as Error, request, { action: 'list_deals', requestId })
    return createErrorResponse('Internal server error', 500, requestId)
  }
}
