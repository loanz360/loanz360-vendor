import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/performance/bdm/history
 * Returns 6-month performance history for Business Development Manager
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

    const history = []
    const now = new Date()

    for (let i = 0; i < 6; i++) {
      const month = now.getMonth() + 1 - i
      const year = now.getFullYear()

      const adjustedMonth = month > 0 ? month : month + 12
      const adjustedYear = month > 0 ? year : year - 1

      const { data: targets } = await supabase
        .from('bdm_targets')
        .select('*')
        .eq('user_id', user.id)
        .eq('month', adjustedMonth)
        .eq('year', adjustedYear)
        .maybeSingle()

      const { data: dailyMetrics } = await supabase
        .from('bdm_daily_metrics')
        .select('*')
        .eq('user_id', user.id)
        .gte('metric_date', `${adjustedYear}-${String(adjustedMonth).padStart(2, '0')}-01`)
        .lt('metric_date', `${adjustedYear}-${String(adjustedMonth + 1).padStart(2, '0')}-01`)

      if (targets && dailyMetrics) {
        const totalRevenue = dailyMetrics.reduce((sum, d) => sum + (d.revenue_generated || 0), 0)
        const totalLeadsConverted = dailyMetrics.reduce((sum, d) => sum + (d.leads_converted || 0), 0)

        const revenueAchievement = targets.revenue_target > 0
          ? (totalRevenue / targets.revenue_target) * 100
          : 0

        history.push({
          month: adjustedMonth,
          year: adjustedYear,
          monthName: new Date(adjustedYear, adjustedMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          totalRevenue,
          targetRevenue: targets.revenue_target,
          revenueAchievement: Math.round(revenueAchievement),
          totalLeadsConverted,
          performanceScore: Math.round(revenueAchievement),
        })
      }
    }

    return NextResponse.json({ history })
  } catch (error) {
    apiLogger.error('BDM history error', error)
    return NextResponse.json(
      { error: 'Failed to fetch history' },
      { status: 500 }
    )
  }
}
