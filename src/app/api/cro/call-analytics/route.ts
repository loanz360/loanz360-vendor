import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cro/call-analytics
 * Aggregated call analytics for the authenticated CRO
 * Query params: period=today|week|month|custom, date_from, date_to, page, page_size
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Role verification - only CRO roles can access this endpoint
    const userRole = user.user_metadata?.sub_role || user.user_metadata?.role || ''
    const allowedRoles = ['CRO', 'CUSTOMER RELATIONSHIP OFFICER', 'CRO_TEAM_LEADER', 'CRO_STATE_MANAGER', 'SUPER_ADMIN', 'ADMIN']
    if (!allowedRoles.some(r => userRole.toUpperCase() === r)) {
      return NextResponse.json({ success: false, error: 'Forbidden: CRO access required' }, { status: 403 })
    }

    const userId = user.id
    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period') || 'today'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '20', 10)))

    // Calculate date range
    const now = new Date()
    let dateFrom: string
    let dateTo: string = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()
    let trendDays = 7

    switch (period) {
      case 'today': {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        dateFrom = today.toISOString()
        trendDays = 1
        break
      }
      case 'week': {
        const weekAgo = new Date(now)
        weekAgo.setDate(weekAgo.getDate() - 7)
        weekAgo.setHours(0, 0, 0, 0)
        dateFrom = weekAgo.toISOString()
        trendDays = 7
        break
      }
      case 'month': {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        dateFrom = monthStart.toISOString()
        // Calculate days in period so far
        trendDays = now.getDate()
        break
      }
      case 'custom': {
        dateFrom = searchParams.get('date_from') || new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
        dateTo = searchParams.get('date_to') || dateTo
        const diffMs = new Date(dateTo).getTime() - new Date(dateFrom).getTime()
        trendDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
        break
      }
      default: {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        dateFrom = today.toISOString()
        trendDays = 1
      }
    }

    // Calculate previous period for comparison
    const periodMs = new Date(dateTo).getTime() - new Date(dateFrom).getTime()
    const prevDateTo = dateFrom
    const prevDateFrom = new Date(new Date(dateFrom).getTime() - periodMs).toISOString()

    // Trend date range (match the selected period)
    const trendFrom = new Date(now)
    trendFrom.setDate(trendFrom.getDate() - (trendDays - 1))
    trendFrom.setHours(0, 0, 0, 0)

    // Pagination offset
    const offset = (page - 1) * pageSize

    // Run all analytics queries in parallel
    const [
      callLogsResult,
      trendResult,
      prevPeriodResult,
      paginatedCallsResult,
      totalCountResult,
    ] = await Promise.all([
      // All call logs in date range (for analytics aggregation)
      supabase
        .from('cro_call_logs')
        .select('call_outcome, call_duration_seconds, call_started_at, interest_level, ai_analysis_status, ai_rating')
        .eq('cro_id', userId)
        .gte('call_started_at', dateFrom)
        .lt('call_started_at', dateTo)
        .order('call_started_at', { ascending: false }),

      // Trend data matching the selected period
      supabase
        .from('cro_call_logs')
        .select('call_started_at, call_outcome, call_duration_seconds')
        .eq('cro_id', userId)
        .gte('call_started_at', trendFrom.toISOString())
        .lt('call_started_at', dateTo)
        .order('call_started_at', { ascending: true }),

      // Previous period for comparison
      supabase
        .from('cro_call_logs')
        .select('call_outcome, call_duration_seconds, ai_analysis_status, ai_rating')
        .eq('cro_id', userId)
        .gte('call_started_at', prevDateFrom)
        .lt('call_started_at', prevDateTo),

      // Paginated full call logs for table
      supabase
        .from('cro_call_logs')
        .select('id, customer_name, customer_phone, contact_type, call_type, call_duration_seconds, call_outcome, disposition_notes, interest_level, ai_rating, ai_sentiment, ai_summary, ai_coaching_feedback, ai_positive_points, ai_improvement_points, ai_extracted_data, ai_analysis_status, transcript, call_started_at, call_ended_at, recording_url')
        .eq('cro_id', userId)
        .gte('call_started_at', dateFrom)
        .lt('call_started_at', dateTo)
        .order('call_started_at', { ascending: false })
        .range(offset, offset + pageSize - 1),

      // Total count for pagination
      supabase
        .from('cro_call_logs')
        .select('id', { count: 'exact', head: true })
        .eq('cro_id', userId)
        .gte('call_started_at', dateFrom)
        .lt('call_started_at', dateTo),
    ])

    const calls = callLogsResult.data || []
    const trendCalls = trendResult.data || []
    const prevCalls = prevPeriodResult.data || []
    const paginatedCalls = paginatedCallsResult.data || []
    const totalCount = totalCountResult.count || 0

    // Summary stats
    const totalCalls = calls.length
    const connectedCalls = calls.filter(c =>
      ['connected', 'interested', 'callback_requested', 'not_interested'].includes(c.call_outcome)
    ).length
    const interestedCalls = calls.filter(c => c.call_outcome === 'interested').length
    const totalDuration = calls.reduce((sum, c) => sum + (c.call_duration_seconds || 0), 0)
    const avgDuration = connectedCalls > 0 ? Math.round(totalDuration / connectedCalls) : 0
    const positiveRate = totalCalls > 0 ? parseFloat(((interestedCalls / totalCalls) * 100).toFixed(1)) : 0
    const connectionRate = totalCalls > 0 ? parseFloat(((connectedCalls / totalCalls) * 100).toFixed(1)) : 0

    // Previous period stats for comparison
    const prevTotalCalls = prevCalls.length
    const prevConnectedCalls = prevCalls.filter(c =>
      ['connected', 'interested', 'callback_requested', 'not_interested'].includes(c.call_outcome)
    ).length
    const prevInterestedCalls = prevCalls.filter(c => c.call_outcome === 'interested').length
    const prevTotalDuration = prevCalls.reduce((sum, c) => sum + (c.call_duration_seconds || 0), 0)
    const prevAvgDuration = prevConnectedCalls > 0 ? Math.round(prevTotalDuration / prevConnectedCalls) : 0
    const prevPositiveRate = prevTotalCalls > 0 ? parseFloat(((prevInterestedCalls / prevTotalCalls) * 100).toFixed(1)) : 0
    const prevConnectionRate = prevTotalCalls > 0 ? parseFloat(((prevConnectedCalls / prevTotalCalls) * 100).toFixed(1)) : 0
    const prevAnalyzedCalls = prevCalls.filter(c => c.ai_analysis_status === 'completed')
    const prevAvgAIRating = prevAnalyzedCalls.length > 0
      ? parseFloat((prevAnalyzedCalls.reduce((sum, c) => sum + (c.ai_rating || 0), 0) / prevAnalyzedCalls.length).toFixed(1))
      : 0

    // Outcome breakdown
    const outcomeBreakdown: Record<string, number> = {}
    for (const call of calls) {
      outcomeBreakdown[call.call_outcome] = (outcomeBreakdown[call.call_outcome] || 0) + 1
    }

    // Hourly distribution (computed from all calls in range)
    const hourlyDistribution: number[] = Array(24).fill(0)
    for (const call of calls) {
      const hour = new Date(call.call_started_at).getHours()
      hourlyDistribution[hour]++
    }

    // Daily trend - aggregate per day, matching the selected period
    const dailyTrend: Array<{ date: string; calls: number; connected: number; duration: number }> = []
    const dayMap = new Map<string, { calls: number; connected: number; duration: number }>()

    for (const call of trendCalls) {
      const day = new Date(call.call_started_at).toISOString().split('T')[0]
      const existing = dayMap.get(day) || { calls: 0, connected: 0, duration: 0 }
      existing.calls++
      if (['connected', 'interested', 'callback_requested', 'not_interested'].includes(call.call_outcome)) {
        existing.connected++
      }
      existing.duration += call.call_duration_seconds || 0
      dayMap.set(day, existing)
    }

    // Fill in all days for the period
    for (let i = trendDays - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const data = dayMap.get(dateStr) || { calls: 0, connected: 0, duration: 0 }
      dailyTrend.push({ date: dateStr, ...data })
    }

    // Interest level breakdown
    const interestBreakdown: Record<string, number> = {}
    for (const call of calls) {
      if (call.interest_level) {
        interestBreakdown[call.interest_level] = (interestBreakdown[call.interest_level] || 0) + 1
      }
    }

    // AI analysis stats
    const analyzedCalls = calls.filter(c => c.ai_analysis_status === 'completed')
    const avgAIRating = analyzedCalls.length > 0
      ? parseFloat((analyzedCalls.reduce((sum, c) => sum + (c.ai_rating || 0), 0) / analyzedCalls.length).toFixed(1))
      : 0

    // AI quality distribution
    const qualityDistribution = { excellent: 0, good: 0, average: 0, poor: 0 }
    for (const call of analyzedCalls) {
      const rating = call.ai_rating || 0
      if (rating >= 8) qualityDistribution.excellent++
      else if (rating >= 6) qualityDistribution.good++
      else if (rating >= 4) qualityDistribution.average++
      else qualityDistribution.poor++
    }

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalCalls,
          connectedCalls,
          interestedCalls,
          connectionRate,
          positiveRate,
          totalDuration,
          avgDuration,
          avgAIRating,
          analyzedCalls: analyzedCalls.length,
        },
        previousPeriod: {
          totalCalls: prevTotalCalls,
          connectedCalls: prevConnectedCalls,
          interestedCalls: prevInterestedCalls,
          connectionRate: prevConnectionRate,
          positiveRate: prevPositiveRate,
          avgDuration: prevAvgDuration,
          avgAIRating: prevAvgAIRating,
        },
        outcomeBreakdown,
        hourlyDistribution,
        dailyTrend,
        interestBreakdown,
        qualityDistribution,
        recentCalls: paginatedCalls,
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages: Math.ceil(totalCount / pageSize),
        },
      },
    })
  } catch (error) {
    apiLogger.error('Error fetching call analytics:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
