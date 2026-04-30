import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/performance/dsm/graph-data
 * Returns 30-day performance graph data for Direct Sales Manager
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
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
      .from('dsm_daily_metrics')
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
      teamRevenue: metric.team_revenue_generated || 0,
      individualRevenue: metric.individual_revenue_generated || 0,
      teamLeads: metric.team_leads_generated || 0,
      teamSize: metric.team_size || 0,
    }))

    const cumulativeData = graphData.reduce((acc, curr, index) => {
      const prevTeamRevenue = index > 0 ? acc[index - 1].cumulativeTeamRevenue : 0
      const prevIndividualRevenue = index > 0 ? acc[index - 1].cumulativeIndividualRevenue : 0

      acc.push({
        ...curr,
        cumulativeTeamRevenue: prevTeamRevenue + curr.teamRevenue,
        cumulativeIndividualRevenue: prevIndividualRevenue + curr.individualRevenue,
      })

      return acc
    }, [] as unknown[])

    return NextResponse.json({
      graphData: cumulativeData,
      summary: {
        totalTeamRevenue: dailyMetrics.reduce((sum, d) => sum + (d.team_revenue_generated || 0), 0),
        totalIndividualRevenue: dailyMetrics.reduce((sum, d) => sum + (d.individual_revenue_generated || 0), 0),
        totalTeamLeads: dailyMetrics.reduce((sum, d) => sum + (d.team_leads_generated || 0), 0),
        daysTracked: dailyMetrics.length,
      },
    })
  } catch (error) {
    apiLogger.error('DSM graph data error', error)
    return NextResponse.json(
      { error: 'Failed to fetch graph data' },
      { status: 500 }
    )
  }
}
