import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSMAuth } from '@/lib/auth/dse-auth'


/**
 * GET /api/employees/dse/schedule/manager-reports
 * Manager-level reports: leaderboard, audit trail, team performance
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

    // Only managers can access
    const authResult = await verifyDSMAuth(supabase, user.id)
    if (!authResult.valid) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const reportType = searchParams.get('type') || 'leaderboard'
    const period = parseInt(searchParams.get('period') || '30')

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - period)
    const startDateStr = startDate.toISOString().split('T')[0]

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
        data: { report_type: reportType, data: [] },
      })
    }

    // Get team members
    const { data: teamMembers } = await supabase
      .from('employees')
      .select('id, user_id, full_name, email')
      .eq('sub_role', 'DIRECT_SALES_EXECUTIVE')
      .eq('department', department)
      .eq('is_active', true)

    if (!teamMembers || teamMembers.length === 0) {
      return NextResponse.json({
        success: true,
        data: { report_type: reportType, data: [] },
      })
    }

    const teamUserIds = teamMembers.map(tm => tm.user_id)

    if (reportType === 'leaderboard') {
      // MGR-2: Performance Leaderboard
      const { data: allMeetings } = await supabase
        .from('dse_meetings')
        .select('organizer_id, status, outcome, duration_minutes, scheduled_date, start_time')
        .in('organizer_id', teamUserIds)
        .gte('scheduled_date', startDateStr)

      const leaderboard = teamMembers.map(member => {
        const memberMeetings = (allMeetings || []).filter(m => m.organizer_id === member.user_id)
        const completed = memberMeetings.filter(m => m.status === 'Completed').length
        const total = memberMeetings.length
        const cancelled = memberMeetings.filter(m => m.status === 'Cancelled').length
        const noShow = memberMeetings.filter(m => m.status === 'No Show').length
        const positive = memberMeetings.filter(m =>
          m.outcome?.startsWith('Successful')
        ).length
        const dealsClosed = memberMeetings.filter(m =>
          m.outcome === 'Successful - Deal Closed'
        ).length

        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0
        const conversionRate = completed > 0 ? Math.round((positive / completed) * 100) : 0
        const onTimeRate = total > 0 ? Math.round(((total - cancelled - noShow) / total) * 100) : 100

        // Composite score: weighted average
        const score = Math.round(
          (completionRate * 0.25) +
          (conversionRate * 0.35) +
          (onTimeRate * 0.15) +
          (Math.min(completed, 20) * 1.25) // Activity bonus
        )

        return {
          id: member.id,
          name: member.full_name,
          email: member.email,
          metrics: {
            total_meetings: total,
            completed,
            cancelled,
            no_show: noShow,
            deals_closed: dealsClosed,
            completion_rate: completionRate,
            conversion_rate: conversionRate,
            on_time_rate: onTimeRate,
            positive_outcomes: positive,
          },
          score,
          rank: 0, // Will be set after sorting
        }
      })
        .sort((a, b) => b.score - a.score)
        .map((entry, index) => ({ ...entry, rank: index + 1 }))

      return NextResponse.json({
        success: true,
        data: {
          report_type: 'leaderboard',
          period_days: period,
          team_size: teamMembers.length,
          leaderboard,
        },
      })
    }

    if (reportType === 'audit') {
      // MGR-3: Schedule Audit Trail
      const { data: auditLogs } = await supabase
        .from('dse_audit_log')
        .select('*')
        .in('user_id', teamUserIds)
        .in('entity_type', ['Meeting', 'Reminder'])
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(100)

      // Map user IDs to names
      const userNameMap: Record<string, string> = {}
      teamMembers.forEach(tm => { userNameMap[tm.user_id] = tm.full_name })

      const auditTrail = (auditLogs || []).map(log => ({
        ...log,
        user_name: userNameMap[log.user_id] || 'Unknown',
      }))

      return NextResponse.json({
        success: true,
        data: {
          report_type: 'audit',
          period_days: period,
          audit_trail: auditTrail,
        },
      })
    }

    if (reportType === 'summary') {
      // MGR-5: Team Summary Report
      const { data: allMeetings } = await supabase
        .from('dse_meetings')
        .select('organizer_id, status, meeting_type, meeting_purpose, outcome, customer_id, lead_id, scheduled_date')
        .in('organizer_id', teamUserIds)
        .gte('scheduled_date', startDateStr)

      const meetings = allMeetings || []
      const totalMeetings = meetings.length
      const completedMeetings = meetings.filter(m => m.status === 'Completed').length
      const cancelledMeetings = meetings.filter(m => m.status === 'Cancelled').length
      const noShowMeetings = meetings.filter(m => m.status === 'No Show').length
      const uniqueCustomers = new Set(meetings.filter(m => m.customer_id).map(m => m.customer_id)).size
      const uniqueLeads = new Set(meetings.filter(m => m.lead_id).map(m => m.lead_id)).size

      return NextResponse.json({
        success: true,
        data: {
          report_type: 'summary',
          period_days: period,
          summary: {
            team_size: teamMembers.length,
            total_meetings: totalMeetings,
            completed: completedMeetings,
            cancelled: cancelledMeetings,
            no_show: noShowMeetings,
            completion_rate: totalMeetings > 0 ? Math.round((completedMeetings / totalMeetings) * 100) : 0,
            unique_customers_met: uniqueCustomers,
            unique_leads_met: uniqueLeads,
            avg_meetings_per_member: teamMembers.length > 0 ? Math.round((totalMeetings / teamMembers.length) * 10) / 10 : 0,
          },
          by_member: teamMembers.map(member => {
            const memberMeetings = meetings.filter(m => m.organizer_id === member.user_id)
            return {
              name: member.full_name,
              total: memberMeetings.length,
              completed: memberMeetings.filter(m => m.status === 'Completed').length,
              cancelled: memberMeetings.filter(m => m.status === 'Cancelled').length,
            }
          }),
        },
      })
    }

    return NextResponse.json({ success: false, error: 'Invalid report type' }, { status: 400 })

  } catch (error: unknown) {
    apiLogger.error('Error generating manager report', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
