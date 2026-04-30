
/**
 * ============================================================================
 * BDM TEAM PERFORMANCE - LEADERBOARD API
 * ============================================================================
 * Endpoint: GET /api/bdm/team-performance/leaderboard
 * Purpose: Fetch team rankings, category leaders, and performance distribution
 * Returns: Leaderboard data with rankings, badges, and achievements
 * ============================================================================
 */

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
// Local types defined below replace imported types that do not match route data shapes
import {
  calculateAchievementPercentage,
  calculateGrade,
  formatCurrency,
  getStatusFromAchievement,
  getCurrentMonthInfo,
  validateMonth,
  validateYear,
  getDaysInMonth,
} from '@/lib/bdm/team-performance-utils'
import { apiLogger } from '@/lib/utils/logger'


// ============================================================================
// LOCAL TYPES - Match what this route actually constructs
// ============================================================================

interface RecentBadge {
  id: string
  name: string
  icon: string
  color: string
  rarity: string
  earnedAt: string
}

interface LocalLeaderboardEntry {
  bdeId: string
  bdeName: string
  employeeCode: string
  overallScore: number
  rank: number
  conversions: number
  revenue: number
  conversionRate: number
  activityRate: number
  grade: string
  status: 'exceeding' | 'on_track' | 'at_risk' | 'behind'
  badgesEarned: number
  recentBadges: RecentBadge[]
  metrics: {
    conversions: number
    revenue: number
    leads: number
    calls: number
    meetings: number
    disbursal: number
    conversionRate: number
    callToMeetingRate: number
    meetingToConversionRate: number
    activityRate: number
    longestStreak: number
  }
}

interface LocalCategoryLeader {
  category: string
  icon: string
  color: string
  bdeId: string
  bdeName: string
  value: number
  formattedValue: string
  description: string
}

interface LocalEfficiencyQuadrant {
  bdeId: string
  bdeName: string
  conversionRate: number
  activityRate: number
  quadrant: 'high-high' | 'high-low' | 'low-high' | 'low-low'
  size: number
}

interface LocalTeamMilestone {
  id: string
  title: string
  current: number
  target: number
  percentage: number
  icon: string
  color: string
  achieved: boolean
  formattedCurrent?: string
  formattedTarget?: string
}

interface LocalPerformanceDistribution {
  excellent: number
  good: number
  average: number
  needsImprovement: number
}

interface LocalLeaderboardResponse {
  success: boolean
  data: {
    leaderboard: LocalLeaderboardEntry[]
    categoryLeaders: LocalCategoryLeader[]
    performanceDistribution: LocalPerformanceDistribution
    efficiencyQuadrants: LocalEfficiencyQuadrant[]
    teamMilestones: LocalTeamMilestone[]
    periodInfo: {
      month: number
      year: number
      monthName: string
      currentDay: number
      totalDays: number
    }
    lastUpdated: string
  }
}

