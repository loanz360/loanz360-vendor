/**
 * Global Search API
 *
 * Enterprise-grade full-text search across CRM entities
 * Features:
 * - PostgreSQL full-text search with ranking
 * - Weighted results by relevance
 * - Cross-entity search (leads, contacts, deals)
 * - Performance optimized with GIN indexes
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import {
  verifyCROAuth,
  createErrorResponse,
} from '@/lib/api/ai-crm-middleware'
import { maskDataForRole } from '@/lib/utils/data-masking'


// Search query schema
const searchQuerySchema = z.object({
  q: z.string().min(2).max(100),
  type: z.enum(['all', 'leads', 'contacts', 'deals']).optional().default('all'),
  limit: z.coerce.number().min(1).max(50).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
})

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
    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams)
    const parseResult = searchQuerySchema.safeParse(searchParams)

    if (!parseResult.success) {
      return createErrorResponse(
        'Invalid search parameters',
        400,
        requestId,
        parseResult.error.flatten().fieldErrors
      )
    }

    const { q: query, type, limit, offset } = parseResult.data

    // Use PostgreSQL full-text search based on type
    if (type === 'all') {
      // Global search across all entities
      const { data: results, error } = await supabase.rpc('search_crm_global', {
        p_cro_id: user.id,
        p_query: query,
        p_limit: limit,
      })

      if (error) {
        logApiError(error as Error, request, { action: 'global_search', requestId })
        return createErrorResponse('Search failed', 500, requestId)
      }

      // Mask PII based on user role
      const maskedResults = maskDataForRole(
        (results || []) as Record<string, unknown>[],
        user.role,
        user.sub_role
      )

      return NextResponse.json({
        success: true,
        data: maskedResults,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
          query,
          type,
        },
      })
    }

    // Entity-specific search
    let results: unknown[] = []
    let total = 0

    if (type === 'leads') {
      const { data, error } = await supabase.rpc('search_leads', {
        p_cro_id: user.id,
        p_query: query,
        p_limit: limit,
        p_offset: offset,
      })

      if (error) {
        logApiError(error as Error, request, { action: 'search_leads', requestId })
        return createErrorResponse('Search failed', 500, requestId)
      }

      results = data || []

      // Get total count for pagination
      const { count } = await supabase
        .from('crm_leads')
        .select('id', { count: 'exact', head: true })
        .eq('cro_id', user.id)
        .is('deleted_at', null)
        .textSearch('search_vector', query)

      total = count || 0
    } else if (type === 'contacts') {
      const { data, error } = await supabase.rpc('search_contacts', {
        p_cro_id: user.id,
        p_query: query,
        p_limit: limit,
        p_offset: offset,
      })

      if (error) {
        logApiError(error as Error, request, { action: 'search_contacts', requestId })
        return createErrorResponse('Search failed', 500, requestId)
      }

      results = data || []

      const { count } = await supabase
        .from('crm_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('cro_id', user.id)
        .is('deleted_at', null)
        .textSearch('search_vector', query)

      total = count || 0
    } else if (type === 'deals') {
      // Direct query for deals search
      const { data, error, count } = await supabase
        .from('crm_deals')
        .select(
          `
          id,
          customer_name,
          customer_phone,
          loan_type,
          loan_amount,
          status,
          lender_name,
          created_at
        `,
          { count: 'exact' }
        )
        .eq('cro_id', user.id)
        .is('deleted_at', null)
        .textSearch('search_vector', query)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        logApiError(error as Error, request, { action: 'search_deals', requestId })
        return createErrorResponse('Search failed', 500, requestId)
      }

      results = data || []
      total = count || 0
    }

    // Mask PII based on user role
    const maskedEntityResults = maskDataForRole(
      results as Record<string, unknown>[],
      user.role,
      user.sub_role
    )

    return NextResponse.json({
      success: true,
      data: maskedEntityResults,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        query,
        type,
        pagination: {
          offset,
          limit,
          total,
          hasMore: offset + results.length < total,
        },
      },
    })
  } catch (error) {
    logApiError(error as Error, request, { action: 'search', requestId })
    return createErrorResponse('Internal server error', 500, requestId)
  }
}
