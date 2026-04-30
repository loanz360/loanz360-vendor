import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/performance/bdm/export
 * Exports Business Development Manager performance data as CSV
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
      .from('bdm_targets')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', month)
      .eq('year', year)
      .maybeSingle()

    const { data: dailyMetrics } = await supabase
      .from('bdm_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('metric_date', `${year}-${String(month).padStart(2, '0')}-01`)
      .lt('metric_date', `${year}-${String(month + 1).padStart(2, '0')}-01`)
      .order('metric_date', { ascending: true })

    if (!targets || !dailyMetrics) {
      return NextResponse.json({ success: false, error: 'No data found for export' }, { status: 404 })
    }

    const totalRevenue = dailyMetrics.reduce((sum, d) => sum + (d.revenue_generated || 0), 0)
    const totalLeadsConverted = dailyMetrics.reduce((sum, d) => sum + (d.leads_converted || 0), 0)
    const totalClients = dailyMetrics.reduce((sum, d) => sum + (d.new_clients_acquired || 0), 0)

    const csvRows = [
      ['Business Development Manager Performance Report'],
      [`Employee: ${profile?.full_name || 'N/A'}`],
      [`Period: ${new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      ['Summary'],
      ['Metric', 'Target', 'Actual', 'Achievement %'],
      ['Revenue', targets.revenue_target, totalRevenue, ((totalRevenue / targets.revenue_target) * 100).toFixed(2)],
      ['Leads Converted', targets.leads_converted_target, totalLeadsConverted, ((totalLeadsConverted / targets.leads_converted_target) * 100).toFixed(2)],
      ['New Clients', targets.new_clients_target, totalClients, ((totalClients / targets.new_clients_target) * 100).toFixed(2)],
      [],
      ['Daily Breakdown'],
      ['Date', 'Revenue', 'Leads Converted', 'New Clients', 'Meetings Held'],
    ]

    dailyMetrics.forEach(metric => {
      csvRows.push([
        new Date(metric.metric_date).toLocaleDateString(),
        metric.revenue_generated || 0,
        metric.leads_converted || 0,
        metric.new_clients_acquired || 0,
        metric.client_meetings_held || 0,
      ])
    })

    const csvContent = csvRows.map(row => row.join(',')).join('\n')

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="bdm-performance-${year}-${month}.csv"`,
      },
    })
  } catch (error) {
    apiLogger.error('BDM export error', error)
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    )
  }
}
