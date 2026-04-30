import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/performance/cpm/export
 * Exports Channel Partner Manager performance data as CSV
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

    const { searchParams } = new URL(request.url)
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))

    const { data: profile } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()

    const { data: targets } = await supabase
      .from('cpm_targets')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', month)
      .eq('year', year)
      .maybeSingle()

    const { data: dailyMetrics } = await supabase
      .from('cpm_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('metric_date', `${year}-${String(month).padStart(2, '0')}-01`)
      .lt('metric_date', `${year}-${String(month + 1).padStart(2, '0')}-01`)
      .order('metric_date', { ascending: true })

    if (!targets || !dailyMetrics) {
      return NextResponse.json({ success: false, error: 'No data found for export' }, { status: 404 })
    }

    const totalRevenue = dailyMetrics.reduce((sum, d) => sum + (d.partner_revenue_generated || 0), 0)
    const totalNewPartners = dailyMetrics.reduce((sum, d) => sum + (d.new_partners_onboarded || 0), 0)
    const totalTraining = dailyMetrics.reduce((sum, d) => sum + (d.training_sessions_conducted || 0), 0)

    const csvRows = [
      ['Channel Partner Manager Performance Report'],
      [`Employee: ${profile?.full_name || 'N/A'}`],
      [`Period: ${new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      ['Summary'],
      ['Metric', 'Target', 'Actual', 'Achievement %'],
      ['Partner Revenue', targets.partner_revenue_target, totalRevenue, ((totalRevenue / targets.partner_revenue_target) * 100).toFixed(2)],
      ['New Partners Onboarded', targets.new_partners_onboarded_target, totalNewPartners, ((totalNewPartners / targets.new_partners_onboarded_target) * 100).toFixed(2)],
      ['Training Sessions', targets.partner_training_sessions_target, totalTraining, ((totalTraining / targets.partner_training_sessions_target) * 100).toFixed(2)],
      [],
      ['Daily Breakdown'],
      ['Date', 'Revenue', 'New Partners', 'Training Sessions', 'Active Partners'],
    ]

    dailyMetrics.forEach(metric => {
      csvRows.push([
        new Date(metric.metric_date).toLocaleDateString(),
        metric.partner_revenue_generated || 0,
        metric.new_partners_onboarded || 0,
        metric.training_sessions_conducted || 0,
        metric.active_partners_count || 0,
      ])
    })

    const csvContent = csvRows.map(row => row.join(',')).join('\n')

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="cpm-performance-${year}-${month}.csv"`,
      },
    })
  } catch (error) {
    apiLogger.error('CPM export error', error)
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    )
  }
}
