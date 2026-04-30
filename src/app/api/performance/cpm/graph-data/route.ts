import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/performance/cpm/graph-data
 * Returns 30-day performance graph data for Channel Partner Manager
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

    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 30)

    // Try to fetch daily metrics - handle gracefully if table doesn't exist
    let dailyMetrics: any[] = []
    try {
      const { data, error } = await supabase
        .from('cpm_daily_metrics')
        .select('*')
        .eq('user_id', user.id)
        .gte('metric_date', startDate.toISOString().split('T')[0])
        .lte('metric_date', endDate.toISOString().split('T')[0])
        .order('metric_date', { ascending: true })

      if (!error && data) {
        dailyMetrics = data
      }
    } catch (e) {
    }

    if (dailyMetrics.length === 0) {
      return NextResponse.json({
        graphData: [],
        summary: {
          totalRevenue: 0,
          totalNewPartners: 0,
          totalTrainingSessions: 0,
          daysTracked: 0,
        }
      })
    }

    const graphData = dailyMetrics.map(metric => ({
      date: new Date(metric.metric_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      revenue: metric.partner_revenue_generated || 0,
      activePartners: metric.active_partners_count || 0,
      newPartners: metric.new_partners_onboarded || 0,
      trainingSessions: metric.training_sessions_conducted || 0,
    }))

    const cumulativeData = graphData.reduce((acc, curr, index) => {
      const prevRevenue = index > 0 ? acc[index - 1].cumulativeRevenue : 0
      const prevPartners = index > 0 ? acc[index - 1].cumulativeNewPartners : 0

      acc.push({
        ...curr,
        cumulativeRevenue: prevRevenue + curr.revenue,
        cumulativeNewPartners: prevPartners + curr.newPartners,
      })

      return acc
    }, [] as any[])

    return NextResponse.json({
      graphData: cumulativeData,
      summary: {
        totalRevenue: dailyMetrics.reduce((sum, d) => sum + (d.partner_revenue_generated || 0), 0),
        totalNewPartners: dailyMetrics.reduce((sum, d) => sum + (d.new_partners_onboarded || 0), 0),
        totalTrainingSessions: dailyMetrics.reduce((sum, d) => sum + (d.training_sessions_conducted || 0), 0),
        daysTracked: dailyMetrics.length,
      },
    })
  } catch (error) {
    apiLogger.error('CPM graph data error', error)
    return NextResponse.json(
      { error: 'Failed to fetch graph data' },
      { status: 500 }
    )
  }
}
