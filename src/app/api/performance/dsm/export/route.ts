import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/performance/dsm/export
 * Exports Direct Sales Manager performance data as CSV
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

    const { searchParams } = new URL(request.url)
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))

    const { data: profile } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()

    const { data: targets } = await supabase
      .from('dsm_targets')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', month)
      .eq('year', year)
      .maybeSingle()

    const { data: dailyMetrics } = await supabase
      .from('dsm_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('metric_date', `${year}-${String(month).padStart(2, '0')}-01`)
      .lt('metric_date', `${year}-${String(month + 1).padStart(2, '0')}-01`)
      .order('metric_date', { ascending: true })

    if (!targets || !dailyMetrics) {
      return NextResponse.json({ success: false, error: 'No data found for export' }, { status: 404 })
    }

    const totalTeamRevenue = dailyMetrics.reduce((sum, d) => sum + (d.team_revenue_generated || 0), 0)
    const individualRevenue = dailyMetrics.reduce((sum, d) => sum + (d.individual_revenue_generated || 0), 0)
    const totalTeamLeads = dailyMetrics.reduce((sum, d) => sum + (d.team_leads_generated || 0), 0)

    const csvRows = [
      ['Direct Sales Manager Performance Report'],
      [`Employee: ${profile?.full_name || 'N/A'}`],
      [`Period: ${new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      ['Summary'],
      ['Metric', 'Target', 'Actual', 'Achievement %'],
      ['Team Revenue', targets.team_revenue_target, totalTeamRevenue, ((totalTeamRevenue / targets.team_revenue_target) * 100).toFixed(2)],
      ['Individual Revenue', targets.individual_revenue_target, individualRevenue, ((individualRevenue / targets.individual_revenue_target) * 100).toFixed(2)],
      ['Team Leads', targets.team_leads_target, totalTeamLeads, ((totalTeamLeads / targets.team_leads_target) * 100).toFixed(2)],
      [],
      ['Daily Breakdown'],
      ['Date', 'Team Revenue', 'Individual Revenue', 'Team Leads', 'Team Size'],
    ]

    dailyMetrics.forEach(metric => {
      csvRows.push([
        new Date(metric.metric_date).toLocaleDateString(),
        metric.team_revenue_generated || 0,
        metric.individual_revenue_generated || 0,
        metric.team_leads_generated || 0,
        metric.team_size || 0,
      ])
    })

    const csvContent = csvRows.map(row => row.join(',')).join('\n')

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="dsm-performance-${year}-${month}.csv"`,
      },
    })
  } catch (error) {
    apiLogger.error('DSM export error', error)
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    )
  }
}
