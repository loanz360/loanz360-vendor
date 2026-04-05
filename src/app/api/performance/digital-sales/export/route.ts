import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/performance/digital-sales/export
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

    // Verify user is Digital Sales
    if (profile.sub_role !== 'DIGITAL_SALES') {
      return NextResponse.json(
        { error: 'Access denied. This endpoint is for Digital Sales only.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { month, year, format = 'csv' } = body

    if (!month || !year) {
      return NextResponse.json(
        { error: 'Month and year are required' },
        { status: 400 }
      )
    }

    // Fetch monthly summary
    const { data: summary, error: summaryError } = await supabase
      .from('digital_sales_monthly_summary')
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

    // Fetch daily metrics for the month
    const firstDayOfMonth = new Date(year, month - 1, 1)
    const lastDayOfMonth = new Date(year, month, 0)

    const { data: dailyMetrics, error: metricsError } = await supabase
      .from('digital_sales_daily_metrics')
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
      .from('digital_sales_targets')
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
        'Content-Disposition': `attachment; filename="digital-sales-performance-${year}-${month.toString().padStart(2, '0')}.csv"`,
      },
    })
  } catch (error: unknown) {
    apiLogger.error('Error in Digital Sales export API', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
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

  let csv = `Digital Sales Performance Report\n`
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

  // Key Metrics
  csv += `KEY METRICS\n`
  csv += `Metric,Actual,Target,Achievement %\n`
  csv += `Total Revenue,₹${(summary.total_revenue || 0).toLocaleString('en-IN')},₹${(targets?.revenue_target || 0).toLocaleString('en-IN')},${((summary.total_revenue || 0) / (targets?.revenue_target || 1) * 100).toFixed(1)}%\n`
  csv += `Conversions,${summary.total_conversions || 0},${targets?.leads_converted_target || 0},${((summary.total_conversions || 0) / (targets?.leads_converted_target || 1) * 100).toFixed(1)}%\n`
  csv += `Website Leads,${summary.total_website_leads || 0},${targets?.website_leads_target || 0},${((summary.total_website_leads || 0) / (targets?.website_leads_target || 1) * 100).toFixed(1)}%\n`
  csv += `Social Media Leads,${summary.total_social_media_leads || 0},${targets?.social_media_leads_target || 0},${((summary.total_social_media_leads || 0) / (targets?.social_media_leads_target || 1) * 100).toFixed(1)}%\n`
  csv += `Email Campaign Leads,${summary.total_email_campaign_leads || 0},${targets?.email_campaign_leads_target || 0},${((summary.total_email_campaign_leads || 0) / (targets?.email_campaign_leads_target || 1) * 100).toFixed(1)}%\n`
  csv += `Total Digital Leads,${summary.total_digital_leads || 0},${targets?.total_digital_leads_target || 0},${((summary.total_digital_leads || 0) / (targets?.total_digital_leads_target || 1) * 100).toFixed(1)}%\n`
  csv += `Conversion Rate,${(summary.digital_conversion_rate || 0).toFixed(1)}%,${(targets?.digital_conversion_rate_target || 0).toFixed(1)}%,${((summary.digital_conversion_rate || 0) / (targets?.digital_conversion_rate_target || 1) * 100).toFixed(1)}%\n`
  csv += `Average Deal Size,₹${(summary.average_deal_size || 0).toLocaleString('en-IN')},₹${(targets?.average_deal_size_target || 0).toLocaleString('en-IN')},${((summary.average_deal_size || 0) / (targets?.average_deal_size_target || 1) * 100).toFixed(1)}%\n`
  csv += `Campaigns Launched,${summary.total_campaigns_launched || 0},${targets?.campaigns_launched_target || 0},${((summary.total_campaigns_launched || 0) / (targets?.campaigns_launched_target || 1) * 100).toFixed(1)}%\n`
  csv += `Email Open Rate,${(summary.average_email_open_rate || 0).toFixed(1)}%,${(targets?.email_open_rate_target || 0).toFixed(1)}%,${((summary.average_email_open_rate || 0) / (targets?.email_open_rate_target || 1) * 100).toFixed(1)}%\n`
  csv += `\n`

  // Daily Metrics
  csv += `DAILY METRICS\n`
  csv += `Date,Website Leads,Social Media Leads,Email Leads,Total Digital Leads,Leads Converted,Revenue,Deals Count,Campaigns Launched,Email Open Rate %\n`

  dailyMetrics.forEach(m => {
    const date = new Date(m.metric_date).toLocaleDateString('en-IN')
    csv += `${date},${m.website_leads || 0},${m.social_media_leads || 0},${m.email_campaign_leads || 0},${m.total_digital_leads || 0},${m.leads_converted || 0},${m.revenue_generated || 0},${m.deals_closed_count || 0},${m.campaigns_launched || 0},${(m.email_open_rate || 0).toFixed(1)}\n`
  })

  csv += `\n`
  csv += `Report Generated: ${new Date().toLocaleString('en-IN')}\n`
  csv += `Generated by: Loanz360 Performance System\n`

  return csv
}
