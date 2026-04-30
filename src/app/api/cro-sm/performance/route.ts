
import { NextRequest, NextResponse } from 'next/server'
import { verifyCROStateManagerAuth, getTeamLeaderIds } from '@/lib/api/cro-manager-middleware'
import { logger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  const auth = await verifyCROStateManagerAuth(request)
  if (!auth.success) return auth.response

  const { supabase, user, teamCROIds, requestId } = auth.context

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'targets'
    const period = searchParams.get('period') || 'month'

    if (teamCROIds.length === 0) {
      return NextResponse.json({ success: true, data: { targets: [], leaderboard: [], report: null } })
    }

    const now = new Date()
    const istOffset = 5.5 * 60 * 60 * 1000
    const istNow = new Date(now.getTime() + istOffset)
    const todayStart = new Date(istNow.getFullYear(), istNow.getMonth(), istNow.getDate())
    todayStart.setTime(todayStart.getTime() - istOffset)

    let dateFrom: Date
    if (period === 'week') { dateFrom = new Date(todayStart); dateFrom.setDate(dateFrom.getDate() - 7) }
    else { dateFrom = new Date(todayStart); dateFrom.setDate(dateFrom.getDate() - 30) }

    const { data: profiles } = await supabase
      .from('employee_profile')
      .select('user_id, first_name, last_name')
      .in('user_id', teamCROIds)

    const croNameMap = new Map<string, string>()
    profiles?.forEach((p: { user_id: string; first_name: string; last_name: string }) => {
      croNameMap.set(p.user_id, `${p.first_name} ${p.last_name}`)
    })

    const croMetrics = await Promise.all(
      teamCROIds.map(async (croId) => {
        const [calls, leads, conversions] = await Promise.all([
          supabase.from('cro_call_logs').select('id', { count: 'exact', head: true }).eq('cro_id', croId).gte('call_started_at', dateFrom.toISOString()),
          supabase.from('crm_leads').select('id', { count: 'exact', head: true }).eq('cro_id', croId).gte('created_at', dateFrom.toISOString()),
          supabase.from('crm_deals').select('id', { count: 'exact', head: true }).eq('cro_id', croId).gte('created_at', dateFrom.toISOString()),
        ])
        return {
          croId, croName: croNameMap.get(croId) || 'Unknown',
          calls: calls.count || 0, leads: leads.count || 0, conversions: conversions.count || 0,
        }
      })
    )

    if (type === 'targets') {
      const targetCalls = period === 'week' ? 50 : 200
      const targetLeads = period === 'week' ? 10 : 40
      const targetConversions = period === 'week' ? 3 : 10

      const targets = croMetrics.map((m) => {
        const avg = ((m.calls / (targetCalls || 1)) * 100 + (m.leads / (targetLeads || 1)) * 100 + (m.conversions / (targetConversions || 1)) * 100) / 3
        return {
          croId: m.croId, croName: m.croName,
          targetCalls, actualCalls: m.calls,
          targetLeads, actualLeads: m.leads,
          targetConversions, actualConversions: m.conversions,
          achievementPercent: avg,
        }
      })
      return NextResponse.json({ success: true, data: { targets } })
    }

    if (type === 'leaderboard') {
      const leaderboard = croMetrics
        .map((m) => ({ ...m, score: m.calls + m.leads * 5 + m.conversions * 20, avgAiScore: 0, trend: 'stable' as const }))
        .sort((a, b) => b.score - a.score)
        .map((m, idx) => ({ ...m, rank: idx + 1 }))
      return NextResponse.json({ success: true, data: { leaderboard } })
    }

    if (type === 'report') {
      const totalCalls = croMetrics.reduce((s, m) => s + m.calls, 0)
      const totalLeads = croMetrics.reduce((s, m) => s + m.leads, 0)
      const totalConversions = croMetrics.reduce((s, m) => s + m.conversions, 0)

      const { count: totalContacts } = await supabase
        .from('crm_contacts')
        .select('id', { count: 'exact', head: true })
        .in('assigned_to_cro', teamCROIds)

      const { data: durationData } = await supabase
        .from('cro_call_logs')
        .select('call_duration_seconds')
        .in('cro_id', teamCROIds)
        .gte('call_started_at', dateFrom.toISOString())

      const avgDuration = durationData && durationData.length > 0
        ? Math.round(durationData.reduce((s, d) => s + (d.call_duration_seconds || 0), 0) / durationData.length)
        : 0

      const topPerformer = croMetrics.length > 0
        ? croMetrics.reduce((best, curr) =>
            (curr.calls + curr.leads * 5 + curr.conversions * 20) > (best.calls + best.leads * 5 + best.conversions * 20) ? curr : best
          )
        : null

      const tlIds = await getTeamLeaderIds(supabase, user.id)

      return NextResponse.json({
        success: true,
        data: {
          report: {
            totalCalls, totalContacts: totalContacts || 0, totalLeads,
            totalDeals: totalConversions,
            conversionRate: totalLeads > 0 ? (totalConversions / totalLeads) * 100 : 0,
            avgCallDuration: avgDuration,
            topPerformer: topPerformer?.croName || '-',
            period: period === 'week' ? 'Last 7 Days' : 'Last 30 Days',
            totalTeamLeaders: tlIds.length,
            totalCROs: teamCROIds.length,
          },
        },
      })
    }

    return NextResponse.json({ success: true, data: {} })
  } catch (error) {
    logger.error('[CRO-SM Performance] Error', { requestId, error: error instanceof Error ? error.message : 'Unknown' })
    return NextResponse.json({ success: false, error: 'Failed to fetch performance data' }, { status: 500 })
  }
}
