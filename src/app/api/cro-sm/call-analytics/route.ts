
import { NextRequest, NextResponse } from 'next/server'
import { verifyCROStateManagerAuth } from '@/lib/api/cro-manager-middleware'
import { logger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  const auth = await verifyCROStateManagerAuth(request)
  if (!auth.success) return auth.response

  const { supabase, teamCROIds, requestId } = auth.context

  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'today'

    if (teamCROIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          totalCalls: 0, connectedCalls: 0, connectedRate: 0,
          avgDuration: 0, positiveRate: 0,
          outcomes: {}, dailyTrend: [], croBreakdown: [],
        },
      })
    }

    const now = new Date()
    const istOffset = 5.5 * 60 * 60 * 1000
    const istNow = new Date(now.getTime() + istOffset)
    const todayStart = new Date(istNow.getFullYear(), istNow.getMonth(), istNow.getDate())
    todayStart.setTime(todayStart.getTime() - istOffset)

    let dateFrom: Date
    if (period === 'today') dateFrom = todayStart
    else if (period === 'week') { dateFrom = new Date(todayStart); dateFrom.setDate(dateFrom.getDate() - 7) }
    else { dateFrom = new Date(todayStart); dateFrom.setDate(dateFrom.getDate() - 30) }

    const { data: callLogs } = await supabase
      .from('cro_call_logs')
      .select('cro_id, call_outcome, call_duration_seconds, call_started_at')
      .in('cro_id', teamCROIds)
      .gte('call_started_at', dateFrom.toISOString())
      .order('call_started_at', { ascending: true })

    const logs = callLogs || []
    const totalCalls = logs.length
    const connectedCalls = logs.filter((l) => l.call_outcome === 'connected' || l.call_outcome === 'interested').length
    const positiveCalls = logs.filter((l) => l.call_outcome === 'interested' || l.call_outcome === 'callback_requested').length
    const totalDuration = logs.reduce((sum, l) => sum + (l.call_duration_seconds || 0), 0)

    const outcomes: Record<string, number> = {}
    logs.forEach((l) => { outcomes[l.call_outcome] = (outcomes[l.call_outcome] || 0) + 1 })

    const dailyMap = new Map<string, { calls: number; connected: number }>()
    logs.forEach((l) => {
      const date = new Date(l.call_started_at).toISOString().split('T')[0]
      const entry = dailyMap.get(date) || { calls: 0, connected: 0 }
      entry.calls++
      if (l.call_outcome === 'connected' || l.call_outcome === 'interested') entry.connected++
      dailyMap.set(date, entry)
    })
    const dailyTrend = Array.from(dailyMap.entries()).map(([date, d]) => ({ date, calls: d.calls, connected: d.connected }))

    const { data: profiles } = await supabase
      .from('employee_profile')
      .select('user_id, first_name, last_name')
      .in('user_id', teamCROIds)

    const croNameMap = new Map<string, string>()
    profiles?.forEach((p: { user_id: string; first_name: string; last_name: string }) => {
      croNameMap.set(p.user_id, `${p.first_name} ${p.last_name}`)
    })

    const croMap = new Map<string, { calls: number; connected: number; duration: number; positive: number }>()
    logs.forEach((l) => {
      const entry = croMap.get(l.cro_id) || { calls: 0, connected: 0, duration: 0, positive: 0 }
      entry.calls++
      if (l.call_outcome === 'connected' || l.call_outcome === 'interested') entry.connected++
      if (l.call_outcome === 'interested' || l.call_outcome === 'callback_requested') entry.positive++
      entry.duration += l.call_duration_seconds || 0
      croMap.set(l.cro_id, entry)
    })

    const croBreakdown = Array.from(croMap.entries()).map(([croId, d]) => ({
      croId, croName: croNameMap.get(croId) || 'Unknown',
      calls: d.calls, connected: d.connected,
      avgDuration: d.calls > 0 ? Math.round(d.duration / d.calls) : 0,
      positiveRate: d.calls > 0 ? (d.positive / d.calls) * 100 : 0,
    }))

    return NextResponse.json({
      success: true,
      data: {
        totalCalls, connectedCalls,
        connectedRate: totalCalls > 0 ? (connectedCalls / totalCalls) * 100 : 0,
        avgDuration: totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0,
        positiveRate: totalCalls > 0 ? (positiveCalls / totalCalls) * 100 : 0,
        outcomes, dailyTrend, croBreakdown,
      },
    })
  } catch (error) {
    logger.error('[CRO-SM Call Analytics] Error', { requestId, error: error instanceof Error ? error.message : 'Unknown' })
    return NextResponse.json({ success: false, error: 'Failed to fetch call analytics' }, { status: 500 })
  }
}
