import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, full_name, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'User profile not found' }, { status: 404 })
    }

    if (profile.sub_role !== 'TELE_SALES') {
      return NextResponse.json(
        { error: 'Access denied. This endpoint is for Sales Agents only.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { month, year, format = 'csv' } = body

    if (!month || !year) {
      return NextResponse.json({ success: false, error: 'Month and year are required' }, { status: 400 })
    }

    const { data: summary, error: summaryError } = await supabase
      .from('sales_agent_monthly_summary')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', month)
      .eq('year', year)
      .maybeSingle()

    if (summaryError) {
      apiLogger.error('Error fetching monthly summary', summaryError)
      return NextResponse.json(
        { error: 'No performance data found for the specified period' },
        { status: 404 }
      )
    }

    const firstDayOfMonth = new Date(year, month - 1, 1)
    const lastDayOfMonth = new Date(year, month, 0)

    const { data: dailyMetrics, error: metricsError } = await supabase
      .from('sales_agent_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('metric_date', firstDayOfMonth.toISOString().split('T')[0])
      .lte('metric_date', lastDayOfMonth.toISOString().split('T')[0])
      .order('metric_date', { ascending: true })

    if (metricsError) {
      apiLogger.error('Error fetching daily metrics', metricsError)
    }

    const { data: targets } = await supabase
      .from('sales_agent_targets')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', month)
      .eq('year', year)
      .maybeSingle()

    const csvData = generateCSV(profile.full_name, summary, dailyMetrics || [], targets, month, year)

    return new NextResponse(csvData, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="sales-agent-performance-${year}-${month.toString().padStart(2, '0')}.csv"`,
      },
    })
  } catch (error: unknown) {
    apiLogger.error('Error in Sales Agent export API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

function generateCSV(
  userName: string,
  summary: any,
  dailyMetrics: any[],
  targets: any,
  month: number,
  year: number
): string {
  const monthName = new Date(year, month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  let csv = `Sales Agent Performance Report\n`
  csv += `Employee: ${userName}\n`
  csv += `Period: ${monthName}\n`
  csv += `\n`

  csv += `MONTHLY SUMMARY\n`
  csv += `Metric,Value,Target,Achievement %\n`
  csv += `Performance Score,${summary.performance_score || 0},100,${summary.performance_score || 0}%\n`
  csv += `Grade,${summary.performance_grade || 'N/A'},-,-\n`
  csv += `Company Rank,${summary.company_rank || 0} / ${summary.total_employees || 0},-,-\n`
  csv += `Percentile,${(summary.percentile || 0).toFixed(1)}th,-,-\n`
  csv += `\n`

  csv += `KEY METRICS\n`
  csv += `Metric,Actual,Target,Achievement %\n`
  csv += `Total Revenue,₹${(summary.total_revenue || 0).toLocaleString('en-IN')},₹${(targets?.revenue_target || 0).toLocaleString('en-IN')},${((summary.total_revenue || 0) / (targets?.revenue_target || 1) * 100).toFixed(1)}%\n`
  csv += `Calls Made,${summary.total_calls || 0},${targets?.calls_target || 0},${((summary.total_calls || 0) / (targets?.calls_target || 1) * 100).toFixed(1)}%\n`
  csv += `Leads Qualified,${summary.total_leads_qualified || 0},${targets?.leads_qualified_target || 0},${((summary.total_leads_qualified || 0) / (targets?.leads_qualified_target || 1) * 100).toFixed(1)}%\n`
  csv += `Appointments Set,${summary.total_appointments_set || 0},${targets?.appointments_set_target || 0},${((summary.total_appointments_set || 0) / (targets?.appointments_set_target || 1) * 100).toFixed(1)}%\n`
  csv += `Appointments Attended,${summary.total_appointments_attended || 0},${targets?.appointments_attended_target || 0},${((summary.total_appointments_attended || 0) / (targets?.appointments_attended_target || 1) * 100).toFixed(1)}%\n`
  csv += `Conversion Rate,${(summary.conversion_rate || 0).toFixed(1)}%,${(targets?.conversion_rate_target || 0).toFixed(1)}%,${((summary.conversion_rate || 0) / (targets?.conversion_rate_target || 1) * 100).toFixed(1)}%\n`
  csv += `\n`

  csv += `DAILY METRICS\n`
  csv += `Date,Calls,Call Duration,Leads Qualified,Appointments Set,Appointments Attended,Revenue,Deals,Follow-ups,Satisfaction\n`

  dailyMetrics.forEach(m => {
    const date = new Date(m.metric_date).toLocaleDateString('en-IN')
    csv += `${date},${m.calls_made || 0},${m.total_call_duration || 0},${m.leads_qualified || 0},${m.appointments_set || 0},${m.appointments_attended || 0},${m.revenue_generated || 0},${m.deals_closed_count || 0},${m.follow_ups_completed || 0},${(m.customer_satisfaction_score || 0).toFixed(1)}\n`
  })

  csv += `\n`
  csv += `Report Generated: ${new Date().toLocaleString('en-IN')}\n`
  csv += `Generated by: Loanz360 Performance System\n`

  return csv
}
