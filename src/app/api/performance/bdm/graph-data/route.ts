import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/performance/bdm/graph-data
 * Returns 30-day performance graph data for Business Development Manager
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

    const { data: dailyMetrics } = await supabase
      .from('bdm_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('metric_date', startDate.toISOString().split('T')[0])
      .lte('metric_date', endDate.toISOString().split('T')[0])
      .order('metric_date', { ascending: true })

    if (!dailyMetrics) {
      return NextResponse.json({ graphData: [] })
    }

    const graphData = dailyMetrics.map(metric => ({
      date: new Date(metric.metric_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      revenue: metric.revenue_generated || 0,
      leadsConverted: metric.leads_converted || 0,
      clientsAcquired: metric.new_clients_acquired || 0,
      meetingsHeld: metric.client_meetings_held || 0,
    }))

    const cumulativeData = graphData.reduce((acc, curr, index) => {
      const prevRevenue = index > 0 ? acc[index - 1].cumulativeRevenue : 0
      const prevLeads = index > 0 ? acc[index - 1].cumulativeLeads : 0

      acc.push({
        ...curr,
        cumulativeRevenue: prevRevenue + curr.revenue,
        cumulativeLeads: prevLeads + curr.leadsConverted,
      })

      return acc
    }, [] as unknown[])

    return NextResponse.json({
      graphData: cumulativeData,
      summary: {
        totalRevenue: dailyMetrics.reduce((sum, d) => sum + (d.revenue_generated || 0), 0),
        totalLeadsConverted: dailyMetrics.reduce((sum, d) => sum + (d.leads_converted || 0), 0),
        totalClientsAcquired: dailyMetrics.reduce((sum, d) => sum + (d.new_clients_acquired || 0), 0),
        totalMeetings: dailyMetrics.reduce((sum, d) => sum + (d.client_meetings_held || 0), 0),
        daysTracked: dailyMetrics.length,
      },
    })
  } catch (error) {
    apiLogger.error('BDM graph data error', error)
    return NextResponse.json(
      { error: 'Failed to fetch graph data' },
      { status: 500 }
    )
  }
}