export async function GET(request: NextRequest) {
  try {
    // =========================================================================
    // 1. AUTHENTICATION & AUTHORIZATION
    // =========================================================================

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get BDM info
    const { data: bdmUser, error: bdmError } = await supabase
      .from('users')
      .select('id, name, email, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (bdmError || !bdmUser || bdmUser.sub_role !== 'BUSINESS_DEVELOPMENT_MANAGER') {
      return NextResponse.json(
        { success: false, error: 'Access denied. BDM role required.' },
        { status: 403 }
      )
    }

    // =========================================================================
    // 2. PARSE QUERY PARAMETERS
    // =========================================================================

    const { searchParams } = new URL(request.url)
    const monthParam = searchParams.get('month')
    const yearParam = searchParams.get('year')

    const currentMonthInfo = getCurrentMonthInfo()
    const month = monthParam ? parseInt(monthParam) : currentMonthInfo.month
    const year = yearParam ? parseInt(yearParam) : currentMonthInfo.year

    if (!validateMonth(month) || !validateYear(year)) {
      return NextResponse.json(
        { success: false, error: 'Invalid month or year' },
        { status: 400 }
      )
    }

    const daysInMonth = getDaysInMonth(month, year)
    const currentDay = currentMonthInfo.month === month && currentMonthInfo.year === year
      ? currentMonthInfo.currentDay
      : daysInMonth

    // =========================================================================
    // 3. FETCH TEAM BDEs
    // =========================================================================

    const { data: teamBDEs, error: teamError } = await supabase
      .from('users')
      .select('id, name, email, employee_code')
      .eq('manager_id', user.id)
      .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')
      .eq('is_active', true)

    if (teamError) {
      apiLogger.error('Error fetching team', teamError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch team members' },
        { status: 500 }
      )
    }

    if (!teamBDEs || teamBDEs.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          leaderboard: [],
          categoryLeaders: [],
          performanceDistribution: {
            excellent: 0,
            good: 0,
            average: 0,
            needsImprovement: 0,
          },
          efficiencyQuadrants: [],
          teamMilestones: [],
          periodInfo: {
            month,
            year,
            monthName: new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long' }),
            currentDay,
            totalDays: daysInMonth,
          },
          lastUpdated: new Date().toISOString(),
        },
      })
    }

    const teamBDEIds = teamBDEs.map((bde) => bde.id)

    // =========================================================================
    // 4. FETCH TARGETS AND ACHIEVEMENTS
    // =========================================================================

    const { data: targets } = await supabase
      .from('bdm_targets')
      .select('*')
      .in('bde_user_id', teamBDEIds)
      .eq('month', month)
      .eq('year', year)

    const { data: dailyAchievements } = await supabase
      .from('bde_daily_achievements')
      .select('*')
      .in('bde_user_id', teamBDEIds)
      .eq('month', month)
      .eq('year', year)

    // =========================================================================
    // 5. FETCH EARNED BADGES
    // =========================================================================

    const { data: earnedBadges } = await supabase
      .from('bde_earned_badges')
      .select(`
        id,
        bde_user_id,
        earned_at,
        badge:achievement_badges(id, name, icon_name, color, rarity)
      `)
      .in('bde_user_id', teamBDEIds)
      .gte('earned_at', `${year}-${String(month).padStart(2, '0')}-01`)
      .lte('earned_at', `${year}-${String(month).padStart(2, '0')}-${daysInMonth}`)

    // =========================================================================
    // 6. BUILD LEADERBOARD ENTRIES
    // =========================================================================

    const leaderboardEntries: LocalLeaderboardEntry[] = teamBDEs.map((bde) => {
      const bdeTargets = targets?.find((t) => t.bde_user_id === bde.id)
      const bdeAchievements = dailyAchievements?.filter((a) => a.bde_user_id === bde.id) || []
      const bdeBadges = earnedBadges?.filter((b) => b.bde_user_id === bde.id) || []

      // Calculate MTD totals
      const mtdConversions = bdeAchievements.reduce((sum, a) => sum + (a.conversions || 0), 0)
      const mtdRevenue = bdeAchievements.reduce((sum, a) => sum + (a.revenue || 0), 0)
      const mtdLeads = bdeAchievements.reduce((sum, a) => sum + (a.leads_generated || 0), 0)
      const mtdCalls = bdeAchievements.reduce((sum, a) => sum + (a.calls_made || 0), 0)
      const mtdMeetings = bdeAchievements.reduce((sum, a) => sum + (a.meetings_conducted || 0), 0)
      const mtdDisbursal = bdeAchievements.reduce((sum, a) => sum + (a.disbursal || 0), 0)

      // Calculate achievements
      const conversionAchievement = calculateAchievementPercentage(
        mtdConversions,
        bdeTargets?.conversions_target || 0
      )
      const revenueAchievement = calculateAchievementPercentage(
        mtdRevenue,
        bdeTargets?.revenue_target || 0
      )
      const overallAchievement = Math.round((conversionAchievement + revenueAchievement) / 2)

      // Calculate efficiency metrics
      const conversionRate = mtdLeads > 0 ? (mtdConversions / mtdLeads) * 100 : 0
      const callToMeetingRate = mtdCalls > 0 ? (mtdMeetings / mtdCalls) * 100 : 0
      const meetingToConversionRate = mtdMeetings > 0 ? (mtdConversions / mtdMeetings) * 100 : 0

      // Activity consistency
      const activeDays = bdeAchievements.filter((a) => (a.conversions || 0) > 0 || (a.leads_generated || 0) > 0).length
      const activityRate = (activeDays / currentDay) * 100

      // Find longest streak
      const longestStreak = Math.max(...bdeAchievements.map((a) => a.current_streak || 0), 0)

      return {
        bdeId: bde.id,
        bdeName: bde.name || 'Unknown',
        employeeCode: bde.employee_code || 'N/A',
        overallScore: overallAchievement,
        rank: 0, // Will be calculated after sorting
        conversions: mtdConversions,
        revenue: mtdRevenue,
        conversionRate,
        activityRate,
        grade: calculateGrade(overallAchievement),
        status: getStatusFromAchievement(overallAchievement),
        badgesEarned: bdeBadges.length,
        recentBadges: bdeBadges
          .sort((a, b) => new Date(b.earned_at).getTime() - new Date(a.earned_at).getTime())
          .slice(0, 3)
          .map((b: unknown) => ({
            id: b.badge.id,
            name: b.badge.name,
            icon: b.badge.icon_name,
            color: b.badge.color,
            rarity: b.badge.rarity,
            earnedAt: b.earned_at,
          })),
        metrics: {
          conversions: mtdConversions,
          revenue: mtdRevenue,
          leads: mtdLeads,
          calls: mtdCalls,
          meetings: mtdMeetings,
          disbursal: mtdDisbursal,
          conversionRate,
          callToMeetingRate,
          meetingToConversionRate,
          activityRate,
          longestStreak,
        },
      }
    })

    // Sort by overall score and assign ranks
    leaderboardEntries.sort((a, b) => b.overallScore - a.overallScore)
    leaderboardEntries.forEach((entry, index) => {
      entry.rank = index + 1
    })

    // =========================================================================
    // 7. IDENTIFY CATEGORY LEADERS
    // =========================================================================

    const categoryLeaders: LocalCategoryLeader[] = [
      {
        category: 'Top Performer',
        icon: 'Trophy',
        color: 'text-yellow-600',
        bdeId: leaderboardEntries[0]?.bdeId || '',
        bdeName: leaderboardEntries[0]?.bdeName || '',
        value: leaderboardEntries[0]?.overallScore || 0,
        formattedValue: `${leaderboardEntries[0]?.overallScore || 0}%`,
        description: 'Highest overall achievement',
      },
      {
        category: 'Revenue Leader',
        icon: 'DollarSign',
        color: 'text-green-600',
        bdeId: leaderboardEntries.sort((a, b) => b.revenue - a.revenue)[0]?.bdeId || '',
        bdeName: leaderboardEntries.sort((a, b) => b.revenue - a.revenue)[0]?.bdeName || '',
        value: leaderboardEntries.sort((a, b) => b.revenue - a.revenue)[0]?.revenue || 0,
        formattedValue: formatCurrency(
          leaderboardEntries.sort((a, b) => b.revenue - a.revenue)[0]?.revenue || 0,
          true
        ),
        description: 'Highest revenue generated',
      },
      {
        category: 'Conversion Champion',
        icon: 'Target',
        color: 'text-blue-600',
        bdeId: leaderboardEntries.sort((a, b) => b.conversions - a.conversions)[0]?.bdeId || '',
        bdeName: leaderboardEntries.sort((a, b) => b.conversions - a.conversions)[0]?.bdeName || '',
        value: leaderboardEntries.sort((a, b) => b.conversions - a.conversions)[0]?.conversions || 0,
        formattedValue: `${leaderboardEntries.sort((a, b) => b.conversions - a.conversions)[0]?.conversions || 0}`,
        description: 'Most conversions achieved',
      },
      {
        category: 'Efficiency Expert',
        icon: 'Zap',
        color: 'text-purple-600',
        bdeId: leaderboardEntries.sort((a, b) => b.conversionRate - a.conversionRate)[0]?.bdeId || '',
        bdeName: leaderboardEntries.sort((a, b) => b.conversionRate - a.conversionRate)[0]?.bdeName || '',
        value: leaderboardEntries.sort((a, b) => b.conversionRate - a.conversionRate)[0]?.conversionRate || 0,
        formattedValue: `${(leaderboardEntries.sort((a, b) => b.conversionRate - a.conversionRate)[0]?.conversionRate || 0).toFixed(1)}%`,
        description: 'Highest conversion rate',
      },
      {
        category: 'Activity Hero',
        icon: 'Activity',
        color: 'text-orange-600',
        bdeId: leaderboardEntries.sort((a, b) => b.activityRate - a.activityRate)[0]?.bdeId || '',
        bdeName: leaderboardEntries.sort((a, b) => b.activityRate - a.activityRate)[0]?.bdeName || '',
        value: leaderboardEntries.sort((a, b) => b.activityRate - a.activityRate)[0]?.activityRate || 0,
        formattedValue: `${(leaderboardEntries.sort((a, b) => b.activityRate - a.activityRate)[0]?.activityRate || 0).toFixed(0)}%`,
        description: 'Most consistent daily activity',
      },
      {
        category: 'Badge Collector',
        icon: 'Award',
        color: 'text-pink-600',
        bdeId: leaderboardEntries.sort((a, b) => b.badgesEarned - a.badgesEarned)[0]?.bdeId || '',
        bdeName: leaderboardEntries.sort((a, b) => b.badgesEarned - a.badgesEarned)[0]?.bdeName || '',
        value: leaderboardEntries.sort((a, b) => b.badgesEarned - a.badgesEarned)[0]?.badgesEarned || 0,
        formattedValue: `${leaderboardEntries.sort((a, b) => b.badgesEarned - a.badgesEarned)[0]?.badgesEarned || 0} badges`,
        description: 'Most badges earned this month',
      },
    ]

    // Re-sort leaderboard by rank
    leaderboardEntries.sort((a, b) => a.rank - b.rank)

    // =========================================================================
    // 8. PERFORMANCE DISTRIBUTION
    // =========================================================================

    const performanceDistribution: LocalPerformanceDistribution = {
      excellent: leaderboardEntries.filter((e) => e.overallScore >= 100).length,
      good: leaderboardEntries.filter((e) => e.overallScore >= 80 && e.overallScore < 100).length,
      average: leaderboardEntries.filter((e) => e.overallScore >= 60 && e.overallScore < 80).length,
      needsImprovement: leaderboardEntries.filter((e) => e.overallScore < 60).length,
    }

    // =========================================================================
    // 9. EFFICIENCY QUADRANTS
    // =========================================================================

    const avgConversionRate = leaderboardEntries.reduce((sum, e) => sum + e.conversionRate, 0) / leaderboardEntries.length
    const avgActivityRate = leaderboardEntries.reduce((sum, e) => sum + e.activityRate, 0) / leaderboardEntries.length

    const efficiencyQuadrants: LocalEfficiencyQuadrant[] = leaderboardEntries.map((entry) => ({
      bdeId: entry.bdeId,
      bdeName: entry.bdeName,
      conversionRate: entry.conversionRate,
      activityRate: entry.activityRate,
      quadrant: getQuadrant(entry.conversionRate, entry.activityRate, avgConversionRate, avgActivityRate),
      size: entry.overallScore,
    }))

    // =========================================================================
    // 10. TEAM MILESTONES
    // =========================================================================

    const totalConversions = leaderboardEntries.reduce((sum, e) => sum + e.conversions, 0)
    const totalRevenue = leaderboardEntries.reduce((sum, e) => sum + e.revenue, 0)
    const totalBadges = leaderboardEntries.reduce((sum, e) => sum + e.badgesEarned, 0)

    const teamMilestones: LocalTeamMilestone[] = [
      {
        id: 'team-conversions',
        title: 'Team Conversions',
        current: totalConversions,
        target: 50,
        percentage: (totalConversions / 50) * 100,
        icon: 'Target',
        color: 'bg-blue-500',
        achieved: totalConversions >= 50,
      },
      {
        id: 'team-revenue',
        title: 'Team Revenue',
        current: totalRevenue,
        target: 5000000,
        percentage: (totalRevenue / 5000000) * 100,
        icon: 'DollarSign',
        color: 'bg-green-500',
        achieved: totalRevenue >= 5000000,
        formattedCurrent: formatCurrency(totalRevenue, true),
        formattedTarget: '₹50L',
      },
      {
        id: 'team-badges',
        title: 'Team Badges',
        current: totalBadges,
        target: 20,
        percentage: (totalBadges / 20) * 100,
        icon: 'Award',
        color: 'bg-purple-500',
        achieved: totalBadges >= 20,
      },
      {
        id: 'perfect-scores',
        title: 'Perfect Scores',
        current: performanceDistribution.excellent,
        target: 3,
        percentage: (performanceDistribution.excellent / 3) * 100,
        icon: 'Trophy',
        color: 'bg-yellow-500',
        achieved: performanceDistribution.excellent >= 3,
      },
    ]

    // =========================================================================
    // 11. BUILD RESPONSE
    // =========================================================================

    const response: LocalLeaderboardResponse = {
      success: true,
      data: {
        leaderboard: leaderboardEntries,
        categoryLeaders,
        performanceDistribution,
        efficiencyQuadrants,
        teamMilestones,
        periodInfo: {
          month,
          year,
          monthName: new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long' }),
          currentDay,
          totalDays: daysInMonth,
        },
        lastUpdated: new Date().toISOString(),
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    apiLogger.error('Error in leaderboard API', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}

function getQuadrant(
  conversionRate: number,
  activityRate: number,
  avgConversion: number,
  avgActivity: number
): 'high-high' | 'high-low' | 'low-high' | 'low-low' {
  if (conversionRate >= avgConversion && activityRate >= avgActivity) return 'high-high'
  if (conversionRate >= avgConversion && activityRate < avgActivity) return 'high-low'
  if (conversionRate < avgConversion && activityRate >= avgActivity) return 'low-high'
  return 'low-low'
}
