export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { verifyCROTeamLeaderAuth } from '@/lib/api/cro-manager-middleware'
import { logger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  const auth = await verifyCROTeamLeaderAuth(request)
  if (!auth.success) return auth.response

  const { supabase, user, requestId } = auth.context

  try {
    // Get team members
    const { data: teamMembers, error } = await supabase
      .rpc('get_cro_team_for_tl', { tl_user_id: user.id })

    if (error) {
      logger.error('[CRO-TL Team] RPC error', { requestId, error })
      return NextResponse.json({ success: false, error: 'Failed to fetch team' }, { status: 500 })
    }

    if (!teamMembers || teamMembers.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    // Get today's start in IST
    const now = new Date()
    const istOffset = 5.5 * 60 * 60 * 1000
    const istNow = new Date(now.getTime() + istOffset)
    const todayStart = new Date(istNow.getFullYear(), istNow.getMonth(), istNow.getDate())
    todayStart.setTime(todayStart.getTime() - istOffset)

    // Enrich with metrics
    const enriched = await Promise.all(
      teamMembers.map(async (member: Record<string, string>) => {
        const [contacts, leads, deals, callsToday] = await Promise.all([
          supabase.from('crm_contacts').select('id', { count: 'exact', head: true }).eq('assigned_to_cro', member.user_id),
          supabase.from('crm_leads').select('id', { count: 'exact', head: true }).eq('cro_id', member.user_id).eq('status', 'active'),
          supabase.from('crm_deals').select('id', { count: 'exact', head: true }).eq('cro_id', member.user_id),
          supabase.from('cro_call_logs').select('id', { count: 'exact', head: true }).eq('cro_id', member.user_id).gte('call_started_at', todayStart.toISOString()),
        ])

        const totalLeads = leads.count || 0
        const totalDeals = deals.count || 0

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
            totalContacts: contacts.count || 0,
            activeContacts: contacts.count || 0,
            totalLeads,
            activeLeads: totalLeads,
            totalDeals,
            activeDeals: totalDeals,
            callsToday: callsToday.count || 0,
            callsThisWeek: 0,
            callsThisMonth: 0,
            conversionRate: totalLeads > 0 ? (totalDeals / totalLeads) * 100 : 0,
            avgCallDuration: 0,
            connectedRate: 0,
          },
        }
      })
    )

    return NextResponse.json({ success: true, data: enriched })
  } catch (error) {
    logger.error('[CRO-TL Team] Error', { requestId, error: error instanceof Error ? error.message : 'Unknown' })
    return NextResponse.json({ success: false, error: 'Failed to fetch team' }, { status: 500 })
  }
}
