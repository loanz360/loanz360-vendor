import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors/api-errors'
import {
  searchFilterSchema,
  buildSearchQuery,
  applyPagination,
  calculatePagination,
  type SearchFilter,
} from '@/lib/search/admin-search'

/**
 * POST /api/admin-management/search
 * Advanced admin search with filtering, sorting, and pagination
 *
 * Features:
 * - Multi-field text search
 * - Role, department, status filters
 * - Date range filters
 * - 2FA status filter
 * - Advanced filters (phone, failed logins)
 * - Sorting
 * - Pagination
 * - Total count
 */

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse
const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }


    const supabase = createSupabaseAdmin()

    // Parse and validate request body
    const { data: body, error: _valErr } = await parseBody(request, z.object({}).passthrough())
    if (_valErr) return _valErr
    const validation = searchFilterSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid search filters',
          details: validation.error.issues,
        },
        { status: 400 }
      )
    }

    const filters: SearchFilter = validation.data

    // Build base query
    let query = supabase
      .from('admins')
      .select(
        `
        id,
        admin_unique_id,
        full_name,
        email,
        phone,
        role,
        department,
        designation,
        is_active,
        two_factor_enabled,
        failed_login_attempts,
        last_login,
        created_at,
        updated_at
      `,
        { count: 'exact' }
      )

    // Apply search filters
    query = buildSearchQuery(filters, query)

    // Get total count before pagination
    const { count: totalCount } = await supabase
      .from('admins')
      .select('*', { count: 'exact', head: true })
      .then((result) => {
        // Apply same filters for accurate count
        let countQuery = supabase.from('admins').select('*', { count: 'exact', head: true })
        countQuery = buildSearchQuery(filters, countQuery)
        return countQuery
      })

    // Apply pagination
    const page = filters.page || 1
    const limit = filters.limit || 20
    query = applyPagination(query, page, limit)

    // Execute query
    const { data: admins, error, count } = await query

    if (error) {
      throw error
    }

    // Calculate pagination metadata
    const pagination = calculatePagination(count || 0, page, limit)

    return NextResponse.json(
      {
        success: true,
        admins: admins || [],
        ...pagination,
      },
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error, 'admin search')
  }
}
