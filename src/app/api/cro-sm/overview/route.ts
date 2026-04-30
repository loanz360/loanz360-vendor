
import { NextRequest, NextResponse } from 'next/server'
import { verifyCROStateManagerAuth, getTeamLeaderIds } from '@/lib/api/cro-manager-middleware'
import { logger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  const auth = await verifyCROStateManagerAuth(request)
  if (!auth.success) return auth.response

  const { supabase, user, teamCROIds, requestId } = auth.context

  try {
    // Get Team Leader IDs
    const tlIds = await getTeamLeaderIds(supabase, user.id)

    // Get today's start in IST
    const now = new Date()
    const istOffset = 5.5 * 60 * 60 * 1000
    const istNow = new Date(now.getTime() + istOffset)
    const todayStart = new Date(istNow.getFullYear(), istNow.getMonth(), istNow.getDate())
    todayStart.setTime(todayStart.getTime() - istOffset)

    if (teamCROIds.length === 0 && tlIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          overview: {
            totalTeamLeaders: 0, totalCROs: 0, totalContacts: 0,
            totalLeads: 0, totalDeals: 0, callsToday: 0, conversionRate: 0,
          },
          teamLeaders: [],
        },
      })
    }

    // Aggregate metrics
    const [contactsRes, leadsRes, dealsRes, callsTodayRes] = await Promise.all([
      teamCROIds.length > 0
        ? supabase.from('crm_contacts').select('id', { count: 'exact', head: true }).in('assigned_to_cro', teamCROIds)
        : Promise.resolve({ count: 0 }),
      teamCROIds.length > 0
        ? supabase.from('crm_leads').select('id', { count: 'exact', head: true }).in('cro_id', teamCROIds).eq('status', 'active')
        : Promise.resolve({ count: 0 }),
      teamCROIds.length > 0
        ? supabase.from('crm_deals').select('id', { count: 'exact', head: true }).in('cro_id', teamCROIds)
        : Promise.resolve({ count: 0 }),
      teamCROIds.length > 0
        ? supabase.from('cro_call_logs').select('id', { count: 'exact', head: true }).in('cro_id', teamCROIds).gte('call_started_at', todayStart.toISOString())
        : Promise.resolve({ count: 0 }),
    ])

    // Build Team Leader summaries
    const teamLeaders = await Promise.all(
      tlIds.map(async (tlId) => {
        // Get TL profile
        const { data: tlProfile } = await supabase
          .from('employee_profile')
          .select('first_name, last_name, state')
          .eq('user_id', tlId)
          .maybeSingle()

        // Get CROs under this TL
        const { data: tlCros } = await supabase
          .rpc('get_cro_team_for_tl', { tl_user_id: tlId })

        const tlCroIds = (tlCros || []).map((c: { user_id: string }) => c.user_id)

        let contacts = 0, leads = 0, deals = 0, callsToday = 0
        if (tlCroIds.length > 0) {
          const [c, l, d, ct] = await Promise.all([
            supabase.from('crm_contacts').select('id', { count: 'exact', head: true }).in('assigned_to_cro', tlCroIds),
            supabase.from('crm_leads').select('id', { count: 'exact', head: true }).in('cro_id', tlCroIds).eq('status', 'active'),
            supabase.from('crm_deals').select('id', { count: 'exact', head: true }).in('cro_id', tlCroIds),
            supabase.from('cro_call_logs').select('id', { count: 'exact', head: true }).in('cro_id', tlCroIds).gte('call_started_at', todayStart.toISOString()),
          ])
          contacts = c.count || 0
          leads = l.count || 0
          deals = d.count || 0
          callsToday = ct.count || 0
        }

        return {
          userId: tlId,
          name: tlProfile ? `${tlProfile.first_name} ${tlProfile.last_name}` : 'Unknown',
          state: tlProfile?.state || null,
          teamSize: tlCroIds.length,
          totalContacts: contacts,
          totalLeads: leads,
          totalDeals: deals,
          callsToday,
        }
      })
    )

    const totalLeads = leadsRes.count || 0
    const totalDeals = dealsRes.count || 0

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalTeamLeaders: tlIds.length,
          totalCROs: teamCROIds.length,
          totalContacts: contactsRes.count || 0,
          totalLeads,
          totalDeals,
          callsToday: callsTodayRes.count || 0,
          conversionRate: totalLeads > 0 ? (totalDeals / totalLeads) * 100 : 0,
        },
        teamLeaders,
      },
    })
  } catch (error) {
    logger.error('[CRO-SM Overview] Error', { requestId, error: error instanceof Error ? error.message : 'Unknown' })
    return NextResponse.json({ success: false, error: 'Failed to fetch overview' }, { status: 500 })
  }
}
