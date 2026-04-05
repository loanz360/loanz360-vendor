export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/geography/branches
 * Get branches, optionally filtered by state or city
 *
 * Query params:
 * - state_id: UUID (optional) - filter branches by state
 * - city_id: UUID (optional) - filter branches by city
 * - active_only: boolean (optional) - return only active branches
 *
 * Returns: Array of branches with id, branch_code, branch_name, address, city & state info
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams
    const stateId = searchParams.get('state_id')
    const cityId = searchParams.get('city_id')
    const activeOnly = searchParams.get('active_only') === 'true'

    // Build query with city and state relationships
    let query = supabase
      .from('geography_branches')
      .select(`
        id,
        branch_code,
        branch_name,
        address,
        is_active,
        created_at,
        city:geography_cities(id, city_code, city_name),
        state:geography_states(id, state_code, state_name)
      `)
      .order('branch_name', { ascending: true })

    // Filter by state_id if provided
    if (stateId) {
      query = query.eq('state_id', stateId)
    }

    // Filter by city_id if provided
    if (cityId) {
      query = query.eq('city_id', cityId)
    }

    // Filter active only if requested
    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data: branches, error } = await query

    if (error) {
      apiLogger.error('Error fetching branches', error)
      return NextResponse.json(
        { error: 'Failed to fetch branches' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      count: branches?.length || 0,
      branches: branches || []
    })
  } catch (error: unknown) {
    apiLogger.error('Unexpected error fetching branches', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
