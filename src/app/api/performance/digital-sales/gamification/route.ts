import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/performance/digital-sales/gamification
 * Returns gamification data (achievements, streaks, points, level)
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

    // Get user profile
    const { data: profile } = await supabase
      .from('users')
      .select('id, full_name, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || profile.sub_role !== 'DIGITAL_SALES') {
      return NextResponse.json(
        { error: 'Access denied. This endpoint is for Digital Sales only.' },
        { status: 403 }
      )
    }

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    // Fetch all achievements
    const { data: allAchievements } = await supabase
      .from('digital_sales_achievements')
      .select('*')
      .eq('is_active', true)
      .order('category')

    // Fetch user's unlocked achievements
    const { data: userAchievements } = await supabase
      .from('digital_sales_user_achievements')
      .select('achievement_id, unlocked_at, unlocked_value')
      .eq('user_id', user.id)

    const unlockedIds = new Set(userAchievements?.map(ua => ua.achievement_id) || [])

    // Combine achievements with unlock status
    const achievements = allAchievements?.map(achievement => ({
      ...achievement,
      unlocked: unlockedIds.has(achievement.id),
      unlockedAt: userAchievements?.find(ua => ua.achievement_id === achievement.id)?.unlocked_at,
    })) || []

    // Group by category
    const achievementsByCategory = achievements.reduce((acc: any, achievement) => {
      if (!acc[achievement.category]) {
        acc[achievement.category] = { total: 0, unlocked: 0, items: [] }
      }
      acc[achievement.category].total++
      if (achievement.unlocked) acc[achievement.category].unlocked++
      acc[achievement.category].items.push(achievement)
      return acc
    }, {})

    // Fetch streaks
    const { data: streaks } = await supabase
      .from('digital_sales_streaks')
      .select('*')
      .eq('user_id', user.id)

    const streakData = streaks?.reduce((acc: any, streak) => {
      acc[streak.streak_type] = {
        current: streak.current_streak,
        longest: streak.longest_streak,
        lastUpdated: streak.last_updated,
        startDate: streak.streak_start_date,
      }
      return acc
    }, {}) || {}

    // Fetch points
    const { data: points } = await supabase
      .from('digital_sales_user_points')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle()

    // Calculate level progress
    const currentLevel = points?.current_level || 1
    const totalPoints = points?.total_points || 0
    const lifetimePoints = points?.lifetime_points || 0
    const pointsForNextLevel = currentLevel * 1000
    const pointsInCurrentLevel = totalPoints - ((currentLevel - 1) * 1000)
    const levelProgress = (pointsInCurrentLevel / 1000) * 100

    // Get level title
    const levelTitles: Record<number, string> = {
      1: 'Rookie',
      2: 'Apprentice',
      3: 'Specialist',
      4: 'Expert',
      5: 'Master',
      6: 'Champion',
      7: 'Legend',
      8: 'Elite',
      9: 'Grand Master',
      10: 'Supreme',
    }

    // Get recent achievements (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
    const recentAchievements = achievements
      .filter(a => a.unlocked && a.unlockedAt && a.unlockedAt >= thirtyDaysAgo)
      .sort((a, b) => new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime())
      .slice(0, 5)

    // Calculate total stats
    const totalUnlocked = achievements.filter(a => a.unlocked).length
    const totalAchievements = achievements.length
    const completionPercentage = totalAchievements > 0 ? (totalUnlocked / totalAchievements) * 100 : 0

    // Get next achievable achievements (closest to unlocking)
    const nextAchievements = achievements
      .filter(a => !a.unlocked)
      .slice(0, 3)

    // Calculate monthly leaderboard position for points
    const { data: allPoints } = await supabase
      .from('digital_sales_user_points')
      .select('user_id, monthly_points')
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .order('monthly_points', { ascending: false })

    let pointsRank = 1
    if (allPoints) {
      const userIndex = allPoints.findIndex(p => p.user_id === user.id)
      pointsRank = userIndex >= 0 ? userIndex + 1 : allPoints.length + 1
    }

    return NextResponse.json({
      userId: user.id,
      userName: profile.full_name,

      // Level & Points
      level: {
        current: currentLevel,
        title: levelTitles[Math.min(currentLevel, 10)] || 'Supreme',
        nextTitle: levelTitles[Math.min(currentLevel + 1, 10)] || 'Supreme',
        totalPoints,
        monthlyPoints: points?.monthly_points || 0,
        lifetimePoints,
        pointsToNextLevel: Math.max(0, pointsForNextLevel - totalPoints),
        levelProgress: Math.min(100, levelProgress),
        pointsRank,
        totalParticipants: allPoints?.length || 1,
      },

      // Streaks
      streaks: {
        dailyTarget: streakData.daily_target || { current: 0, longest: 0 },
        weeklyTarget: streakData.weekly_target || { current: 0, longest: 0 },
        conversion: streakData.conversion || { current: 0, longest: 0 },
        leads: streakData.leads || { current: 0, longest: 0 },
        revenue: streakData.revenue || { current: 0, longest: 0 },
      },

      // Achievements Overview
      achievements: {
        total: totalAchievements,
        unlocked: totalUnlocked,
        completionPercentage: Math.round(completionPercentage),
        byCategory: achievementsByCategory,
        recent: recentAchievements,
        next: nextAchievements,
      },

      // All achievements for display
      allAchievements: achievements,
    })
  } catch (error: unknown) {
    apiLogger.error('Error in gamification API', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
