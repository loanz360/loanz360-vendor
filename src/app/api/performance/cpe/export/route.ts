import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/performance/cpe/export
 * Exports performance data in CSV format
 */
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

    if (profile.sub_role !== 'CHANNEL_PARTNER_EXECUTIVE') {
      return NextResponse.json(
        { error: 'Access denied. This endpoint is for Channel Partner Executives only.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { month, year, format = 'csv' } = body

    if (!month || !year) {
      return NextResponse.json({ success: false, error: 'Month and year are required' }, { status: 400 })
    }

    const { data: summary, error: summaryError } = await supabase
      .from('cpe_monthly_summary')
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
      .from('cpe_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('metric_date', firstDayOfMonth.toISOString().split('T')[0])
      .lte('metric_date', lastDayOfMonth.toISOString().split('T')[0])
      .order('metric_date', { ascending: true })

    if (metricsError) {
      apiLogger.error('Error fetching daily metrics', metricsError)
    }

    const { data: targets } = await supabase
      .from('cpe_targets')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', month)
      .eq('year', year)
      .maybeSingle()

    const csvData = generateCSV(profile.full_name, summary, dailyMetrics || [], targets, month, year)

    return new NextResponse(csvData, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="cpe-performance-${year}-${month.toString().padStart(2, '0')}.csv"`,
      },
    })
  } catch (error: unknown) {
    apiLogger.error('Error in CPE export API', error)
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

  let csv = `Channel Partner Executive Performance Report\n`
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
  csv += `Partner Revenue,₹${(summary.total_partner_revenue || 0).toLocaleString('en-IN')},₹${(targets?.partner_revenue_target || 0).toLocaleString('en-IN')},${((summary.total_partner_revenue || 0) / (targets?.partner_revenue_target || 1) * 100).toFixed(1)}%\n`
  csv += `Partners Onboarded,${summary.total_partners_onboarded || 0},${targets?.partners_onboarded_target || 0},${((summary.total_partners_onboarded || 0) / (targets?.partners_onboarded_target || 1) * 100).toFixed(1)}%\n`
  csv += `Active Partners,${summary.total_active_partners || 0},${targets?.active_partners_target || 0},${((summary.total_active_partners || 0) / (targets?.active_partners_target || 1) * 100).toFixed(1)}%\n`
  csv += `Partner Leads Generated,${summary.total_partner_leads_generated || 0},${targets?.partner_leads_generated_target || 0},${((summary.total_partner_leads_generated || 0) / (targets?.partner_leads_generated_target || 1) * 100).toFixed(1)}%\n`
  csv += `Partner Conversions,${summary.total_partner_leads_converted || 0},${targets?.partner_leads_converted_target || 0},${((summary.total_partner_leads_converted || 0) / (targets?.partner_leads_converted_target || 1) * 100).toFixed(1)}%\n`
  csv += `Conversion Rate,${(summary.partner_conversion_rate || 0).toFixed(1)}%,${(targets?.partner_conversion_rate_target || 0).toFixed(1)}%,${((summary.partner_conversion_rate || 0) / (targets?.partner_conversion_rate_target || 1) * 100).toFixed(1)}%\n`
  csv += `Network Size,${summary.partner_network_size || 0},${targets?.partner_network_size_target || 0},${((summary.partner_network_size || 0) / (targets?.partner_network_size_target || 1) * 100).toFixed(1)}%\n`
  csv += `Engagement Score,${(summary.average_partner_engagement_score || 0).toFixed(1)}%,${(targets?.partner_engagement_score_target || 0).toFixed(1)}%,${((summary.average_partner_engagement_score || 0) / (targets?.partner_engagement_score_target || 1) * 100).toFixed(1)}%\n`
  csv += `Commission Earned,₹${(summary.total_commission_earned || 0).toLocaleString('en-IN')},₹${(targets?.commission_earned_target || 0).toLocaleString('en-IN')},${((summary.total_commission_earned || 0) / (targets?.commission_earned_target || 1) * 100).toFixed(1)}%\n`
  csv += `\n`

  csv += `DAILY METRICS\n`
  csv += `Date,Partners Onboarded,Active Partners,Partner Revenue,Partner Leads,Partner Conversions,Network Size,Engagement Score,Commission,Training Sessions\n`

  dailyMetrics.forEach(m => {
    const date = new Date(m.metric_date).toLocaleDateString('en-IN')
    csv += `${date},${m.partners_onboarded || 0},${m.active_partners || 0},${m.partner_revenue || 0},${m.partner_leads_generated || 0},${m.partner_leads_converted || 0},${m.partner_network_size || 0},${(m.partner_engagement_score || 0).toFixed(1)},${m.commission_earned || 0},${m.partner_training_sessions || 0}\n`
  })

  csv += `\n`
  csv += `Report Generated: ${new Date().toLocaleString('en-IN')}\n`
  csv += `Generated by: Loanz360 Performance System\n`

  return csv
}
