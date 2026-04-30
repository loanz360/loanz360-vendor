import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


/**
 * POST /api/performance/tele-sales/export
 * Exports performance data in various formats (CSV, Excel)
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

    const { data: profile } = await supabase
      .from('users')
      .select('sub_role, full_name, employee_id')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || profile.sub_role !== 'TELE_SALES') {
      return NextResponse.json(
        { error: 'Access denied. This endpoint is for Tele Sales employees only.' },
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

    const targetMonth = month || new Date().getMonth() + 1
    const targetYear = year || new Date().getFullYear()

    // Fetch data for export
    const firstDayOfMonth = new Date(targetYear, targetMonth - 1, 1)
    const lastDayOfMonth = new Date(targetYear, targetMonth, 0)

    const { data: dailyMetrics } = await supabase
      .from('tele_sales_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('metric_date', firstDayOfMonth.toISOString().split('T')[0])
      .lte('metric_date', lastDayOfMonth.toISOString().split('T')[0])
      .order('metric_date', { ascending: true })

    const { data: targets } = await supabase
      .from('tele_sales_targets')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', targetMonth)
      .eq('year', targetYear)
      .maybeSingle()

    const { data: summary } = await supabase
      .from('tele_sales_monthly_summary')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', targetMonth)
      .eq('year', targetYear)
      .maybeSingle()

    // Generate CSV content
    const csvContent = generateCSV(
      profile,
      dailyMetrics || [],
      targets,
      summary,
      targetMonth,
      targetYear
    )

    // Create response with CSV file
    const fileName = `tele-sales-performance-${profile.employee_id || user.id.slice(0, 8)}-${targetYear}-${String(targetMonth).padStart(2, '0')}.csv`

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error: unknown) {
    apiLogger.error('Error in Tele Sales export API', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function generateCSV(
  profile: unknown,
  dailyMetrics: unknown[],
  targets: unknown,
  summary: unknown,
  month: number,
  year: number
): string {
  const monthName = new Date(year, month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  let csv = ''

  // Header section
  csv += 'TELE SALES PERFORMANCE REPORT\n'
  csv += `Generated: ${new Date().toLocaleString('en-IN')}\n`
  csv += `Employee: ${profile.full_name}\n`
  csv += `Employee ID: ${profile.employee_id || 'N/A'}\n`
  csv += `Period: ${monthName}\n`
  csv += '\n'

  // Summary section
  csv += 'PERFORMANCE SUMMARY\n'
  csv += 'Metric,Value,Target,Achievement %\n'

  if (summary) {
    csv += `Overall Score,${summary.performance_score || 0},100,${summary.performance_score || 0}%\n`
    csv += `Grade,${summary.performance_grade || 'N/A'},-,-\n`
    csv += `Company Rank,#${summary.company_rank || 'N/A'},${summary.total_employees || 'N/A'},-\n`
    csv += `Total Revenue,${summary.total_revenue || 0},${targets?.revenueTarget || 1500000},${targets?.revenueTarget ? ((summary.total_revenue || 0) / targets.revenueTarget * 100).toFixed(1) : 0}%\n`
    csv += `Total Calls,${summary.total_calls || 0},${targets?.totalCallsTarget || 500},${targets?.totalCallsTarget ? ((summary.total_calls || 0) / targets.totalCallsTarget * 100).toFixed(1) : 0}%\n`
    csv += `Leads Converted,${summary.leads_converted || 0},${targets?.leadsConvertedTarget || 25},${targets?.leadsConvertedTarget ? ((summary.leads_converted || 0) / targets.leadsConvertedTarget * 100).toFixed(1) : 0}%\n`
    csv += `Conversion Rate,${(summary.conversion_rate || 0).toFixed(1)}%,31%,${((summary.conversion_rate || 0) / 31 * 100).toFixed(1)}%\n`
    csv += `Avg Call Quality,${(summary.avg_call_quality_score || 0).toFixed(1)}%,${targets?.callQualityScoreTarget || 85}%,${targets?.callQualityScoreTarget ? ((summary.avg_call_quality_score || 0) / targets.callQualityScoreTarget * 100).toFixed(1) : 0}%\n`
    csv += `Customer Satisfaction,${(summary.avg_customer_satisfaction || 0).toFixed(1)}/5,${targets?.customerSatisfactionTarget || 4.2}/5,${targets?.customerSatisfactionTarget ? ((summary.avg_customer_satisfaction || 0) / targets.customerSatisfactionTarget * 100).toFixed(1) : 0}%\n`
  } else {
    csv += 'No summary data available for this period\n'
  }

  csv += '\n'

  // Daily metrics section
  csv += 'DAILY METRICS\n'
  csv += 'Date,Outbound Calls,Inbound Calls,Total Calls,Talk Time (min),Leads Generated,Leads Qualified,Leads Converted,Revenue,Applications,Disbursements,Call Quality,CSAT,Handle Time (sec)\n'

  if (dailyMetrics.length > 0) {
    dailyMetrics.forEach((metric) => {
      csv += `${metric.metric_date},`
      csv += `${metric.outbound_calls_made || 0},`
      csv += `${metric.inbound_calls_received || 0},`
      csv += `${metric.total_calls || 0},`
      csv += `${metric.total_talk_time_minutes || 0},`
      csv += `${metric.leads_generated || 0},`
      csv += `${metric.leads_qualified || 0},`
      csv += `${metric.leads_converted || 0},`
      csv += `${metric.revenue_generated || 0},`
      csv += `${metric.applications_completed || 0},`
      csv += `${metric.loan_disbursements || 0},`
      csv += `${metric.call_quality_score || 0},`
      csv += `${metric.customer_satisfaction_score || 0},`
      csv += `${metric.average_handle_time || 0}\n`
    })

    // Add totals row
    const totals = dailyMetrics.reduce(
      (acc, m) => ({
        outbound: acc.outbound + (m.outbound_calls_made || 0),
        inbound: acc.inbound + (m.inbound_calls_received || 0),
        total: acc.total + (m.total_calls || 0),
        talkTime: acc.talkTime + (m.total_talk_time_minutes || 0),
        leadsGen: acc.leadsGen + (m.leads_generated || 0),
        leadsQual: acc.leadsQual + (m.leads_qualified || 0),
        leadsConv: acc.leadsConv + (m.leads_converted || 0),
        revenue: acc.revenue + (m.revenue_generated || 0),
        apps: acc.apps + (m.applications_completed || 0),
        disbursements: acc.disbursements + (m.loan_disbursements || 0),
      }),
      { outbound: 0, inbound: 0, total: 0, talkTime: 0, leadsGen: 0, leadsQual: 0, leadsConv: 0, revenue: 0, apps: 0, disbursements: 0 }
    )

    csv += `TOTAL,${totals.outbound},${totals.inbound},${totals.total},${totals.talkTime},${totals.leadsGen},${totals.leadsQual},${totals.leadsConv},${totals.revenue},${totals.apps},${totals.disbursements},-,-,-\n`
  } else {
    csv += 'No daily metrics available for this period\n'
  }

  csv += '\n'

  // Targets section
  csv += 'MONTHLY TARGETS\n'
  csv += 'Metric,Target Value\n'

  if (targets) {
    csv += `Outbound Calls,${targets.outbound_calls_target || targets.outboundCallsTarget || 400}\n`
    csv += `Inbound Calls,${targets.inbound_calls_target || targets.inboundCallsTarget || 100}\n`
    csv += `Total Calls,${targets.total_calls_target || targets.totalCallsTarget || 500}\n`
    csv += `Talk Time (min),${targets.talk_time_target || targets.talkTimeTarget || 1800}\n`
    csv += `Leads Generated,${targets.leads_generated_target || targets.leadsGeneratedTarget || 80}\n`
    csv += `Leads Qualified,${targets.leads_qualified_target || targets.leadsQualifiedTarget || 50}\n`
    csv += `Leads Converted,${targets.leads_converted_target || targets.leadsConvertedTarget || 25}\n`
    csv += `Revenue (INR),${targets.revenue_target || targets.revenueTarget || 1500000}\n`
    csv += `Applications Completed,${targets.applications_completed_target || targets.applicationsCompletedTarget || 30}\n`
    csv += `Loan Disbursements,${targets.loan_disbursements_target || targets.loanDisbursementsTarget || 20}\n`
    csv += `Call Quality Score (%),${targets.call_quality_score_target || targets.callQualityScoreTarget || 85}\n`
    csv += `Customer Satisfaction (/5),${targets.customer_satisfaction_target || targets.customerSatisfactionTarget || 4.2}\n`
    csv += `First Call Resolution (%),${targets.first_call_resolution_target || targets.firstCallResolutionTarget || 75}\n`
    csv += `Avg Handle Time (sec),${targets.average_handle_time_target || targets.averageHandleTimeTarget || 300}\n`
    csv += `Callback Completion (%),${targets.callback_completion_target || targets.callbackCompletionTarget || 90}\n`
  } else {
    csv += 'Default targets applied (no custom targets set)\n'
  }

  csv += '\n'
  csv += 'END OF REPORT\n'

  return csv
}
