import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSMAuth } from '@/lib/auth/dse-auth'


/**
 * GET /api/employees/dse/schedule/team
 * Retrieves schedules for all DSE team members under the current manager
 * Only accessible by DIRECT_SALES_MANAGER role
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

    // Verify the user is a DSE Manager
    const authResult = await verifyDSMAuth(supabase, user.id)
    if (!authResult.valid) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: 403 })
    }

    // Get department for team filtering
    let department = authResult.department
    if (!department) {
      const { data: empData } = await supabase
        .from('employees')
        .select('department')
        .eq('user_id', user.id)
        .maybeSingle()
      department = empData?.department
    }

    if (!department) {
      return NextResponse.json({
        success: true,
        data: { team_members: [], meetings: [], meetings_by_date: {}, summary: { total_meetings: 0, total_team_members: 0, meetings_by_status: {}, meetings_by_member: {} } }
      })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const teamMemberId = searchParams.get('teamMemberId')
    const status = searchParams.get('status')

    // Get team members (DSEs) under this manager
    const { data: teamMembers, error: teamError } = await supabase
      .from('employees')
      .select('id, user_id, full_name, email, sub_role')
      .eq('sub_role', 'DIRECT_SALES_EXECUTIVE')
      .eq('department', department)
      .eq('is_active', true)

    if (teamError) {
      apiLogger.error('Error fetching team members', teamError)
      return NextResponse.json({ success: false, error: 'Failed to fetch team members' }, { status: 500 })
    }

    if (!teamMembers || teamMembers.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          team_members: [],
          meetings: [],
          summary: {
            total_meetings: 0,
            total_team_members: 0,
            meetings_by_status: {}
          }
        }
      })
    }

    // Get team member user IDs
    let teamUserIds = teamMembers.map(tm => tm.user_id)

    // If specific team member requested, filter to that member
    if (teamMemberId) {
      const member = teamMembers.find(tm => tm.id === teamMemberId)
      if (member) {
        teamUserIds = [member.user_id]
      }
    }

    // Build meeting query
    let meetingQuery = supabase
      .from('dse_meetings')
      .select(`
        *,
        dse_customers(id, full_name, company_name),
        dse_leads(id, customer_name, company_name, lead_stage)
      `)
      .in('organizer_id', teamUserIds)
      .order('scheduled_date', { ascending: true })
      .order('start_time', { ascending: true })

    // Apply date filters
    if (dateFrom) {
      meetingQuery = meetingQuery.gte('scheduled_date', dateFrom)
    } else {
      // Default to today
      const today = new Date().toISOString().split('T')[0]
      meetingQuery = meetingQuery.gte('scheduled_date', today)
    }

    if (dateTo) {
      meetingQuery = meetingQuery.lte('scheduled_date', dateTo)
    } else {
      // Default to 7 days from now
      const weekLater = new Date()
      weekLater.setDate(weekLater.getDate() + 7)
      meetingQuery = meetingQuery.lte('scheduled_date', weekLater.toISOString().split('T')[0])
    }

    // Apply status filter
    if (status) {
      meetingQuery = meetingQuery.eq('status', status)
    } else {
      // Default to active statuses
      meetingQuery = meetingQuery.in('status', ['Scheduled', 'Confirmed', 'In Progress'])
    }

    const { data: meetings, error: meetingsError } = await meetingQuery

    if (meetingsError) {
      apiLogger.error('Error fetching meetings', meetingsError)
      return NextResponse.json({ success: false, error: 'Failed to fetch team meetings' }, { status: 500 })
    }

    // Map meetings to include team member name
    const meetingsWithTeamMember = (meetings || []).map(meeting => {
      const teamMember = teamMembers.find(tm => tm.user_id === meeting.organizer_id)
      return {
        ...meeting,
        team_member_name: teamMember?.full_name || 'Unknown',
        team_member_id: teamMember?.id,
        participant_name: meeting.dse_customers?.full_name || meeting.dse_leads?.customer_name || null,
        participant_company: meeting.dse_customers?.company_name || meeting.dse_leads?.company_name || null
      }
    })

    // Calculate summary
    const meetingsByStatus: Record<string, number> = {}
    const meetingsByMember: Record<string, number> = {}

    meetingsWithTeamMember.forEach(meeting => {
      meetingsByStatus[meeting.status] = (meetingsByStatus[meeting.status] || 0) + 1
      meetingsByMember[meeting.team_member_name] = (meetingsByMember[meeting.team_member_name] || 0) + 1
    })

    // Group meetings by date
    const meetingsByDate: Record<string, typeof meetingsWithTeamMember> = {}
    meetingsWithTeamMember.forEach(meeting => {
      const date = meeting.scheduled_date.split('T')[0]
      if (!meetingsByDate[date]) {
        meetingsByDate[date] = []
      }
      meetingsByDate[date].push(meeting)
    })

    return NextResponse.json({
      success: true,
      data: {
        team_members: teamMembers.map(tm => ({
          id: tm.id,
          name: tm.full_name,
          email: tm.email,
          meeting_count: meetingsByMember[tm.full_name] || 0
        })),
        meetings: meetingsWithTeamMember,
        meetings_by_date: meetingsByDate,
        summary: {
          total_meetings: meetingsWithTeamMember.length,
          total_team_members: teamMembers.length,
          meetings_by_status: meetingsByStatus,
          meetings_by_member: meetingsByMember
        }
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/employees/dse/schedule/team', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
