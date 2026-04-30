import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import type { GamificationSummary, NextBadgeProgress } from '@/lib/types/dse-enhanced-performance.types'


/**
 * GET /api/performance/dse/badges
 * Returns gamification data: earned badges, total points, next achievements.
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    // Authenticate
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSE role
    const adminClient = createSupabaseAdmin()
    const { data: profile } = await adminClient
      .from('users')
      .select('sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || profile.sub_role !== 'DIRECT_SALES_EXECUTIVE') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Fetch all available badges
    const { data: allBadges } = await adminClient
      .from('dse_achievement_badges')
      .select('*')
      .eq('is_active', true)
      .order('points', { ascending: false })

    // Fetch user's earned badges
    const { data: userBadges } = await adminClient
      .from('dse_user_badges')
      .select('*, badge:dse_achievement_badges(*)')
      .eq('dse_user_id', user.id)
      .order('awarded_at', { ascending: false })

    // Fetch current month summary for progress calculations
    const now = new Date()
    let summary: unknown = null
    const { data: s1 } = await adminClient
      .from('dse_monthly_summary')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', now.getMonth() + 1)
      .eq('year', now.getFullYear())
      .maybeSingle()

    if (s1) {
      summary = s1
    } else {
      const { data: s2 } = await adminClient
        .from('dse_monthly_summary')
        .select('*')
        .eq('dse_user_id', user.id)
        .eq('month', now.getMonth() + 1)
        .eq('year', now.getFullYear())
        .maybeSingle()
      summary = s2
    }

    const badges = allBadges || []
    const earned = userBadges || []
    const earnedBadgeIds = new Set(earned.map((e: unknown) => e.badge_id))

    // Calculate total points
    const totalPoints = earned.reduce((sum: number, e: unknown) => sum + (e.badge?.points || 0), 0)

    // Calculate progress toward unearned badges
    const nextBadges: NextBadgeProgress[] = badges
      .filter((b: unknown) => !earnedBadgeIds.has(b.id))
      .map((badge: unknown) => {
        const criteria = badge.criteria || {}
        let currentProgress = 0
        let target = 100

        if (criteria.min_achievement && summary) {
          const achievement = summary.target_achievement_percentage ||
            ((summary.total_revenue || 0) / 800000) * 100
          currentProgress = achievement
          target = criteria.min_achievement
        } else if (criteria.min_revenue && summary) {
          currentProgress = summary.total_revenue || summary.total_converted_revenue || 0
          target = criteria.min_revenue
        } else if (criteria.max_rank && summary) {
          currentProgress = summary.company_rank ? (summary.total_employees - summary.company_rank) : 0
          target = summary.total_employees ? summary.total_employees - criteria.max_rank : 100
        } else if (criteria.min_conversion_rate && summary) {
          currentProgress = summary.field_conversion_rate || summary.conversion_rate || 0
          target = criteria.min_conversion_rate
        } else if (criteria.min_coverage && summary) {
          currentProgress = summary.territory_coverage_percentage || 0
          target = criteria.min_coverage
        }

        const progressPct = target > 0 ? Math.min((currentProgress / target) * 100, 100) : 0

        return {
          badge,
          current_progress: currentProgress,
          target,
          progress_pct: Number(progressPct.toFixed(1)),
          estimated_days_to_achieve: null,
        }
      })
      .sort((a: NextBadgeProgress, b: NextBadgeProgress) => b.progress_pct - a.progress_pct)
      .slice(0, 5) // Top 5 closest to achieving

    // Calculate rank by points (among all DSEs)
    const { data: allUserBadges } = await adminClient
      .from('dse_user_badges')
      .select('dse_user_id, badge:dse_achievement_badges(points)')

    const pointsByUser: Record<string, number> = {}
    ;(allUserBadges || []).forEach((ub: unknown) => {
      const uid = ub.dse_user_id
      pointsByUser[uid] = (pointsByUser[uid] || 0) + (ub.badge?.points || 0)
    })

    const sortedPoints = Object.entries(pointsByUser)
      .sort(([, a], [, b]) => b - a)
    const rankByPoints = sortedPoints.findIndex(([uid]) => uid === user.id) + 1

    const gamification: GamificationSummary = {
      total_points: totalPoints,
      badges_earned: earned.length,
      total_badges_available: badges.length,
      recent_badges: earned.slice(0, 5),
      next_achievable_badges: nextBadges,
      rank_by_points: rankByPoints || sortedPoints.length + 1,
    }

    return NextResponse.json({ gamification })
  } catch (error) {
    apiLogger.error('Error in badges API', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
