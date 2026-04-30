/**
 * CRO Contacts API
 *
 * Enterprise-grade API for contact management
 * Features:
 * - RBAC authentication
 * - Pagination
 * - Soft delete filtering
 * - Audit logging
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
import { contactsQuerySchema } from '@/lib/validations/ai-crm-schemas'
import { maskDataForRole } from '@/lib/utils/data-masking'


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
      contactsQuerySchema,
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
      status,
      search,
      from_date,
      to_date,
    } = queryResult.data

    // Calculate offset
    const offset = (page - 1) * limit

    // Build query with specific columns (only columns that exist on crm_contacts)
    let query = supabase
      .from('crm_contacts')
      .select(
        `
        id,
        master_contact_id,
        name,
        phone,
        email,
        location,
        status,
        loan_type,
        loan_amount,
        business_name,
        business_type,
        call_count,
        last_called_at,
        notes_timeline,
        created_at,
        updated_at
      `,
        { count: 'exact' }
      )
      .or(`cro_id.eq.${user.id},assigned_to_cro.eq.${user.id}`)
      .is('deleted_at', null)

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }

    if (search) {
      const safeSearch = sanitizeSearchForPostgrest(search)
      if (safeSearch) {
        query = query.or(
          `name.ilike.%${safeSearch}%,phone.ilike.%${safeSearch}%,location.ilike.%${safeSearch}%`
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
    const validSortColumns = ['created_at', 'updated_at', 'name', 'status', 'last_called_at']
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'created_at'
    query = query.order(sortColumn, { ascending: sort_order === 'asc' })

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    // Execute query
    const { data: contacts, error, count } = await query

    if (error) {
      logApiError(error as Error, request, { action: 'list_contacts', requestId })
      return createErrorResponse('Failed to fetch contacts', 500, requestId)
    }

    // Get summary stats
    const { data: stats } = await supabase
      .from('crm_contacts')
      .select('status')
      .or(`cro_id.eq.${user.id},assigned_to_cro.eq.${user.id}`)
      .is('deleted_at', null)

    const summary = {
      total: stats?.length || 0,
      by_status: {
        new: stats?.filter((c) => c.status === 'new').length || 0,
        called: stats?.filter((c) => c.status === 'called').length || 0,
        follow_up: stats?.filter((c) => c.status === 'follow_up').length || 0,
        not_interested: stats?.filter((c) => c.status === 'not_interested').length || 0,
        positive: stats?.filter((c) => c.status === 'positive').length || 0,
      },
    }

    // Mask PII based on user role
    const maskedContacts = maskDataForRole(
      (contacts || []) as Record<string, unknown>[],
      user.role,
      user.sub_role
    )

    return NextResponse.json({
      success: true,
      data: maskedContacts,
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
    logApiError(error as Error, request, { action: 'list_contacts', requestId })
    return createErrorResponse('Internal server error', 500, requestId)
  }
}
