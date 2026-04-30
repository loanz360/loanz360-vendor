import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { GraphDataPoint } from '@/lib/types/performance.types'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/performance/digital-sales/graph-data
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
      .from('digital_sales_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('metric_date', startDate.toISOString().split('T')[0])
      .lte('metric_date', endDate.toISOString().split('T')[0])
      .order('metric_date', { ascending: true })

    if (metricsError) {
      apiLogger.error('Error fetching user metrics', metricsError)
      return NextResponse.json({ success: false, error: 'Failed to fetch metrics' }, { status: 500 })
    }

    // Fetch average metrics across all Digital Sales for comparison
    const { data: allDigitalSales } = await supabase
      .from('users')
      .select('id')
      .eq('sub_role', 'DIGITAL_SALES')
      .eq('is_active', true)

    const digitalSalesIds = allDigitalSales?.map(d => d.id) || []

    const { data: allMetrics } = await supabase
      .from('digital_sales_daily_metrics')
      .select('metric_date, revenue_generated, leads_converted, total_digital_leads')
      .in('user_id', digitalSalesIds)
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
          value = dailyMetric.revenue_generated || 0
          avgValue = average.avg_revenue || 0
          break
        case 'conversions':
          value = dailyMetric.leads_converted || 0
          avgValue = average.avg_conversions || 0
          break
        case 'leads':
          value = dailyMetric.total_digital_leads || 0
          avgValue = average.avg_leads || 0
          break
        default:
          value = dailyMetric.revenue_generated || 0
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
    apiLogger.error('Error in Digital Sales graph-data API', error)
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
      avg_revenue: metrics.reduce((sum, m) => sum + (m.revenue_generated || 0), 0) / count,
      avg_conversions: metrics.reduce((sum, m) => sum + (m.leads_converted || 0), 0) / count,
      avg_leads: metrics.reduce((sum, m) => sum + (m.total_digital_leads || 0), 0) / count,
    }
  })

  return averages
}
