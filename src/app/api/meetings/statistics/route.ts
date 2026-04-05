import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/meetings/statistics
 * Retrieves meeting statistics for a date range
 *
 * Query Parameters:
 * - start_date: ISO date string (required)
 * - end_date: ISO date string (required)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: start_date, end_date' },
        { status: 400 }
      )
    }

    // Get statistics using the database function
    const { data: statistics, error: statsError } = await supabase.rpc(
      'get_meeting_statistics',
      {
        p_user_id: user.id,
        p_start_date: startDate,
        p_end_date: endDate
      }
    )

    if (statsError) {
      apiLogger.error('Error fetching statistics', statsError)
      return NextResponse.json({ success: false, error: 'Failed to fetch statistics' }, { status: 500 })
    }

    const stats = statistics?.[0] || {
      total_scheduled: 0,
      total_completed: 0,
      total_cancelled: 0,
      attendance_rate: 0,
      conversion_rate: 0,
      total_meeting_time_hours: 0
    }

    // Get metrics breakdown by type and outcome
    const { data: meetings } = await supabase
      .from('meetings')
      .select('meeting_type, outcome, status, duration_minutes')
      .eq('sales_executive_id', user.id)
      .eq('is_deleted', false)
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)

    // Calculate breakdowns
    const typeBreakdown: Record<string, number> = {}
    const outcomeBreakdown: Record<string, number> = {}
    const statusBreakdown: Record<string, number> = {}

    meetings?.forEach((meeting) => {
      // Type breakdown
      typeBreakdown[meeting.meeting_type] = (typeBreakdown[meeting.meeting_type] || 0) + 1

      // Outcome breakdown (if completed)
      if (meeting.outcome) {
        outcomeBreakdown[meeting.outcome] = (outcomeBreakdown[meeting.outcome] || 0) + 1
      }

      // Status breakdown
      statusBreakdown[meeting.status] = (statusBreakdown[meeting.status] || 0) + 1
    })

    return NextResponse.json({
      summary: stats,
      breakdowns: {
        by_type: typeBreakdown,
        by_outcome: outcomeBreakdown,
        by_status: statusBreakdown
      },
      period: {
        start_date: startDate,
        end_date: endDate
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/meetings/statistics', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
