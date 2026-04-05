export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { verifyCROTeamLeaderAuth } from '@/lib/api/cro-manager-middleware'
import { logger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  const auth = await verifyCROTeamLeaderAuth(request)
  if (!auth.success) return auth.response

  const { supabase, teamCROIds, requestId } = auth.context

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'targets'
    const period = searchParams.get('period') || 'month'

    if (teamCROIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: { targets: [], leaderboard: [], report: null },
      })
    }

    // Calculate date range
    const now = new Date()
    const istOffset = 5.5 * 60 * 60 * 1000
    const istNow = new Date(now.getTime() + istOffset)
    const todayStart = new Date(istNow.getFullYear(), istNow.getMonth(), istNow.getDate())
    todayStart.setTime(todayStart.getTime() - istOffset)

    let dateFrom: Date
    if (period === 'week') {
      dateFrom = new Date(todayStart)
      dateFrom.setDate(dateFrom.getDate() - 7)
    } else {
      dateFrom = new Date(todayStart)
      dateFrom.setDate(dateFrom.getDate() - 30)
    }

    // Get CRO names
    const { data: profiles } = await supabase
      .from('employee_profile')
      .select('user_id, first_name, last_name')
      .in('user_id', teamCROIds)

    const croNameMap = new Map<string, string>()
    profiles?.forEach((p: { user_id: string; first_name: string; last_name: string }) => {
      croNameMap.set(p.user_id, `${p.first_name} ${p.last_name}`)
    })

    // Get per-CRO metrics
    const croMetrics = await Promise.all(
      teamCROIds.map(async (croId) => {
        const [calls, leads, conversions] = await Promise.all([
          supabase
            .from('cro_call_logs')
            .select('id', { count: 'exact', head: true })
            .eq('cro_id', croId)
            .gte('call_started_at', dateFrom.toISOString()),
          supabase
            .from('crm_leads')
            .select('id', { count: 'exact', head: true })
            .eq('cro_id', croId)
            .gte('created_at', dateFrom.toISOString()),
          supabase
            .from('crm_deals')
            .select('id', { count: 'exact', head: true })
            .eq('cro_id', croId)
            .gte('created_at', dateFrom.toISOString()),
        ])

        return {
          croId,
          croName: croNameMap.get(croId) || 'Unknown',
          calls: calls.count || 0,
          leads: leads.count || 0,
          conversions: conversions.count || 0,
        }
      })
    )

    if (type === 'targets') {
      // Default targets (can be enhanced with actual target table later)
      const defaultTargetCalls = period === 'week' ? 50 : 200
      const defaultTargetLeads = period === 'week' ? 10 : 40
      const defaultTargetConversions = period === 'week' ? 3 : 10

      const targets = croMetrics.map((m) => {
        const callsAchievement = defaultTargetCalls > 0 ? (m.calls / defaultTargetCalls) * 100 : 0
        const leadsAchievement = defaultTargetLeads > 0 ? (m.leads / defaultTargetLeads) * 100 : 0
        const convsAchievement = defaultTargetConversions > 0 ? (m.conversions / defaultTargetConversions) * 100 : 0
        const avgAchievement = (callsAchievement + leadsAchievement + convsAchievement) / 3

        return {
          croId: m.croId,
          croName: m.croName,
          targetCalls: defaultTargetCalls,
          actualCalls: m.calls,
          targetLeads: defaultTargetLeads,
          actualLeads: m.leads,
          targetConversions: defaultTargetConversions,
          actualConversions: m.conversions,
          achievementPercent: avgAchievement,
        }
      })

      return NextResponse.json({ success: true, data: { targets } })
    }

    if (type === 'leaderboard') {
      const leaderboard = croMetrics
        .map((m) => ({
          ...m,
          score: m.calls + m.leads * 5 + m.conversions * 20,
          avgAiScore: 0,
          trend: 'stable' as const,
        }))
        .sort((a, b) => b.score - a.score)
        .map((m, idx) => ({ ...m, rank: idx + 1 }))

      return NextResponse.json({ success: true, data: { leaderboard } })
    }

    if (type === 'report') {
      const totalCalls = croMetrics.reduce((s, m) => s + m.calls, 0)
      const totalLeads = croMetrics.reduce((s, m) => s + m.leads, 0)
      const totalConversions = croMetrics.reduce((s, m) => s + m.conversions, 0)

      // Get contacts count
      const { count: totalContacts } = await supabase
        .from('crm_contacts')
        .select('id', { count: 'exact', head: true })
        .in('assigned_to_cro', teamCROIds)

      // Get avg call duration
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
            (curr.calls + curr.leads * 5 + curr.conversions * 20) >
            (best.calls + best.leads * 5 + best.conversions * 20)
              ? curr
              : best
          )
        : null

      return NextResponse.json({
        success: true,
        data: {
          report: {
            totalCalls,
            totalContacts: totalContacts || 0,
            totalLeads,
            totalDeals: totalConversions,
            conversionRate: totalLeads > 0 ? (totalConversions / totalLeads) * 100 : 0,
            avgCallDuration: avgDuration,
            topPerformer: topPerformer?.croName || '-',
            period: period === 'week' ? 'Last 7 Days' : 'Last 30 Days',
          },
        },
      })
    }

    return NextResponse.json({ success: true, data: {} })
  } catch (error) {
    logger.error('[CRO-TL Performance] Error', { requestId, error: error instanceof Error ? error.message : 'Unknown' })
    return NextResponse.json({ success: false, error: 'Failed to fetch performance data' }, { status: 500 })
  }
}
