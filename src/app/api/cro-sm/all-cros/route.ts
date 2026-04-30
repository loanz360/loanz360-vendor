
import { NextRequest, NextResponse } from 'next/server'
import { verifyCROStateManagerAuth } from '@/lib/api/cro-manager-middleware'
import { logger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  const auth = await verifyCROStateManagerAuth(request)
  if (!auth.success) return auth.response

  const { supabase, user, teamCROIds, requestId } = auth.context

  try {
    if (teamCROIds.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    const todayStart = getTodayStartIST()

    // Get profiles for all CROs
    const { data: profiles } = await supabase
      .from('employee_profile')
      .select('user_id, employee_id, first_name, last_name, email, phone, state, subrole')
      .in('user_id', teamCROIds)

    // Enrich with metrics
    const enriched = await Promise.all(
      (profiles || []).map(async (p) => {
        const [contacts, leads, deals, callsToday] = await Promise.all([
          supabase.from('crm_contacts').select('id', { count: 'exact', head: true }).eq('assigned_to_cro', p.user_id),
          supabase.from('crm_leads').select('id', { count: 'exact', head: true }).eq('cro_id', p.user_id).eq('status', 'active'),
          supabase.from('crm_deals').select('id', { count: 'exact', head: true }).eq('cro_id', p.user_id),
          supabase.from('cro_call_logs').select('id', { count: 'exact', head: true }).eq('cro_id', p.user_id).gte('call_started_at', todayStart.toISOString()),
        ])

        const totalLeads = leads.count || 0
        const totalDeals = deals.count || 0

        return {
          userId: p.user_id,
          employeeId: p.employee_id,
          firstName: p.first_name,
          lastName: p.last_name,
          email: p.email,
          phone: p.phone,
          state: p.state,
          subrole: p.subrole,
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
    logger.error('[CRO-SM All CROs] Error', { requestId, error: error instanceof Error ? error.message : 'Unknown' })
    return NextResponse.json({ success: false, error: 'Failed to fetch CROs' }, { status: 500 })
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
