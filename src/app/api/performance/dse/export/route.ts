import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


/**
 * POST /api/performance/dse/export
 * Exports performance data in CSV or Excel format
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, full_name, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    // Verify user is a DSE
    if (profile.sub_role !== 'DIRECT_SALES_EXECUTIVE') {
      return NextResponse.json(
        { error: 'Access denied. This endpoint is for Direct Sales Executives only.' },
        { status: 403 }
      )
    }

    const bodySchema = z.object({


      month: z.number().optional(),


      year: z.number().optional(),


      format: z.string().optional().default('csv'),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { month, year, format = 'csv' } = body

    if (!month || !year) {
      return NextResponse.json(
        { error: 'Month and year are required' },
        { status: 400 }
      )
    }

    if (month < 1 || month > 12 || year < 2020 || year > 2100) {
      return NextResponse.json(
        { error: 'Invalid month or year' },
        { status: 400 }
      )
    }

    // Fetch monthly summary - try user_id first (old schema), then dse_user_id (new schema)
    let summary: unknown = null
    const { data: s1, error: s1Error } = await supabase
      .from('dse_monthly_summary')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', month)
      .eq('year', year)
      .maybeSingle()

    if (!s1Error && s1) {
      summary = s1
    } else {
      const { data: s2 } = await supabase
        .from('dse_monthly_summary')
        .select('*')
        .eq('dse_user_id', user.id)
        .eq('month', month)
        .eq('year', year)
        .maybeSingle()
      summary = s2
    }

    if (!summary) {
      return NextResponse.json(
        { error: 'No performance data found for the specified period' },
        { status: 404 }
      )
    }

    // Fetch daily metrics for the month
    const firstDayOfMonth = new Date(year, month - 1, 1)
    const lastDayOfMonth = new Date(year, month, 0)

    const { data: dailyMetrics, error: metricsError } = await supabase
      .from('dse_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('metric_date', firstDayOfMonth.toISOString().split('T')[0])
      .lte('metric_date', lastDayOfMonth.toISOString().split('T')[0])
      .order('metric_date', { ascending: true })

    if (metricsError) {
      apiLogger.error('Error fetching daily metrics', metricsError)
    }

    // Fetch targets
    const { data: targets } = await supabase
      .from('dse_targets')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', month)
      .eq('year', year)
      .maybeSingle()

    // Generate CSV
    const csvData = generateCSV(profile.full_name, summary, dailyMetrics || [], targets, month, year)

    return new NextResponse(csvData, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="dse-performance-${year}-${month.toString().padStart(2, '0')}.csv"`,
      },
    })
  } catch (error: unknown) {
    apiLogger.error('Error in DSE export API', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function generateCSV(
  userName: string,
  summary: unknown,
  dailyMetrics: unknown[],
  targets: unknown,
  month: number,
  year: number
): string {
  const monthName = new Date(year, month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  let csv = `DSE Performance Report\n`
  csv += `Employee: ${userName}\n`
  csv += `Period: ${monthName}\n`
  csv += `\n`

  // Monthly Summary
  csv += `MONTHLY SUMMARY\n`
  csv += `Metric,Value,Target,Achievement %\n`
  csv += `Performance Score,${summary.performance_score || 0},100,${summary.performance_score || 0}%\n`
  csv += `Grade,${summary.performance_grade || 'N/A'},-,-\n`
  csv += `Company Rank,${summary.company_rank || 0} / ${summary.total_employees || 0},-,-\n`
  csv += `Percentile,${(summary.percentile || 0).toFixed(1)}th,-,-\n`
  csv += `\n`

  // Normalize column names across old/new schema
  const totalRevenue = summary.total_revenue || summary.total_converted_revenue || 0
  const totalConversions = summary.total_conversions || summary.leads_converted || 0
  const totalVisits = summary.total_field_visits || summary.total_visits || 0
  const totalMeetings = summary.total_meetings_attended || summary.total_meetings || 0
  const totalLeads = summary.total_leads_generated || summary.leads_generated || 0
  const conversionRate = summary.field_conversion_rate || summary.conversion_rate || 0

  // Key Metrics
  csv += `KEY METRICS\n`
  csv += `Metric,Actual,Target,Achievement %\n`
  csv += `Total Revenue,₹${totalRevenue.toLocaleString('en-IN')},₹${(targets?.revenue_target || 0).toLocaleString('en-IN')},${(totalRevenue / (targets?.revenue_target || 1) * 100).toFixed(1)}%\n`
  csv += `Conversions,${totalConversions},${targets?.leads_converted_target || 0},${(totalConversions / (targets?.leads_converted_target || 1) * 100).toFixed(1)}%\n`
  csv += `Field Visits,${totalVisits},${targets?.field_visits_target || 0},${(totalVisits / (targets?.field_visits_target || 1) * 100).toFixed(1)}%\n`
  csv += `Meetings Attended,${totalMeetings},${targets?.meetings_attended_target || 0},${(totalMeetings / (targets?.meetings_attended_target || 1) * 100).toFixed(1)}%\n`
  csv += `Leads Generated,${totalLeads},${targets?.leads_generated_target || 0},${(totalLeads / (targets?.leads_generated_target || 1) * 100).toFixed(1)}%\n`
  csv += `Conversion Rate,${conversionRate.toFixed(1)}%,${(targets?.field_conversion_rate_target || 0).toFixed(1)}%,${(conversionRate / (targets?.field_conversion_rate_target || 1) * 100).toFixed(1)}%\n`
  csv += `Average Deal Size,₹${(summary.average_deal_size || 0).toLocaleString('en-IN')},₹${(targets?.average_deal_size_target || 0).toLocaleString('en-IN')},${((summary.average_deal_size || 0) / (targets?.average_deal_size_target || 1) * 100).toFixed(1)}%\n`
  csv += `Territory Coverage,${(summary.territory_coverage_percentage || 0).toFixed(1)}%,${(targets?.territory_coverage_target || 0).toFixed(1)}%,${((summary.territory_coverage_percentage || 0) / (targets?.territory_coverage_target || 1) * 100).toFixed(1)}%\n`
  csv += `\n`

  // Daily Metrics
  csv += `DAILY METRICS\n`
  csv += `Date,Field Visits,Meetings Scheduled,Meetings Attended,Travel (km),Leads Generated,Leads Converted,Revenue,Deals Count,Territory Coverage %,Customer Demos,Referrals\n`

  dailyMetrics.forEach(m => {
    const date = new Date(m.metric_date).toLocaleDateString('en-IN')
    csv += `${date},${m.field_visits_completed || 0},${m.meetings_scheduled || 0},${m.meetings_attended || 0},${m.travel_distance_km || 0},${m.leads_generated || 0},${m.leads_converted || 0},${m.revenue_generated || 0},${m.deals_closed_count || 0},${(m.territory_coverage || 0).toFixed(1)},${m.customer_demos || 0},${m.customer_referrals || 0}\n`
  })

  csv += `\n`
  csv += `Report Generated: ${new Date().toLocaleString('en-IN')}\n`
  csv += `Generated by: Loanz360 Performance System\n`

  return csv
}
