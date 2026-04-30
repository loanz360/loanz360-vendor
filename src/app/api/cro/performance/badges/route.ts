
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireCROAuth } from '@/lib/middleware/cro-auth'
import { apiLogger } from '@/lib/utils/logger'

/**
 * Badge definition with criteria for earning
 */
interface BadgeDefinition {
  id: string
  name: string
  description: string
  category: 'volume' | 'quality' | 'revenue' | 'streak' | 'special'
  icon: string
  criteria_metric: string
  criteria_threshold: number
  criteria_unit: string
  criteria_description: string
}

/**
 * Badge status returned to the client
 */
interface BadgeStatus {
  badge: BadgeDefinition
  status: 'earned' | 'in_progress' | 'locked'
  earned_at?: string
  progress_percentage: number
  current_value: number
}

/**
 * All badge definitions with their criteria
 */
const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'call_champion',
    name: 'Call Champion',
    description: '1,000+ calls in a single month',
    category: 'volume',
    icon: 'Phone',
    criteria_metric: 'calls_made',
    criteria_threshold: 1000,
    criteria_unit: 'calls',
    criteria_description: 'Make 1,000+ calls in a month',
  },
  {
    id: 'conversion_king',
    name: 'Conversion King',
    description: '30%+ conversion rate in a month',
    category: 'quality',
    icon: 'Crown',
    criteria_metric: 'conversion_rate',
    criteria_threshold: 30,
    criteria_unit: '%',
    criteria_description: 'Achieve 30%+ conversion rate',
  },
  {
    id: 'revenue_star',
    name: 'Revenue Star',
    description: 'Rs.10L+ revenue in a single month',
    category: 'revenue',
    icon: 'IndianRupee',
    criteria_metric: 'revenue_generated',
    criteria_threshold: 1000000,
    criteria_unit: '₹',
    criteria_description: 'Generate ₹10L+ revenue in a month',
  },
  {
    id: 'perfect_week',
    name: 'Perfect Week',
    description: '5 consecutive days meeting all targets',
    category: 'streak',
    icon: 'Calendar',
    criteria_metric: 'consecutive_target_days',
    criteria_threshold: 5,
    criteria_unit: 'days',
    criteria_description: 'Meet all daily targets for 5 consecutive days',
  },
  {
    id: 'top_performer',
    name: 'Top Performer',
    description: '#1 rank in the company for a month',
    category: 'special',
    icon: 'Trophy',
    criteria_metric: 'company_rank',
    criteria_threshold: 1,
    criteria_unit: 'rank',
    criteria_description: 'Achieve #1 company rank for a full month',
  },
  {
    id: 'speed_demon',
    name: 'Speed Demon',
    description: '<15 min avg response time for a month',
    category: 'quality',
    icon: 'Zap',
    criteria_metric: 'avg_response_time',
    criteria_threshold: 15,
    criteria_unit: 'min',
    criteria_description: 'Maintain <15 min average response time',
  },
  {
    id: 'followup_master',
    name: 'Follow-up Master',
    description: '95%+ follow-up completion rate',
    category: 'quality',
    icon: 'CheckCircle',
    criteria_metric: 'followup_completion_rate',
    criteria_threshold: 95,
    criteria_unit: '%',
    criteria_description: 'Complete 95%+ of follow-ups in a month',
  },
  {
    id: 'rising_star',
    name: 'Rising Star',
    description: '3 consecutive months of improvement',
    category: 'special',
    icon: 'TrendingUp',
    criteria_metric: 'consecutive_improvement_months',
    criteria_threshold: 3,
    criteria_unit: 'months',
    criteria_description: 'Improve performance for 3 consecutive months',
  },
  {
    id: 'deal_closer',
    name: 'Deal Closer',
    description: '20+ cases disbursed in a single month',
    category: 'volume',
    icon: 'Handshake',
    criteria_metric: 'cases_disbursed',
    criteria_threshold: 20,
    criteria_unit: 'cases',
    criteria_description: 'Get 20+ cases disbursed in a month',
  },
  {
    id: 'customer_favorite',
    name: 'Customer Favorite',
    description: '4.5+/5 satisfaction score for a month',
    category: 'quality',
    icon: 'Heart',
    criteria_metric: 'customer_satisfaction',
    criteria_threshold: 4.5,
    criteria_unit: '/5',
    criteria_description: 'Achieve 4.5+ customer satisfaction score',
  },
]

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireCROAuth(request)
    if ('response' in authResult) return authResult.response
    const { user } = authResult

    const supabase = await createClient()

    // Try to fetch earned badges from cro_achievement_badges table
    let earnedBadges: Array<{ badge_id: string; earned_at: string }> = []

    try {
      const { data, error } = await supabase
        .from('cro_achievement_badges')
        .select('badge_id, earned_at')
        .eq('cro_id', user.id)

      if (!error && data) {
        earnedBadges = data
      }
      // If error (e.g. table doesn't exist), just continue with empty array
    } catch {
      // Table doesn't exist - gracefully continue
    }

    const earnedBadgeMap = new Map(
      earnedBadges.map(b => [b.badge_id, b.earned_at])
    )

    // Get current month metrics to calculate progress
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0]
    const today = now.toISOString().split('T')[0]

    const { data: dailyMetrics } = await supabase
      .from('cro_daily_metrics')
      .select('*')
      .eq('cro_id', user.id)
      .gte('date', startOfMonth)
      .lte('date', today)
      .order('date', { ascending: true })

    const metrics = dailyMetrics || []

    // Calculate current performance values for progress tracking
    const currentValues = calculateCurrentValues(metrics)

    // Get previous months for Rising Star check
    let consecutiveImprovementMonths = 0
    try {
      const { data: monthlySummaries } = await supabase
        .from('cro_monthly_summary')
        .select('month, performance_score')
        .eq('cro_id', user.id)
        .order('month', { ascending: false })
        .limit(4)

      if (monthlySummaries && monthlySummaries.length >= 2) {
        for (let i = 0; i < monthlySummaries.length - 1; i++) {
          if (
            monthlySummaries[i].performance_score >
            monthlySummaries[i + 1].performance_score
          ) {
            consecutiveImprovementMonths++
          } else {
            break
          }
        }
      }
    } catch {
      // If table query fails, keep at 0
    }

    currentValues.consecutive_improvement_months = consecutiveImprovementMonths

    // Check leaderboard rank for Top Performer
    try {
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const { data: rankData } = await supabase
        .from('cro_monthly_summary')
        .select('cro_id')
        .eq('month', currentMonth)
        .order('performance_score', { ascending: false })
        .limit(1)

      if (rankData && rankData.length > 0 && rankData[0].cro_id === user.id) {
        currentValues.company_rank = 1
      }
    } catch {
      // Keep default rank
    }

    // Build badge statuses
    const badgeStatuses: BadgeStatus[] = BADGE_DEFINITIONS.map(badge => {
      const earnedAt = earnedBadgeMap.get(badge.id)

      if (earnedAt) {
        return {
          badge,
          status: 'earned' as const,
          earned_at: earnedAt,
          progress_percentage: 100,
          current_value: badge.criteria_threshold,
        }
      }

      // Calculate progress toward earning
      const currentValue = currentValues[badge.criteria_metric] ?? 0
      let progressPercentage: number

      // For response time, lower is better (inverted logic)
      if (badge.criteria_metric === 'avg_response_time') {
        if (currentValue === 0) {
          progressPercentage = 0
        } else if (currentValue <= badge.criteria_threshold) {
          progressPercentage = 100
        } else {
          // e.g., threshold=15, current=30 → 50% progress
          progressPercentage = Math.max(
            0,
            Math.min(100, (badge.criteria_threshold / currentValue) * 100)
          )
        }
      } else if (badge.criteria_metric === 'company_rank') {
        // Rank 1 = 100%, any other rank = proportional
        if (currentValue === 1) {
          progressPercentage = 100
        } else if (currentValue === 0) {
          progressPercentage = 0
        } else {
          progressPercentage = Math.max(0, Math.min(90, (1 / currentValue) * 100))
        }
      } else {
        progressPercentage = Math.min(
          100,
          (currentValue / badge.criteria_threshold) * 100
        )
      }

      progressPercentage = Math.round(progressPercentage * 100) / 100

      return {
        badge,
        status: progressPercentage >= 50 ? ('in_progress' as const) : ('locked' as const),
        progress_percentage: progressPercentage,
        current_value: Math.round(currentValue * 100) / 100,
      }
    })

    // Sort: earned first, then in_progress, then locked
    const statusOrder = { earned: 0, in_progress: 1, locked: 2 }
    badgeStatuses.sort((a, b) => statusOrder[a.status] - statusOrder[b.status])

    return NextResponse.json({
      success: true,
      data: {
        badges: badgeStatuses,
        summary: {
          total: BADGE_DEFINITIONS.length,
          earned: badgeStatuses.filter(b => b.status === 'earned').length,
          in_progress: badgeStatuses.filter(b => b.status === 'in_progress').length,
          locked: badgeStatuses.filter(b => b.status === 'locked').length,
        },
      },
    })
  } catch (error) {
    apiLogger.error('Error fetching badges', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch badge data' },
      { status: 500 }
    )
  }
}

