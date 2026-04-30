import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import type { GraphDataPoint } from '@/lib/types/performance.types'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/performance/dse/graph-data
 * Returns daily performance trend data for graphs
 * Query params: days (default 30), metric (default 'revenue')
 */
export async function GET(request: NextRequest) {
  try {
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

    // Verify user is a DSE or DSM
    const { data: userProfile } = await supabase
      .from('users')
      .select('sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (!userProfile || !['DIRECT_SALES_EXECUTIVE', 'DIRECT_SALES_MANAGER'].includes(userProfile.sub_role)) {
      return NextResponse.json(
        { error: 'Access denied. This endpoint is for Direct Sales roles only.' },
        { status: 403 }
      )
    }

    // Validate input parameters
    const validatedDays = Math.min(Math.max(isNaN(days) ? 30 : days, 1), 365)
    const validMetrics = ['revenue', 'conversions', 'visits']
    const validatedMetric = validMetrics.includes(metric) ? metric : 'revenue'

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - validatedDays)

    // Fetch daily metrics for user
    const { data: userMetrics, error: metricsError } = await supabase
      .from('dse_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('metric_date', startDate.toISOString().split('T')[0])
      .lte('metric_date', endDate.toISOString().split('T')[0])
      .order('metric_date', { ascending: true })

    if (metricsError) {
      apiLogger.error('Error fetching user metrics', metricsError)
      return NextResponse.json({ success: false, error: 'Failed to fetch metrics' }, { status: 500 })
    }

    // Use admin client to bypass RLS and get all DSE employees for comparison
    const adminClient = createSupabaseAdmin()
    const { data: allDSEs } = await adminClient
      .from('users')
      .select('id')
      .eq('sub_role', 'DIRECT_SALES_EXECUTIVE')
      .eq('status', 'ACTIVE')

    const dseIds = allDSEs?.map(d => d.id) || []

    const { data: allMetrics } = await supabase
      .from('dse_daily_metrics')
      .select('metric_date, revenue_generated, leads_converted, field_visits_completed')
      .in('user_id', dseIds)
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

      switch (validatedMetric) {
        case 'revenue':
          value = dailyMetric.revenue_generated || 0
          avgValue = average.avg_revenue || 0
          break
        case 'conversions':
          value = dailyMetric.leads_converted || 0
          avgValue = average.avg_conversions || 0
          break
        case 'visits':
          value = dailyMetric.field_visits_completed || 0
          avgValue = average.avg_visits || 0
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
      metric: validatedMetric,
      days: validatedDays,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    })
  } catch (error: unknown) {
    apiLogger.error('Error in DSE graph-data API', error)
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
      avg_visits: metrics.reduce((sum, m) => sum + (m.field_visits_completed || 0), 0) / count,
    }
  })

  return averages
}
