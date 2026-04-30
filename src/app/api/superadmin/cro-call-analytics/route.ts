import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/superadmin/cro-call-analytics
 * Org-wide CRO call analytics for SuperAdmin.
 * Query: period=today|week|month, cro_id, location, loan_type
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify SuperAdmin role
    const role = session.user.user_metadata?.role || session.user.app_metadata?.role
    if (role !== 'SUPER_ADMIN' && role !== 'ADMIN' && role !== 'SUPERADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period') || 'today'
    const filterCroId = searchParams.get('cro_id')

    // Calculate date range
    const now = new Date()
    let dateFrom: string
    const dateTo: string = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()

    switch (period) {
      case 'today':
        dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
        break
      case 'week':
        dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString()
        break
      case 'month':
        dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        break
      default:
        dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    }

    // Get all CRO profiles
    const { data: croProfiles } = await supabase
      .from('employee_profile')
      .select('user_id, first_name, last_name, department, designation')
      .eq('subrole', 'CRO')
      .eq('status', 'active')

    const allCroIds = croProfiles?.map(p => p.user_id) || []

    if (allCroIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: { summary: { totalCalls: 0 }, croRanking: [], dailyTrend: [] },
      })
    }

    const targetIds = filterCroId ? [filterCroId] : allCroIds

    // Fetch all call logs
    const { data: callLogs } = await supabase
      .from('cro_call_logs')
      .select('*')
      .in('cro_id', targetIds)
      .gte('call_started_at', dateFrom)
      .lt('call_started_at', dateTo)
      .order('call_started_at', { ascending: false })
      .limit(5000)

    const calls = callLogs || []

    // Org-wide summary
    const totalCalls = calls.length
    const connectedCalls = calls.filter(c =>
      ['connected', 'interested', 'callback_requested', 'not_interested'].includes(c.call_outcome)
    ).length
    const interestedCalls = calls.filter(c => c.call_outcome === 'interested').length
    const totalDuration = calls.reduce((sum, c) => sum + (c.call_duration_seconds || 0), 0)
    const avgDuration = connectedCalls > 0 ? Math.round(totalDuration / connectedCalls) : 0

    // Per-CRO ranking
    const croMap = new Map<string, {
      name: string
      department: string
      calls: number
      connected: number
      interested: number
      duration: number
      avgRating: number
      ratingCount: number
    }>()

    for (const profile of (croProfiles || [])) {
      croMap.set(profile.user_id, {
        name: `${profile.first_name} ${profile.last_name}`,
        department: profile.department || '',
        calls: 0,
        connected: 0,
        interested: 0,
        duration: 0,
        avgRating: 0,
        ratingCount: 0,
      })
    }

    for (const call of calls) {
      const cro = croMap.get(call.cro_id)
      if (!cro) continue
      cro.calls++
      if (['connected', 'interested', 'callback_requested', 'not_interested'].includes(call.call_outcome)) {
        cro.connected++
      }
      if (call.call_outcome === 'interested') cro.interested++
      cro.duration += call.call_duration_seconds || 0
      if (call.ai_rating) {
        cro.avgRating += call.ai_rating
        cro.ratingCount++
      }
    }

    const croRanking = Array.from(croMap.entries())
      .map(([croId, data]) => ({
        croId,
        name: data.name,
        department: data.department,
        totalCalls: data.calls,
        connectedCalls: data.connected,
        interestedCalls: data.interested,
        totalDuration: data.duration,
        avgDuration: data.connected > 0 ? Math.round(data.duration / data.connected) : 0,
        connectionRate: data.calls > 0 ? parseFloat(((data.connected / data.calls) * 100).toFixed(1)) : 0,
        positiveRate: data.calls > 0 ? parseFloat(((data.interested / data.calls) * 100).toFixed(1)) : 0,
        avgAIRating: data.ratingCount > 0 ? parseFloat((data.avgRating / data.ratingCount).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.totalCalls - a.totalCalls)

    // Daily trend for the period
    const dayMap = new Map<string, { calls: number; connected: number; interested: number }>()
    for (const call of calls) {
      const day = new Date(call.call_started_at).toISOString().split('T')[0]
      const existing = dayMap.get(day) || { calls: 0, connected: 0, interested: 0 }
      existing.calls++
      if (['connected', 'interested', 'callback_requested', 'not_interested'].includes(call.call_outcome)) {
        existing.connected++
      }
      if (call.call_outcome === 'interested') existing.interested++
      dayMap.set(day, existing)
    }

    const dailyTrend = Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data }))

    // Outcome breakdown
    const outcomeBreakdown: Record<string, number> = {}
    for (const call of calls) {
      outcomeBreakdown[call.call_outcome] = (outcomeBreakdown[call.call_outcome] || 0) + 1
    }

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalCalls,
          connectedCalls,
          interestedCalls,
          connectionRate: totalCalls > 0 ? parseFloat(((connectedCalls / totalCalls) * 100).toFixed(1)) : 0,
          positiveRate: totalCalls > 0 ? parseFloat(((interestedCalls / totalCalls) * 100).toFixed(1)) : 0,
          totalDuration,
          avgDuration,
          activeCros: allCroIds.length,
        },
        croRanking,
        dailyTrend,
        outcomeBreakdown,
        cros: (croProfiles || []).map(p => ({
          id: p.user_id,
          name: `${p.first_name} ${p.last_name}`,
        })),
      },
    })
  } catch (error) {
    apiLogger.error('Error fetching superadmin call analytics:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
