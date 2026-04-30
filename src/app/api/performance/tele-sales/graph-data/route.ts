import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { GraphDataPoint } from '@/lib/types/performance.types'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/performance/tele-sales/graph-data
 * Returns graph/trend data for Tele Sales performance visualization
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('users')
      .select('sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || profile.sub_role !== 'TELE_SALES') {
      return NextResponse.json(
        { error: 'Access denied. This endpoint is for Tele Sales employees only.' },
        { status: 403 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get('days') || '30')
    const metric = searchParams.get('metric') || 'revenue' // revenue, calls, leads, quality

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Fetch daily metrics
    const { data: dailyMetrics, error: metricsError } = await supabase
      .from('tele_sales_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('metric_date', startDate.toISOString().split('T')[0])
      .lte('metric_date', endDate.toISOString().split('T')[0])
      .order('metric_date', { ascending: true })

    if (metricsError) {
      apiLogger.error('Error fetching metrics', metricsError)
    }

    // Get organization average for comparison
    const { data: allMetrics } = await supabase
      .from('tele_sales_daily_metrics')
      .select('metric_date, revenue_generated, total_calls, leads_converted, call_quality_score')
      .gte('metric_date', startDate.toISOString().split('T')[0])
      .lte('metric_date', endDate.toISOString().split('T')[0])

    // Calculate daily averages for organization
    const orgDailyAverages: Record<string, { sum: number; count: number }> = {}
    if (allMetrics) {
      allMetrics.forEach((m) => {
        const date = m.metric_date
        if (!orgDailyAverages[date]) {
          orgDailyAverages[date] = { sum: 0, count: 0 }
        }
        orgDailyAverages[date].sum += getMetricValue(m, metric)
        orgDailyAverages[date].count++
      })
    }

    // Build graph data
    const graphData: GraphDataPoint[] = []
    const currentDate = new Date(startDate)

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0]
      const dayMetric = (dailyMetrics || []).find((m) => m.metric_date === dateStr)
      const orgAvg = orgDailyAverages[dateStr]

      graphData.push({
        date: dateStr,
        value: dayMetric ? getMetricValueFromDaily(dayMetric, metric) : 0,
        label: formatDateLabel(currentDate),
        target: getTargetForMetric(metric),
        average: orgAvg ? Math.round(orgAvg.sum / orgAvg.count) : 0,
      })

      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Calculate summary statistics
    const values = graphData.map((d) => d.value).filter((v) => v > 0)
    const summary = {
      min: values.length > 0 ? Math.min(...values) : 0,
      max: values.length > 0 ? Math.max(...values) : 0,
      avg: values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0,
      total: values.reduce((a, b) => a + b, 0),
      daysWithData: values.length,
    }

    // Calculate trend
    const firstHalf = values.slice(0, Math.floor(values.length / 2))
    const secondHalf = values.slice(Math.floor(values.length / 2))
    const firstHalfAvg = firstHalf.length > 0 ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : 0
    const secondHalfAvg = secondHalf.length > 0 ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : 0
    const trendPercentage = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 : 0

    return NextResponse.json({
      graphData,
      summary,
      metric,
      metricLabel: getMetricLabel(metric),
      days,
      trend: {
        direction: trendPercentage > 5 ? 'up' : trendPercentage < -5 ? 'down' : 'stable',
        percentage: Math.abs(Math.round(trendPercentage * 10) / 10),
      },
    })
  } catch (error: unknown) {
    apiLogger.error('Error in Tele Sales graph data API', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function getMetricValue(metric: unknown, type: string): number {
  switch (type) {
    case 'revenue':
      return metric.revenue_generated || 0
    case 'calls':
      return metric.total_calls || 0
    case 'leads':
      return metric.leads_converted || 0
    case 'quality':
      return metric.call_quality_score || 0
    default:
      return metric.revenue_generated || 0
  }
}

function getMetricValueFromDaily(dailyMetric: unknown, type: string): number {
  switch (type) {
    case 'revenue':
      return dailyMetric.revenue_generated || 0
    case 'calls':
      return (dailyMetric.outbound_calls_made || 0) + (dailyMetric.inbound_calls_received || 0)
    case 'leads':
      return dailyMetric.leads_converted || 0
    case 'quality':
      return dailyMetric.call_quality_score || 0
    case 'talktime':
      return dailyMetric.total_talk_time_minutes || 0
    case 'conversions':
      return dailyMetric.applications_completed || 0
    default:
      return dailyMetric.revenue_generated || 0
  }
}

function getTargetForMetric(metric: string): number {
  // Daily targets (monthly / 22 working days)
  switch (metric) {
    case 'revenue':
      return 68182 // 1.5M / 22
    case 'calls':
      return 23 // 500 / 22
    case 'leads':
      return 1 // 25 / 22
    case 'quality':
      return 85
    case 'talktime':
      return 82 // 1800 / 22
    case 'conversions':
      return 1 // 30 / 22
    default:
      return 0
  }
}

function getMetricLabel(metric: string): string {
  switch (metric) {
    case 'revenue':
      return 'Revenue (₹)'
    case 'calls':
      return 'Total Calls'
    case 'leads':
      return 'Leads Converted'
    case 'quality':
      return 'Call Quality Score (%)'
    case 'talktime':
      return 'Talk Time (min)'
    case 'conversions':
      return 'Applications Completed'
    default:
      return 'Revenue (₹)'
  }
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}
