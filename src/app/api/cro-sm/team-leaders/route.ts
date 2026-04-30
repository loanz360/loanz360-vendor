
import { NextRequest, NextResponse } from 'next/server'
import { verifyCROStateManagerAuth, getTeamLeaderIds } from '@/lib/api/cro-manager-middleware'
import { logger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  const auth = await verifyCROStateManagerAuth(request)
  if (!auth.success) return auth.response

  const { supabase, user, requestId } = auth.context

  try {
    const tlIds = await getTeamLeaderIds(supabase, user.id)

    if (tlIds.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    const todayStart = getTodayStartIST()

    const leaders = await Promise.all(
      tlIds.map(async (tlId) => {
        const { data: profile } = await supabase
          .from('employee_profile')
          .select('first_name, last_name, email, phone, state')
          .eq('user_id', tlId)
          .maybeSingle()

        const { data: tlCros } = await supabase
          .rpc('get_cro_team_for_tl', { tl_user_id: tlId })

        const tlCroIds = (tlCros || []).map((c: { user_id: string }) => c.user_id)

        let totalContacts = 0, totalLeads = 0, totalDeals = 0, callsToday = 0
        if (tlCroIds.length > 0) {
          const [c, l, d, ct] = await Promise.all([
            supabase.from('crm_contacts').select('id', { count: 'exact', head: true }).in('assigned_to_cro', tlCroIds),
            supabase.from('crm_leads').select('id', { count: 'exact', head: true }).in('cro_id', tlCroIds).eq('status', 'active'),
            supabase.from('crm_deals').select('id', { count: 'exact', head: true }).in('cro_id', tlCroIds),
            supabase.from('cro_call_logs').select('id', { count: 'exact', head: true }).in('cro_id', tlCroIds).gte('call_started_at', todayStart.toISOString()),
          ])
          totalContacts = c.count || 0
          totalLeads = l.count || 0
          totalDeals = d.count || 0
          callsToday = ct.count || 0
        }

        const score = callsToday * 2 + totalLeads * 5 + totalDeals * 20

        return {
          userId: tlId,
          name: profile ? `${profile.first_name} ${profile.last_name}` : 'Unknown',
          email: profile?.email || '',
          phone: profile?.phone || '',
          state: profile?.state || null,
          teamSize: tlCroIds.length,
          totalContacts,
          totalLeads,
          totalDeals,
          callsToday,
          performanceScore: score,
        }
      })
    )

    return NextResponse.json({ success: true, data: leaders })
  } catch (error) {
    logger.error('[CRO-SM Team Leaders] Error', { requestId, error: error instanceof Error ? error.message : 'Unknown' })
    return NextResponse.json({ success: false, error: 'Failed to fetch team leaders' }, { status: 500 })
  }
}

function getTodayStartIST(): Date {
  const now = new Date()
  const istOffset = 5.5 * 60 * 60 * 1000
  const istNow = new Date(now.getTime() + istOffset)
  const todayStart = new Date(istNow.getFullYear(), istNow.getMonth(), istNow.getDate())
  todayStart.setTime(todayStart.getTime() - istOffset)
  return todayStart
}
