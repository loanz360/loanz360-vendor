
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/geography/states
 * Get all Indian states
 *
 * Query params:
 * - active_only: boolean (optional) - return only active states
 *
 * Returns: Array of states with id, state_code, state_name
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams
    const activeOnly = searchParams.get('active_only') === 'true'

    // Build query
    let query = supabase
      .from('geography_states')
      .select('id, state_code, state_name, is_active, created_at')
      .order('state_name', { ascending: true })

    // Filter active only if requested
    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data: states, error } = await query

    if (error) {
      apiLogger.error('Error fetching states', error)
      return NextResponse.json(
        { error: 'Failed to fetch states' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      count: states?.length || 0,
      states: states || []
    })
  } catch (error: unknown) {
    apiLogger.error('Unexpected error fetching states', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
