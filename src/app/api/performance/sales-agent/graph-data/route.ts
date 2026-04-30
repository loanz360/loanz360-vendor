import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { GraphDataPoint } from '@/lib/types/performance.types'
import { apiLogger } from '@/lib/utils/logger'


export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const metric = searchParams.get('metric') || 'revenue'

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data: userMetrics, error: metricsError } = await supabase
      .from('sales_agent_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('metric_date', startDate.toISOString().split('T')[0])
      .lte('metric_date', endDate.toISOString().split('T')[0])
      .order('metric_date', { ascending: true })

    if (metricsError) {
      apiLogger.error('Error fetching user metrics', metricsError)
      return NextResponse.json({ success: false, error: 'Failed to fetch metrics' }, { status: 500 })
    }

    const { data: allSalesAgents } = await supabase
      .from('users')
      .select('id')
      .eq('sub_role', 'TELE_SALES')
      .eq('is_active', true)

    const agentIds = allSalesAgents?.map(d => d.id) || []

    const { data: allMetrics } = await supabase
      .from('sales_agent_daily_metrics')
      .select('metric_date, revenue_generated, leads_qualified, calls_made')
      .in('user_id', agentIds)
      .gte('metric_date', startDate.toISOString().split('T')[0])
      .lte('metric_date', endDate.toISOString().split('T')[0])

    const averagesByDate = calculateDailyAverages(allMetrics || [])

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
        case 'leads':
          value = dailyMetric.leads_qualified || 0
          avgValue = average.avg_leads || 0
          break
        case 'calls':
          value = dailyMetric.calls_made || 0
          avgValue = average.avg_calls || 0
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
    apiLogger.error('Error in Sales Agent graph-data API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

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
      avg_leads: metrics.reduce((sum, m) => sum + (m.leads_qualified || 0), 0) / count,
      avg_calls: metrics.reduce((sum, m) => sum + (m.calls_made || 0), 0) / count,
    }
  })

  return averages
}