/**
 * Calculate current month performance values for badge progress
 */
function calculateCurrentValues(
  dailyMetrics: any[]
): Record<string, number> {
  if (dailyMetrics.length === 0) {
    return {
      calls_made: 0,
      conversion_rate: 0,
      revenue_generated: 0,
      consecutive_target_days: 0,
      company_rank: 0,
      avg_response_time: 0,
      followup_completion_rate: 0,
      consecutive_improvement_months: 0,
      cases_disbursed: 0,
      customer_satisfaction: 0,
    }
  }

  const daysWorked = dailyMetrics.length
  const totalCalls = dailyMetrics.reduce(
    (sum, d) => sum + (d.calls_made || 0),
    0
  )
  const totalLeadsGenerated = dailyMetrics.reduce(
    (sum, d) => sum + (d.leads_generated || 0),
    0
  )
  const totalLeadsConverted = dailyMetrics.reduce(
    (sum, d) => sum + (d.leads_converted || 0),
    0
  )
  const totalRevenue = dailyMetrics.reduce(
    (sum, d) => sum + (d.revenue_generated || 0),
    0
  )
  const totalCasesDisbursed = dailyMetrics.reduce(
    (sum, d) => sum + (d.cases_disbursed || 0),
    0
  )
  const avgResponseTime =
    dailyMetrics.reduce(
      (sum, d) => sum + (d.avg_response_time_minutes || 0),
      0
    ) / daysWorked
  const avgSatisfaction =
    dailyMetrics.reduce(
      (sum, d) => sum + (d.customer_satisfaction_score || 0),
      0
    ) / daysWorked

  const totalFollowupsScheduled = dailyMetrics.reduce(
    (sum, d) => sum + (d.followups_scheduled || d.followups_completed || 0),
    0
  )
  const totalFollowupsCompleted = dailyMetrics.reduce(
    (sum, d) => sum + (d.followups_completed || 0),
    0
  )
  const followupRate =
    totalFollowupsScheduled > 0
      ? (totalFollowupsCompleted / totalFollowupsScheduled) * 100
      : 0

  // Calculate consecutive target days (simplified: days where calls >= daily target)
  let consecutiveTargetDays = 0
  let currentStreak = 0
  for (const day of dailyMetrics) {
    // Consider a day "meeting targets" if calls and leads are above average
    const dailyCallsTarget = totalCalls / daysWorked
    const meetsTarget =
      (day.calls_made || 0) >= dailyCallsTarget * 0.8 &&
      (day.leads_generated || 0) > 0
    if (meetsTarget) {
      currentStreak++
      consecutiveTargetDays = Math.max(consecutiveTargetDays, currentStreak)
    } else {
      currentStreak = 0
    }
  }

  const conversionRate =
    totalLeadsGenerated > 0
      ? (totalLeadsConverted / totalLeadsGenerated) * 100
      : 0

  return {
    calls_made: totalCalls,
    conversion_rate: conversionRate,
    revenue_generated: totalRevenue,
    consecutive_target_days: consecutiveTargetDays,
    company_rank: 0, // Will be set separately
    avg_response_time: avgResponseTime,
    followup_completion_rate: followupRate,
    consecutive_improvement_months: 0, // Will be set separately
    cases_disbursed: totalCasesDisbursed,
    customer_satisfaction: avgSatisfaction,
  }
}
