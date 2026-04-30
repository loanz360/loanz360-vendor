import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { GraphDataPoint } from '@/lib/types/performance.types'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/performance/cpe/graph-data
 * Returns daily performance trend data for graphs
 * Query params: days (default 30), metric (default 'revenue')
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const metric = searchParams.get('metric') || 'revenue'

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Fetch daily metrics for user
    const { data: userMetrics, error: metricsError } = await supabase
      .from('cpe_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('metric_date', startDate.toISOString().split('T')[0])
      .lte('metric_date', endDate.toISOString().split('T')[0])
      .order('metric_date', { ascending: true })

    if (metricsError) {
      apiLogger.error('Error fetching user metrics', metricsError)
      return NextResponse.json({ success: false, error: 'Failed to fetch metrics' }, { status: 500 })
    }

    // Fetch average metrics across all CPEs for comparison
    const { data: allCPEs } = await supabase
      .from('users')
      .select('id')
      .eq('sub_role', 'CHANNEL_PARTNER_EXECUTIVE')
      .eq('is_active', true)

    const cpeIds = allCPEs?.map(d => d.id) || []

    const { data: allMetrics } = await supabase
      .from('cpe_daily_metrics')
      .select('metric_date, partner_revenue, partner_leads_converted, partners_onboarded')
      .in('user_id', cpeIds)
      .gte('metric_date', startDate.toISOString().split('T')[0])
      .lte('metric_date', endDate.toISOString().split('T')[0])

    // Calculate daily averages
    const averagesByDate = calculateDailyAverages(allMetrics || [])

    // Format graph data
    const graphData: GraphDataPoint[] = (userMetrics || []).map((dailyMetric: unknown) => {
      const date = dailyMetric.metric_date
      const average = averagesByDate[date] || {}

      let value = 0
      let avgValue = 0

      switch (metric) {
        case 'revenue':
          value = dailyMetric.partner_revenue || 0
          avgValue = average.avg_revenue || 0
          break
        case 'conversions':
          value = dailyMetric.partner_leads_converted || 0
          avgValue = average.avg_conversions || 0
          break
        case 'onboarding':
          value = dailyMetric.partners_onboarded || 0
          avgValue = average.avg_onboarding || 0
          break
        default:
          value = dailyMetric.partner_revenue || 0
          avgValue = average.avg_revenue || 0
      }

      return {
        date,
        value,
        average: avgValue,
        label: new Date(date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      }
    })

    return NextResponse.json({
      graphData,
      metric,
      days,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    })
  } catch (error: unknown) {
    apiLogger.error('Error in CPE graph-data API', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to calculate daily averages
function calculateDailyAverages(allMetrics: unknown[]): Record<string, unknown> {
  const groupedByDate: Record<string, any[]> = {}

  allMetrics.forEach((metric) => {
    const date = metric.metric_date
    if (!groupedByDate[date]) {
      groupedByDate[date] = []
    }
    groupedByDate[date].push(metric)
  })

  const averages: Record<string, unknown> = {}

  Object.keys(groupedByDate).forEach((date) => {
    const metrics = groupedByDate[date]
    const count = metrics.length

    averages[date] = {
      avg_revenue: metrics.reduce((sum, m) => sum + (m.partner_revenue || 0), 0) / count,
      avg_conversions: metrics.reduce((sum, m) => sum + (m.partner_leads_converted || 0), 0) / count,
      avg_onboarding: metrics.reduce((sum, m) => sum + (m.partners_onboarded || 0), 0) / count,
    }
  })

  return averages
}
