
import { NextRequest, NextResponse } from 'next/server'
import { verifyCROTeamLeaderAuth } from '@/lib/api/cro-manager-middleware'
import { logger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  const auth = await verifyCROTeamLeaderAuth(request)
  if (!auth.success) return auth.response

  const { supabase, user, teamCROIds, requestId } = auth.context

  try {
    if (teamCROIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          overview: {
            totalMembers: 0,
            activeMembers: 0,
            totalContacts: 0,
            totalLeads: 0,
            totalDeals: 0,
            callsToday: 0,
            callsThisWeek: 0,
            conversionRate: 0,
            topPerformer: null,
          },
          members: [],
        },
      })
    }

    // Get team members with profiles
    const { data: teamMembers } = await supabase
      .rpc('get_cro_team_for_tl', { tl_user_id: user.id })

    // Get today's date in IST
    const now = new Date()
    const istOffset = 5.5 * 60 * 60 * 1000
    const istNow = new Date(now.getTime() + istOffset)
    const todayStart = new Date(istNow.getFullYear(), istNow.getMonth(), istNow.getDate())
    todayStart.setTime(todayStart.getTime() - istOffset)
    const weekStart = new Date(todayStart)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())

    // Run parallel queries
    const [contactsRes, leadsRes, dealsRes, callsTodayRes, callsWeekRes] = await Promise.all([
      supabase
        .from('crm_contacts')
        .select('assigned_to_cro', { count: 'exact', head: true })
        .in('assigned_to_cro', teamCROIds),
      supabase
        .from('crm_leads')
        .select('cro_id, status', { count: 'exact' })
        .in('cro_id', teamCROIds)
        .eq('status', 'active'),
      supabase
        .from('crm_deals')
        .select('cro_id', { count: 'exact', head: true })
        .in('cro_id', teamCROIds),
      supabase
        .from('cro_call_logs')
        .select('cro_id', { count: 'exact', head: true })
        .in('cro_id', teamCROIds)
        .gte('call_started_at', todayStart.toISOString()),
      supabase
        .from('cro_call_logs')
        .select('cro_id', { count: 'exact', head: true })
        .in('cro_id', teamCROIds)
        .gte('call_started_at', weekStart.toISOString()),
    ])

    // Get per-CRO metrics for team members
    const membersWithMetrics = await Promise.all(
      (teamMembers || []).map(async (member: Record<string, string>) => {
        const [mContacts, mLeads, mDeals, mCalls] = await Promise.all([
          supabase.from('crm_contacts').select('id', { count: 'exact', head: true }).eq('assigned_to_cro', member.user_id),
          supabase.from('crm_leads').select('id', { count: 'exact', head: true }).eq('cro_id', member.user_id).eq('status', 'active'),
          supabase.from('crm_deals').select('id', { count: 'exact', head: true }).eq('cro_id', member.user_id),
          supabase.from('cro_call_logs').select('id', { count: 'exact', head: true }).eq('cro_id', member.user_id).gte('call_started_at', todayStart.toISOString()),
        ])

        const totalLeads = mLeads.count || 0
        const totalDeals = mDeals.count || 0
        const conversionRate = totalLeads > 0 ? (totalDeals / totalLeads) * 100 : 0

        return {
          userId: member.user_id,
          employeeId: member.employee_id,
          firstName: member.first_name,
          lastName: member.last_name,
          email: member.email,
          phone: member.phone,
          state: member.state,
          subrole: member.subrole,
          metrics: {
            totalContacts: mContacts.count || 0,
            activeContacts: mContacts.count || 0,
            totalLeads: totalLeads,
            activeLeads: totalLeads,
            totalDeals: totalDeals,
            activeDeals: totalDeals,
            callsToday: mCalls.count || 0,
            callsThisWeek: 0,
            callsThisMonth: 0,
            conversionRate,
            avgCallDuration: 0,
            connectedRate: 0,
          },
        }
      })
    )

    // Find top performer by conversion rate
    const topPerformer = membersWithMetrics.length > 0
      ? membersWithMetrics.reduce((best, curr) =>
          (curr.metrics.conversionRate > best.metrics.conversionRate) ? curr : best
        )
      : null

    const totalLeads = leadsRes.count || 0
    const totalDeals = dealsRes.count || 0

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalMembers: teamMembers?.length || 0,
          activeMembers: teamMembers?.length || 0,
          totalContacts: contactsRes.count || 0,
          totalLeads,
          totalDeals,
          callsToday: callsTodayRes.count || 0,
          callsThisWeek: callsWeekRes.count || 0,
          conversionRate: totalLeads > 0 ? (totalDeals / totalLeads) * 100 : 0,
          topPerformer,
        },
        members: membersWithMetrics,
      },
    })
  } catch (error) {
    logger.error('[CRO-TL Overview] Error', { requestId, error: error instanceof Error ? error.message : 'Unknown' })
    return NextResponse.json({ success: false, error: 'Failed to fetch overview' }, { status: 500 })
  }
}
