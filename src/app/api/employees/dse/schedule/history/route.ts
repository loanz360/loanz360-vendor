import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSEAuth } from '@/lib/auth/dse-auth'


/**
 * GET /api/employees/dse/schedule/history
 * Retrieves historical (completed/cancelled/no-show) meetings
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const authResult = await verifyDSEAuth(supabase, user.id, { allowDSM: true })
    if (!authResult.valid) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = (page - 1) * limit
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const status = searchParams.get('status')
    const outcome = searchParams.get('outcome')
    const customerId = searchParams.get('customerId')
    const leadId = searchParams.get('leadId')
    const meetingType = searchParams.get('meetingType')

    // Build query for completed/cancelled/no-show meetings
    let query = supabase
      .from('dse_meetings')
      .select('*, dse_customers(id, full_name, company_name, primary_mobile), dse_leads(id, customer_name, lead_stage)', { count: 'exact' })
      .eq('organizer_id', user.id)
      .in('status', ['Completed', 'Cancelled', 'No Show', 'Rescheduled'])
      .order('scheduled_date', { ascending: false })
      .order('start_time', { ascending: false })

    // Apply filters
    if (dateFrom) {
      query = query.gte('scheduled_date', dateFrom)
    }
    if (dateTo) {
      query = query.lte('scheduled_date', dateTo)
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (outcome) {
      query = query.eq('outcome', outcome)
    }
    if (customerId) {
      query = query.eq('customer_id', customerId)
    }
    if (leadId) {
      query = query.eq('lead_id', leadId)
    }
    if (meetingType) {
      query = query.eq('meeting_type', meetingType)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: meetings, error: queryError, count } = await query

    if (queryError) {
      throw queryError
    }

    // Summary stats respect the same filters as the list query (BUG-23 fix)
    let summaryQuery = supabase
      .from('dse_meetings')
      .select('status, outcome')
      .eq('organizer_id', user.id)
      .in('status', ['Completed', 'Cancelled', 'No Show', 'Rescheduled'])

    if (dateFrom) {
      summaryQuery = summaryQuery.gte('scheduled_date', dateFrom)
    }
    if (dateTo) {
      summaryQuery = summaryQuery.lte('scheduled_date', dateTo)
    }

    const { data: allHistoryMeetings } = await summaryQuery

    const summary = {
      total_completed: allHistoryMeetings?.filter(m => m.status === 'Completed').length || 0,
      total_cancelled: allHistoryMeetings?.filter(m => m.status === 'Cancelled').length || 0,
      total_no_show: allHistoryMeetings?.filter(m => m.status === 'No Show').length || 0,
      total_rescheduled: allHistoryMeetings?.filter(m => m.status === 'Rescheduled').length || 0,
      completion_rate: 0,
      outcome_breakdown: {} as Record<string, number>
    }

    // Calculate completion rate
    const totalPastMeetings = allHistoryMeetings?.length || 0
    if (totalPastMeetings > 0) {
      summary.completion_rate = Math.round((summary.total_completed / totalPastMeetings) * 100)
    }

    // Calculate outcome breakdown
    allHistoryMeetings?.forEach(m => {
      if (m.outcome) {
        summary.outcome_breakdown[m.outcome] = (summary.outcome_breakdown[m.outcome] || 0) + 1
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        meetings: meetings || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit)
        },
        summary
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching DSE schedule history', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
