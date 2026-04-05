import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TeleSalesGamification, AchievementBadge, Contest } from '@/lib/types/performance.types'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/performance/tele-sales/gamification
 * Returns gamification data including points, badges, levels, and contests
 * Enterprise-grade engagement features for Fortune 500 standards
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

    const { data: profile } = await supabase
      .from('users')
      .select('sub_role, full_name, created_at')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || profile.sub_role !== 'TELE_SALES') {
      return NextResponse.json(
        { error: 'Access denied. This endpoint is for Tele Sales employees only.' },
        { status: 403 }
      )
    }

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()
    const today = now.toISOString().split('T')[0]

    // Fetch performance data for gamification calculations
    const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1)
    const firstDayOfWeek = new Date(now)
    firstDayOfWeek.setDate(now.getDate() - now.getDay())

    const { data: monthlyMetrics } = await supabase
      .from('tele_sales_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('metric_date', firstDayOfMonth.toISOString().split('T')[0])
      .order('metric_date', { ascending: true })

    const { data: todayMetrics } = await supabase
      .from('tele_sales_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .eq('metric_date', today)
      .maybeSingle()

    const { data: monthlySummary } = await supabase
      .from('tele_sales_monthly_summary')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle()

    // Calculate gamification metrics
    const metrics = monthlyMetrics || []
    const totals = aggregateMetrics(metrics)

    // Calculate points
    const pointsBreakdown = calculatePoints(totals, todayMetrics)
    const totalPoints = Object.values(pointsBreakdown).reduce((a, b) => a + b, 0)

    // Calculate level based on total points
    const { level, levelName, experiencePoints, experienceToNextLevel, levelProgress } = calculateLevel(totalPoints)

    // Calculate streaks
    const streaks = calculateStreaks(metrics)

    // Generate badges based on achievements
    const badges = generateBadges(totals, metrics, profile, monthlySummary)
    const recentBadges = badges.filter(b => b.unlockedAt).slice(-3)

    // Get leaderboard positions
    const rankings = await getLeaderboardPositions(supabase, user.id, currentMonth, currentYear)

    // Get active contests
    const activeContests = await getActiveContests(supabase, user.id)

    // Calculate achievements progress
    const achievementProgress = calculateAchievementProgress(badges)

    const gamificationData: TeleSalesGamification = {
      // Streaks
      currentCallStreak: streaks.callStreak,
      currentConversionStreak: streaks.conversionStreak,
      currentQualityStreak: streaks.qualityStreak,

      // Points System
      totalPoints,
      pointsThisMonth: totalPoints,
      pointsToday: pointsBreakdown.bonusPoints + (todayMetrics ? calculateDayPoints(todayMetrics) : 0),
      pointsBreakdown,

      // Level System
      currentLevel: level,
      levelName,
      experiencePoints,
      experienceToNextLevel,
      levelProgress,

      // Badges
      badges,
      recentBadges,

      // Leaderboard Position
      dailyRank: rankings.dailyRank,
      weeklyRank: rankings.weeklyRank,
      monthlyRank: monthlySummary?.company_rank || rankings.monthlyRank,

      // Contests
      activeContests,
      contestsWon: 0, // Would be fetched from contest_winners table

      // Achievements
      achievementsUnlocked: badges.filter(b => b.unlockedAt).length,
      totalAchievements: badges.length,
      nextAchievement: achievementProgress,
    }

    return NextResponse.json(gamificationData)
  } catch (error: unknown) {
    apiLogger.error('Error in Tele Sales gamification API', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function aggregateMetrics(metrics: any[]): any {
  return metrics.reduce(
    (acc, m) => ({
      totalCalls: acc.totalCalls + (m.total_calls || 0),
      totalRevenue: acc.totalRevenue + (m.revenue_generated || 0),
      leadsConverted: acc.leadsConverted + (m.leads_converted || 0),
      leadsGenerated: acc.leadsGenerated + (m.leads_generated || 0),
      applications: acc.applications + (m.applications_completed || 0),
      talkTime: acc.talkTime + (m.total_talk_time_minutes || 0),
      qualitySum: acc.qualitySum + (m.call_quality_score || 0),
      csatSum: acc.csatSum + (m.customer_satisfaction_score || 0),
      crossSellSuccess: acc.crossSellSuccess + (m.cross_sell_successful || 0),
      daysWorked: acc.daysWorked + 1,
    }),
    { totalCalls: 0, totalRevenue: 0, leadsConverted: 0, leadsGenerated: 0, applications: 0, talkTime: 0, qualitySum: 0, csatSum: 0, crossSellSuccess: 0, daysWorked: 0 }
  )
}

function calculatePoints(totals: any, todayMetrics: any): any {
  return {
    callPoints: Math.floor(totals.totalCalls * 2), // 2 points per call
    conversionPoints: Math.floor(totals.leadsConverted * 50), // 50 points per conversion
    qualityPoints: Math.floor((totals.qualitySum / Math.max(totals.daysWorked, 1)) * 5), // 5x avg quality score
    bonusPoints: calculateBonusPoints(totals, todayMetrics),
  }
}

function calculateBonusPoints(totals: any, todayMetrics: any): number {
  let bonus = 0

  // Revenue bonus (100 points per lakh)
  bonus += Math.floor(totals.totalRevenue / 100000) * 100

  // Cross-sell bonus
  bonus += totals.crossSellSuccess * 25

  // Daily streak bonus
  if (todayMetrics && totals.daysWorked >= 5) {
    bonus += 50 // Consistency bonus
  }

  // Quality excellence bonus
  if (totals.daysWorked > 0 && (totals.qualitySum / totals.daysWorked) >= 90) {
    bonus += 100
  }

  return bonus
}

function calculateDayPoints(metrics: any): number {
  return (
    (metrics.total_calls || 0) * 2 +
    (metrics.leads_converted || 0) * 50 +
    (metrics.applications_completed || 0) * 30
  )
}

function calculateLevel(totalPoints: number): {
  level: number
  levelName: string
  experiencePoints: number
  experienceToNextLevel: number
  levelProgress: number
} {
  const levelThresholds = [
    { level: 1, name: 'Rookie Caller', minPoints: 0 },
    { level: 2, name: 'Junior Agent', minPoints: 500 },
    { level: 3, name: 'Sales Associate', minPoints: 1500 },
    { level: 4, name: 'Sales Professional', minPoints: 3500 },
    { level: 5, name: 'Senior Agent', minPoints: 7000 },
    { level: 6, name: 'Expert Closer', minPoints: 12000 },
    { level: 7, name: 'Master Seller', minPoints: 20000 },
    { level: 8, name: 'Elite Performer', minPoints: 35000 },
    { level: 9, name: 'Sales Champion', minPoints: 55000 },
    { level: 10, name: 'Legend', minPoints: 80000 },
  ]

  let currentLevel = levelThresholds[0]
  let nextLevel = levelThresholds[1]

  for (let i = 0; i < levelThresholds.length; i++) {
    if (totalPoints >= levelThresholds[i].minPoints) {
      currentLevel = levelThresholds[i]
      nextLevel = levelThresholds[i + 1] || { level: 10, name: 'Legend', minPoints: 100000 }
    }
  }

  const pointsInCurrentLevel = totalPoints - currentLevel.minPoints
  const pointsNeededForNext = nextLevel.minPoints - currentLevel.minPoints
  const progress = Math.min((pointsInCurrentLevel / pointsNeededForNext) * 100, 100)

  return {
    level: currentLevel.level,
    levelName: currentLevel.levelName,
    experiencePoints: totalPoints,
    experienceToNextLevel: nextLevel.minPoints - totalPoints,
    levelProgress: Math.round(progress),
  }
}

function calculateStreaks(metrics: any[]): {
  callStreak: number
  conversionStreak: number
  qualityStreak: number
} {
  let callStreak = 0
  let conversionStreak = 0
  let qualityStreak = 0

  // Sort by date descending and check consecutive days
  const sorted = [...metrics].sort((a, b) =>
    new Date(b.metric_date).getTime() - new Date(a.metric_date).getTime()
  )

  for (const metric of sorted) {
    // Call streak (at least 20 calls per day)
    if (metric.total_calls >= 20) callStreak++
    else break
  }

  // Reset and calculate conversion streak
  for (const metric of sorted) {
    if (metric.leads_converted >= 1) conversionStreak++
    else break
  }

  // Reset and calculate quality streak (quality >= 85)
  for (const metric of sorted) {
    if (metric.call_quality_score >= 85) qualityStreak++
    else break
  }

  return { callStreak, conversionStreak, qualityStreak }
}

function generateBadges(totals: any, metrics: any[], profile: any, summary: any): AchievementBadge[] {
  const badges: AchievementBadge[] = []
  const now = new Date().toISOString()

  // Call Volume Badges
  badges.push({
    id: 'first-100-calls',
    name: 'Centurion',
    description: 'Made 100 calls in a month',
    icon: '📞',
    category: 'milestone',
    rarity: 'common',
    unlockedAt: totals.totalCalls >= 100 ? now : undefined,
    progress: Math.min(totals.totalCalls, 100),
    target: 100,
  })

  badges.push({
    id: 'call-master',
    name: 'Call Master',
    description: 'Made 500 calls in a month',
    icon: '🏆',
    category: 'milestone',
    rarity: 'rare',
    unlockedAt: totals.totalCalls >= 500 ? now : undefined,
    progress: Math.min(totals.totalCalls, 500),
    target: 500,
  })

  // Revenue Badges
  badges.push({
    id: 'first-lakh',
    name: 'Lakhpati',
    description: 'Generated 1 Lakh revenue in a month',
    icon: '💰',
    category: 'milestone',
    rarity: 'common',
    unlockedAt: totals.totalRevenue >= 100000 ? now : undefined,
    progress: Math.min(totals.totalRevenue, 100000),
    target: 100000,
  })

  badges.push({
    id: 'revenue-star',
    name: 'Revenue Star',
    description: 'Generated 10 Lakh revenue in a month',
    icon: '⭐',
    category: 'milestone',
    rarity: 'epic',
    unlockedAt: totals.totalRevenue >= 1000000 ? now : undefined,
    progress: Math.min(totals.totalRevenue, 1000000),
    target: 1000000,
  })

  badges.push({
    id: 'crorepati',
    name: 'Crorepati',
    description: 'Generated 1 Crore revenue in a month',
    icon: '👑',
    category: 'milestone',
    rarity: 'legendary',
    unlockedAt: totals.totalRevenue >= 10000000 ? now : undefined,
    progress: Math.min(totals.totalRevenue, 10000000),
    target: 10000000,
  })

  // Conversion Badges
  badges.push({
    id: 'closer',
    name: 'The Closer',
    description: 'Converted 10 leads in a month',
    icon: '🎯',
    category: 'excellence',
    rarity: 'common',
    unlockedAt: totals.leadsConverted >= 10 ? now : undefined,
    progress: Math.min(totals.leadsConverted, 10),
    target: 10,
  })

  badges.push({
    id: 'super-closer',
    name: 'Super Closer',
    description: 'Converted 25 leads in a month',
    icon: '🔥',
    category: 'excellence',
    rarity: 'rare',
    unlockedAt: totals.leadsConverted >= 25 ? now : undefined,
    progress: Math.min(totals.leadsConverted, 25),
    target: 25,
  })

  // Quality Badges
  const avgQuality = totals.daysWorked > 0 ? totals.qualitySum / totals.daysWorked : 0
  badges.push({
    id: 'quality-champion',
    name: 'Quality Champion',
    description: 'Maintain 90%+ call quality for the month',
    icon: '🏅',
    category: 'excellence',
    rarity: 'epic',
    unlockedAt: avgQuality >= 90 && totals.daysWorked >= 10 ? now : undefined,
    progress: Math.round(avgQuality),
    target: 90,
  })

  // Streak Badges
  const streaks = calculateStreaks(metrics)
  badges.push({
    id: 'hot-streak',
    name: 'Hot Streak',
    description: 'Convert leads for 5 consecutive days',
    icon: '🔥',
    category: 'streak',
    rarity: 'rare',
    unlockedAt: streaks.conversionStreak >= 5 ? now : undefined,
    progress: Math.min(streaks.conversionStreak, 5),
    target: 5,
  })

  badges.push({
    id: 'consistency-king',
    name: 'Consistency King',
    description: 'Make 20+ calls for 10 consecutive days',
    icon: '👑',
    category: 'streak',
    rarity: 'epic',
    unlockedAt: streaks.callStreak >= 10 ? now : undefined,
    progress: Math.min(streaks.callStreak, 10),
    target: 10,
  })

  // Ranking Badges
  if (summary?.company_rank === 1) {
    badges.push({
      id: 'top-performer',
      name: 'Top Performer',
      description: 'Ranked #1 in the company',
      icon: '🥇',
      category: 'excellence',
      rarity: 'legendary',
      unlockedAt: now,
    })
  } else if (summary?.company_rank && summary.company_rank <= 3) {
    badges.push({
      id: 'podium-finish',
      name: 'Podium Finish',
      description: 'Ranked in Top 3',
      icon: '🏆',
      category: 'excellence',
      rarity: 'epic',
      unlockedAt: now,
    })
  }

  // Special Badges
  badges.push({
    id: 'cross-sell-expert',
    name: 'Cross-sell Expert',
    description: 'Successfully cross-sell 10 products',
    icon: '🛒',
    category: 'special',
    rarity: 'rare',
    unlockedAt: totals.crossSellSuccess >= 10 ? now : undefined,
    progress: Math.min(totals.crossSellSuccess, 10),
    target: 10,
  })

  return badges
}

async function getLeaderboardPositions(
  supabase: any,
  userId: string,
  month: number,
  year: number
): Promise<{ dailyRank: number; weeklyRank: number; monthlyRank: number }> {
  // This would query leaderboard tables
  // For now, return placeholder values
  return {
    dailyRank: 0,
    weeklyRank: 0,
    monthlyRank: 0,
  }
}

async function getActiveContests(supabase: any, userId: string): Promise<Contest[]> {
  // This would query active contests from a contests table
  // For now, return sample contests
  const now = new Date()
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  return [
    {
      id: 'monthly-revenue-race',
      name: 'Monthly Revenue Race',
      description: 'Compete to generate the highest revenue this month',
      startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      endDate: endOfMonth.toISOString(),
      status: 'active',
      category: 'revenue',
      prize: 'Cash bonus + Recognition',
      participants: 50,
      leaderboard: [],
    },
    {
      id: 'call-volume-challenge',
      name: 'Call Volume Challenge',
      description: 'Make the most calls this week',
      startDate: now.toISOString(),
      endDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
      category: 'activity',
      prize: 'Team lunch + Certificate',
      participants: 50,
      leaderboard: [],
    },
  ]
}

function calculateAchievementProgress(badges: AchievementBadge[]): {
  name: string
  description: string
  progress: number
  target: number
} | undefined {
  // Find the closest unlockable badge
  const lockedBadges = badges.filter(b => !b.unlockedAt && b.progress !== undefined && b.target !== undefined)

  if (lockedBadges.length === 0) return undefined

  // Sort by progress percentage (closest to completion first)
  const sorted = lockedBadges.sort((a, b) => {
    const aProgress = (a.progress! / a.target!) * 100
    const bProgress = (b.progress! / b.target!) * 100
    return bProgress - aProgress
  })

  const next = sorted[0]
  return {
    name: next.name,
    description: next.description,
    progress: next.progress!,
    target: next.target!,
  }
}
