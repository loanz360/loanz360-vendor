
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/geography/cities
 * Get cities, optionally filtered by state
 *
 * Query params:
 * - state_id: UUID (optional) - filter cities by state
 * - state_code: string (optional) - filter by state code (e.g., 'MH', 'DL')
 * - active_only: boolean (optional) - return only active cities
 *
 * Returns: Array of cities with id, city_code, city_name, state info
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams
    const stateId = searchParams.get('state_id')
    const stateCode = searchParams.get('state_code')
    const activeOnly = searchParams.get('active_only') === 'true'

    // Build query with state relationship
    let query = supabase
      .from('geography_cities')
      .select(`
        id,
        city_code,
        city_name,
        is_active,
        created_at,
        state:geography_states(id, state_code, state_name)
      `)
      .order('city_name', { ascending: true })

    // Filter by state_id if provided
    if (stateId) {
      query = query.eq('state_id', stateId)
    }

    // Filter by state_code if provided
    if (stateCode) {
      query = query.eq('geography_states.state_code', stateCode)
    }

    // Filter active only if requested
    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data: cities, error } = await query

    if (error) {
      apiLogger.error('Error fetching cities', error)
      return NextResponse.json(
        { error: 'Failed to fetch cities' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      count: cities?.length || 0,
      cities: cities || []
    })
  } catch (error: unknown) {
    apiLogger.error('Unexpected error fetching cities', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
