import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/schedule/history
 * Retrieves historical (completed/cancelled) schedules
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit
    const dateFrom = searchParams.get('date_from') || undefined
    const dateTo = searchParams.get('date_to') || undefined

    // Call the database function to get schedule history
    const { data: schedules, error: queryError } = await supabase.rpc(
      'get_schedule_history',
      {
        p_user_id: user.id,
        p_date_from: dateFrom || null,
        p_date_to: dateTo || null,
        p_limit: limit,
        p_offset: offset
      }
    )

    if (queryError) {
      apiLogger.error('Error fetching schedule history', queryError)
      return NextResponse.json(
        { error: 'Failed to fetch schedule history' },
        { status: 500 }
      )
    }

    // Get total count for pagination
    const { count } = await supabase
      .from('meetings')
      .select('*', { count: 'exact', head: true })
      .eq('sales_executive_id', user.id)
      .eq('is_deleted', false)
      .in('status', ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED'])

    // Calculate summary statistics
    const summary = {
      total_completed: schedules.filter((s: any) => s.status === 'COMPLETED').length,
      total_cancelled: schedules.filter((s: any) => s.status === 'CANCELLED').length,
      total_no_show: schedules.filter((s: any) => s.status === 'NO_SHOW').length,
      completion_rate:
        schedules.length > 0
          ? Math.round(
              (schedules.filter((s: any) => s.status === 'COMPLETED').length / schedules.length) *
                100
            )
          : 0
    }

    return NextResponse.json({
      schedules,
      total: count || 0,
      page,
      limit,
      total_pages: Math.ceil((count || 0) / limit),
      summary
    })
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/schedule/history', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
