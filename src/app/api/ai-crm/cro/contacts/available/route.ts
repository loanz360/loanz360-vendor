/**
 * Available Contacts API - Fetch unassigned contacts from SuperAdmin pool
 *
 * CROs can browse available contacts that haven't been assigned yet.
 * Returns max 100 contacts per page from master_contacts where assigned_to_cro IS NULL.
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import {
  verifyCROAuth,
  createErrorResponse,
} from '@/lib/api/ai-crm-middleware'
import { sanitizeSearchForPostgrest } from '@/lib/constants/sales-pipeline'


export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  const authResult = await verifyCROAuth(request)
  if (!authResult.success) {
    return authResult.response
  }

  const { supabase, requestId } = authResult.context

  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const search = searchParams.get('search')?.trim()
    const loan_type = searchParams.get('loan_type')?.trim()
    const location = searchParams.get('location')?.trim()
    const offset = (page - 1) * limit

    // Build query for unassigned master_contacts
    let query = supabase
      .from('master_contacts')
      .select(
        `
        id,
        name,
        phone,
        email,
        location,
        city,
        state,
        loan_type,
        loan_amount,
        business_name,
        business_type,
        created_at
      `,
        { count: 'exact' }
      )
      .is('assigned_to_cro', null)
      .eq('current_stage', 'contact')

    // Apply filters
    if (search) {
      const safeSearch = sanitizeSearchForPostgrest(search)
      if (safeSearch) {
        query = query.or(
          `name.ilike.%${safeSearch}%,phone.ilike.%${safeSearch}%,location.ilike.%${safeSearch}%,city.ilike.%${safeSearch}%`
        )
      }
    }

    if (loan_type) {
      query = query.eq('loan_type', loan_type)
    }

    if (location) {
      const safeLocation = sanitizeSearchForPostgrest(location)
      if (safeLocation) {
        query = query.or(`location.ilike.%${safeLocation}%,city.ilike.%${safeLocation}%,state.ilike.%${safeLocation}%`)
      }
    }

    // Sort by newest first
    query = query.order('created_at', { ascending: false })

    // Apply pagination (max 100 per page)
    query = query.range(offset, offset + limit - 1)

    const { data: contacts, error, count } = await query

    if (error) {
      logApiError(error as Error, request, { action: 'list_available_contacts', requestId })
      return createErrorResponse('Failed to fetch available contacts', 500, requestId)
    }

    // Get distinct loan types and locations for filter dropdowns
    const { data: filterOptions } = await supabase
      .from('master_contacts')
      .select('loan_type, location, city')
      .is('assigned_to_cro', null)
      .eq('current_stage', 'contact')
      .limit(500)

    const uniqueLoanTypes = [...new Set(filterOptions?.map(c => c.loan_type).filter(Boolean) || [])]
    const uniqueLocations = [...new Set(
      filterOptions?.flatMap(c => [c.location, c.city].filter(Boolean)) || []
    )]

    return NextResponse.json({
      success: true,
      data: contacts || [],
      filters: {
        loan_types: uniqueLoanTypes,
        locations: uniqueLocations.slice(0, 50),
      },
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
    logApiError(error as Error, request, { action: 'list_available_contacts', requestId })
    return createErrorResponse('Internal server error', 500, requestId)
  }
}
