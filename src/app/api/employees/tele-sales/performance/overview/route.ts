
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString())

    // Get current month's targets
    const { data: targets } = await supabase
      .from('tele_sales_targets')
      .select('*')
      .eq('user_id', user.id)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle()

    // Get today's metrics
    const today = new Date().toISOString().split('T')[0]
    const { data: todayMetrics } = await supabase
      .from('tele_sales_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .eq('metric_date', today)
      .maybeSingle()

    // Get this month's summary
    const { data: monthlySummary } = await supabase
      .from('tele_sales_monthly_summary')
      .select('*')
      .eq('user_id', user.id)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle()

    // Get gamification data
    const { data: gamification } = await supabase
      .from('tele_sales_gamification')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    // Calculate progress percentages
    const callsProgress = targets?.calls_target
      ? Math.round(((todayMetrics?.total_calls || 0) / targets.calls_target) * 100)
      : 0
    const conversionsProgress = targets?.conversions_target
      ? Math.round(((monthlySummary?.total_conversions || 0) / targets.conversions_target) * 100)
      : 0
    const revenueProgress = targets?.revenue_target
      ? Math.round(((monthlySummary?.total_revenue || 0) / targets.revenue_target) * 100)
      : 0

    return NextResponse.json({
      targets: targets || {
        calls_target: 50,
        conversions_target: 10,
        revenue_target: 500000,
        quality_target: 4.0
      },
      todayMetrics: todayMetrics || {
        total_calls: 0,
        connected_calls: 0,
        total_talk_time: 0,
        conversions: 0,
        callbacks_scheduled: 0,
        average_call_duration: 0
      },
      monthlySummary: monthlySummary || {
        total_calls: 0,
        total_conversions: 0,
        total_revenue: 0,
        performance_score: 0,
        performance_grade: 'N/A',
        company_rank: null
      },
      gamification: gamification || {
        total_points: 0,
        current_level: 1,
        current_rank: null,
        badges: [],
        current_streak: 0
      },
      progress: {
        calls: callsProgress,
        conversions: conversionsProgress,
        revenue: revenueProgress
      }
    })
  } catch (error) {
    apiLogger.error('Error fetching performance overview', error)
    return NextResponse.json(
      { error: 'Failed to fetch performance overview' },
      { status: 500 }
    )
  }
}
