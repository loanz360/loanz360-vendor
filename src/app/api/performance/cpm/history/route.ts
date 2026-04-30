import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/performance/cpm/history
 * Returns 6-month performance history for Channel Partner Manager
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

    const history: unknown[] = []
    const now = new Date()

    // Try to fetch history data - handle gracefully if tables don't exist
    try {
      for (let i = 0; i < 6; i++) {
        const month = now.getMonth() + 1 - i
        const year = now.getFullYear()

        const adjustedMonth = month > 0 ? month : month + 12
        const adjustedYear = month > 0 ? year : year - 1

        let targets = null
        let dailyMetrics: unknown[] = []

        try {
          const { data, error } = await supabase
            .from('cpm_targets')
            .select('*')
            .eq('user_id', user.id)
            .eq('month', adjustedMonth)
            .eq('year', adjustedYear)
            .maybeSingle()

          if (!error) targets = data
        } catch (e) {
          // Table doesn't exist
        }

        try {
          const { data, error } = await supabase
            .from('cpm_daily_metrics')
            .select('*')
            .eq('user_id', user.id)
            .gte('metric_date', `${adjustedYear}-${String(adjustedMonth).padStart(2, '0')}-01`)
            .lt('metric_date', `${adjustedYear}-${String(adjustedMonth + 1).padStart(2, '0')}-01`)

          if (!error && data) dailyMetrics = data
        } catch (e) {
          // Table doesn't exist
        }

        // Only add to history if we have data for this month
        if (dailyMetrics.length > 0) {
          const defaultTargets = { partner_revenue_target: 3000000 }
          const effectiveTargets = targets || defaultTargets

          const totalRevenue = dailyMetrics.reduce((sum, d) => sum + (d.partner_revenue_generated || 0), 0)
          const totalNewPartners = dailyMetrics.reduce((sum, d) => sum + (d.new_partners_onboarded || 0), 0)

          const revenueAchievement = effectiveTargets.partner_revenue_target > 0
            ? (totalRevenue / effectiveTargets.partner_revenue_target) * 100
            : 0

          history.push({
            month: adjustedMonth,
            year: adjustedYear,
            monthName: new Date(adjustedYear, adjustedMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            totalRevenue,
            targetRevenue: effectiveTargets.partner_revenue_target,
            revenueAchievement: Math.round(revenueAchievement),
            totalNewPartners,
            performanceScore: Math.round(revenueAchievement),
          })
        }
      }
    } catch (e) {
    }

    return NextResponse.json({ history })
  } catch (error) {
    apiLogger.error('CPM history error', error)
    return NextResponse.json(
      { error: 'Failed to fetch history' },
      { status: 500 }
    )
  }
}
