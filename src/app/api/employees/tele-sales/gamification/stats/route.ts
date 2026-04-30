
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TS_LEVEL_DEFINITIONS, TS_POINTS_CONFIG } from '@/lib/types/telesales-gamification.types'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

// GET - Get gamification stats for current user
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get or create user points record
    let { data: userPoints, error: pointsError } = await supabase
      .from('ts_user_points')
      .select('*')
      .eq('sales_executive_id', user.id)
      .maybeSingle()

    if (!userPoints) {
      // Create initial user points record
      const { data: newPoints, error: createError } = await supabase
        .from('ts_user_points')
        .insert({
          sales_executive_id: user.id,
          current_points: 0,
          lifetime_points: 0,
          current_level: 1,
          level_name: 'Rookie',
          points_to_next_level: 500
        })
        .select()
        .maybeSingle()

      if (createError) {
        apiLogger.error('Error creating user points', createError)
      }
      userPoints = newPoints
    }

    // Get recent points transactions
    const { data: recentPoints } = await supabase
      .from('ts_points_transactions')
      .select('*')
      .eq('sales_executive_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)

    // Get earned badges with badge details
    const { data: earnedBadges } = await supabase
      .from('ts_user_badges')
      .select(`
        *,
        badge:ts_badges(*)
      `)
      .eq('sales_executive_id', user.id)
      .order('earned_at', { ascending: false })

    // Get all available badges
    const { data: allBadges } = await supabase
      .from('ts_badges')
      .select('*')
      .eq('is_active', true)
      .order('tier', { ascending: true })

    // Get weekly leaderboard
    const today = new Date()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay())
    startOfWeek.setHours(0, 0, 0, 0)

    const { data: weeklyLeaderboard } = await supabase
      .from('ts_leaderboards')
      .select('*')
      .eq('period_type', 'WEEKLY')
      .gte('period_start', startOfWeek.toISOString().split('T')[0])
      .maybeSingle()

    // Get active contests
    const { data: activeContests } = await supabase
      .from('ts_contests')
      .select('*')
      .eq('status', 'ACTIVE')
      .order('end_date', { ascending: true })

    // Get today's challenge
    const todayStr = new Date().toISOString().split('T')[0]
    const { data: dailyChallenge } = await supabase
      .from('ts_daily_challenges')
      .select('*')
      .eq('challenge_date', todayStr)
      .eq('is_active', true)
      .maybeSingle()

    // Get user's challenge progress
    let challengeProgress = null
    if (dailyChallenge) {
      const { data: progress } = await supabase
        .from('ts_user_challenge_progress')
        .select('*')
        .eq('sales_executive_id', user.id)
        .eq('challenge_id', dailyChallenge.id)
        .maybeSingle()
      challengeProgress = progress
    }

    // Calculate next level info
    const currentLevel = userPoints?.current_level || 1
    const currentPoints = userPoints?.lifetime_points || 0
    const nextLevelDef = TS_LEVEL_DEFINITIONS.find(l => l.level === currentLevel + 1) || TS_LEVEL_DEFINITIONS[TS_LEVEL_DEFINITIONS.length - 1]
    const currentLevelDef = TS_LEVEL_DEFINITIONS.find(l => l.level === currentLevel) || TS_LEVEL_DEFINITIONS[0]

    const pointsInCurrentLevel = currentPoints - currentLevelDef.min_points
    const pointsNeededForLevel = nextLevelDef.min_points - currentLevelDef.min_points
    const progressPercentage = Math.min(100, Math.round((pointsInCurrentLevel / pointsNeededForLevel) * 100))

    // Calculate badge progress
    const earnedBadgeIds = new Set((earnedBadges || []).map(b => b.badge_id))
    const badgeProgress = (allBadges || [])
      .filter(badge => !earnedBadgeIds.has(badge.id))
      .map(badge => {
        let current = 0
        if (badge.category === 'CALLS') {
          current = userPoints?.total_calls_made || 0
        } else if (badge.category === 'CONVERSIONS') {
          current = userPoints?.total_conversions || 0
        } else if (badge.category === 'STREAKS') {
          current = userPoints?.longest_streak_days || 0
        }
        return {
          badge_id: badge.id,
          progress: current,
          target: badge.requirement_value
        }
      })

    // Check if streak is at risk
    const lastActivity = userPoints?.last_activity_date
    const streakAtRisk = !lastActivity || lastActivity !== todayStr

    return NextResponse.json({
      success: true,
      data: {
        user_points: userPoints || {
          current_points: 0,
          lifetime_points: 0,
          current_level: 1,
          level_name: 'Rookie',
          current_streak_days: 0,
          longest_streak_days: 0,
          total_calls_made: 0,
          total_conversions: 0,
          total_badges_earned: 0
        },
        recent_points: recentPoints || [],
        earned_badges: earnedBadges || [],
        available_badges: allBadges || [],
        badge_progress: badgeProgress,
        weekly_leaderboard: weeklyLeaderboard?.rankings || [],
        user_rank: {
          weekly: userPoints?.weekly_rank || 0,
          monthly: userPoints?.monthly_rank || 0,
          all_time: userPoints?.all_time_rank || 0
        },
        active_contests: activeContests || [],
        daily_challenge: dailyChallenge,
        challenge_progress: challengeProgress,
        streak_info: {
          current: userPoints?.current_streak_days || 0,
          longest: userPoints?.longest_streak_days || 0,
          at_risk: streakAtRisk
        },
        next_level: {
          name: nextLevelDef.name,
          points_needed: nextLevelDef.min_points - currentPoints,
          progress_percentage: progressPercentage
        },
        points_config: TS_POINTS_CONFIG
      }
    })
  } catch (error) {
    apiLogger.error('Gamification stats error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch gamification stats' },
      { status: 500 }
    )
  }
}
