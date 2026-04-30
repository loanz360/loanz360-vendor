
/**
 * ============================================================================
 * BDM TEAM PERFORMANCE - HISTORICAL ANALYSIS API
 * ============================================================================
 * Endpoint: GET /api/bdm/team-performance/historical
 * Purpose: Fetch historical performance data, trends, and patterns
 * Returns: 6-12 months of data with MoM comparisons and insights
 * ============================================================================
 */

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  calculateAchievementPercentage,
  formatCurrency,
  getMonthName,
  getCurrentMonthInfo,
} from '@/lib/bdm/team-performance-utils'
import { apiLogger } from '@/lib/utils/logger'

// ============================================================================
// LOCAL TYPES - Match the actual API response shape
// (The imported types from @/types/bdm-team-performance define a different
//  contract; these local types reflect what this route actually constructs.)
// ============================================================================

interface LocalMonthlyHistoricalData {
  month: number
  year: number
  monthName: string
  label: string
  conversions: number
  revenue: number
  disbursal: number
  leads: number
  conversionRate: number
  targetConversions: number
  targetRevenue: number
  conversionAchievement: number
  revenueAchievement: number
  overallAchievement: number
  activeBDEs: number
  teamSize: number
}

interface LocalTrendPoint {
  month: string
  value: number
  target?: number
}

interface LocalTeamTrends {
  conversions: LocalTrendPoint[]
  revenue: LocalTrendPoint[]
  conversionRate: LocalTrendPoint[]
}

interface LocalBDETrendData {
  month: string
  conversions: number
  revenue: number
}

interface LocalBDETrend {
  bdeId: string
  bdeName: string
  data: LocalBDETrendData[]
}

interface LocalMoMMetricComparison {
  current: number
  previous: number
  change: number
  changePercentage: number
}

interface LocalMoMRateComparison {
  current: number
  previous: number
  change: number
}

interface LocalMoMComparison {
  month: string
  conversions: LocalMoMMetricComparison
  revenue: LocalMoMMetricComparison
  conversionRate: LocalMoMRateComparison
}

interface LocalSeasonalPattern {
  period: string
  periodType: string
  avgConversions: number
  avgRevenue: number
  avgConversionRate: number
  trend: 'increasing' | 'decreasing'
}

interface LocalHistoricalInsight {
  id: string
  type: 'strength' | 'alert' | 'recommendation'
  title: string
  description: string
  icon: string
}

interface LocalPeriodInfo {
  monthsAnalyzed: number
  startMonth: number
  startYear: number
  endMonth: number
  endYear: number
}

interface LocalHistoricalAnalysisResponse {
  success: boolean
  data: {
    monthlyData: LocalMonthlyHistoricalData[]
    teamTrends: LocalTeamTrends
    bdeTrends: Record<string, LocalBDETrend>
    momComparison: LocalMoMComparison[]
    seasonalPatterns: LocalSeasonalPattern[]
    insights: LocalHistoricalInsight[]
    periodInfo: LocalPeriodInfo
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
    const monthsParam = searchParams.get('months') || '12'
    const months = Math.min(parseInt(monthsParam), 24) // Max 24 months

    const currentMonthInfo = getCurrentMonthInfo()
    const currentYear = currentMonthInfo.year
    const currentMonth = currentMonthInfo.month

    // =========================================================================
    // 3. FETCH TEAM BDEs
    // =========================================================================

    const { data: teamBDEs, error: teamError } = await supabase
      .from('users')
      .select('id, name')
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
          monthlyData: [],
          teamTrends: {
            conversions: [],
            revenue: [],
            conversionRate: [],
          },
          bdeTrends: {},
          momComparison: [],
          seasonalPatterns: [],
          insights: [],
          periodInfo: {
            monthsAnalyzed: 0,
            startMonth: currentMonth,
            startYear: currentYear,
            endMonth: currentMonth,
            endYear: currentYear,
          },
          lastUpdated: new Date().toISOString(),
        },
      })
    }

    const teamBDEIds = teamBDEs.map((bde) => bde.id)

    // =========================================================================
    // 4. CALCULATE DATE RANGE
    // =========================================================================

    const historicalMonths: Array<{ month: number; year: number }> = []
    let tempMonth = currentMonth
    let tempYear = currentYear

    for (let i = 0; i < months; i++) {
      historicalMonths.push({ month: tempMonth, year: tempYear })
      tempMonth--
      if (tempMonth === 0) {
        tempMonth = 12
        tempYear--
      }
    }

    historicalMonths.reverse() // Oldest to newest

    // =========================================================================
    // 5. FETCH HISTORICAL DATA
    // =========================================================================

    const monthlyDataPromises = historicalMonths.map(async ({ month, year }) => {
      // Fetch targets
      const { data: targets } = await supabase
        .from('bdm_targets')
        .select('*')
        .in('bde_user_id', teamBDEIds)
        .eq('month', month)
        .eq('year', year)

      // Fetch achievements
      const { data: achievements } = await supabase
        .from('bde_daily_achievements')
        .select('*')
        .in('bde_user_id', teamBDEIds)
        .eq('month', month)
        .eq('year', year)

      // Calculate totals
      const totalConversions = achievements?.reduce((sum, a) => sum + (a.conversions || 0), 0) || 0
      const totalRevenue = achievements?.reduce((sum, a) => sum + (a.revenue || 0), 0) || 0
      const totalLeads = achievements?.reduce((sum, a) => sum + (a.leads_generated || 0), 0) || 0
      const totalDisbursal = achievements?.reduce((sum, a) => sum + (a.disbursal || 0), 0) || 0

      const targetConversions = targets?.reduce((sum, t) => sum + (t.conversions_target || 0), 0) || 0
      const targetRevenue = targets?.reduce((sum, t) => sum + (t.revenue_target || 0), 0) || 0

      const conversionAchievement = calculateAchievementPercentage(totalConversions, targetConversions)
      const revenueAchievement = calculateAchievementPercentage(totalRevenue, targetRevenue)
      const conversionRate = totalLeads > 0 ? (totalConversions / totalLeads) * 100 : 0

      // Count active BDEs
      const activeBDEs = new Set(achievements?.map(a => a.bde_user_id) || []).size

      return {
        month,
        year,
        monthName: getMonthName(month),
        label: `${getMonthName(month).slice(0, 3)} ${year}`,
        conversions: totalConversions,
        revenue: totalRevenue,
        disbursal: totalDisbursal,
        leads: totalLeads,
        conversionRate,
        targetConversions,
        targetRevenue,
        conversionAchievement,
        revenueAchievement,
        overallAchievement: Math.round((conversionAchievement + revenueAchievement) / 2),
        activeBDEs,
        teamSize: teamBDEIds.length,
      }
    })

    const monthlyData: LocalMonthlyHistoricalData[] = await Promise.all(monthlyDataPromises)

    // =========================================================================
    // 6. BUILD TEAM TRENDS
    // =========================================================================

    const teamTrends: LocalTeamTrends = {
      conversions: monthlyData.map((m) => ({
        month: m.label,
        value: m.conversions,
        target: m.targetConversions,
      })),
      revenue: monthlyData.map((m) => ({
        month: m.label,
        value: m.revenue,
        target: m.targetRevenue,
      })),
      conversionRate: monthlyData.map((m) => ({
        month: m.label,
        value: m.conversionRate,
      })),
    }

    // =========================================================================
    // 7. BUILD BDE TRENDS (Top 5 BDEs)
    // =========================================================================

    const bdeTrendsMap: Record<string, LocalBDETrend> = {}

    for (const bde of teamBDEs.slice(0, 5)) {
      const bdeTrendData: LocalBDETrendData[] = await Promise.all(
        historicalMonths.map(async ({ month, year }) => {
          const { data: achievements } = await supabase
            .from('bde_daily_achievements')
            .select('*')
            .eq('bde_user_id', bde.id)
            .eq('month', month)
            .eq('year', year)

          const conversions = achievements?.reduce((sum, a) => sum + (a.conversions || 0), 0) || 0
          const revenue = achievements?.reduce((sum, a) => sum + (a.revenue || 0), 0) || 0

          return {
            month: `${getMonthName(month).slice(0, 3)} ${year}`,
            conversions,
            revenue,
          }
        })
      )

      bdeTrendsMap[bde.id] = {
        bdeId: bde.id,
        bdeName: bde.name || 'Unknown',
        data: bdeTrendData,
      }
    }

    // =========================================================================
    // 8. CALCULATE MoM COMPARISONS
    // =========================================================================

    const momComparison: LocalMoMComparison[] = monthlyData.slice(1).map((current, index) => {
      const previous = monthlyData[index]

      const conversionChange = current.conversions - previous.conversions
      const revenueChange = current.revenue - previous.revenue
      const conversionRateChange = current.conversionRate - previous.conversionRate

      return {
        month: current.label,
        conversions: {
          current: current.conversions,
          previous: previous.conversions,
          change: conversionChange,
          changePercentage: previous.conversions > 0
            ? ((conversionChange / previous.conversions) * 100)
            : 0,
        },
        revenue: {
          current: current.revenue,
          previous: previous.revenue,
          change: revenueChange,
          changePercentage: previous.revenue > 0
            ? ((revenueChange / previous.revenue) * 100)
            : 0,
        },
        conversionRate: {
          current: current.conversionRate,
          previous: previous.conversionRate,
          change: conversionRateChange,
        },
      }
    })

    // =========================================================================
    // 9. IDENTIFY SEASONAL PATTERNS
    // =========================================================================

    const seasonalPatterns: LocalSeasonalPattern[] = []

    // Group by quarter
    const quarters: Record<string, LocalMonthlyHistoricalData[]> = {}
    monthlyData.forEach((data) => {
      const quarter = Math.ceil(data.month / 3)
      const key = `Q${quarter} ${data.year}`
      if (!quarters[key]) quarters[key] = []
      quarters[key].push(data)
    })

    Object.entries(quarters).forEach(([quarter, data]) => {
      if (data.length >= 2) {
        const avgConversions = data.reduce((sum, d) => sum + d.conversions, 0) / data.length
        const avgRevenue = data.reduce((sum, d) => sum + d.revenue, 0) / data.length
        const avgConversionRate = data.reduce((sum, d) => sum + d.conversionRate, 0) / data.length

        seasonalPatterns.push({
          period: quarter,
          periodType: 'quarter',
          avgConversions,
          avgRevenue,
          avgConversionRate,
          trend: data.length > 1 && data[data.length - 1].conversions > data[0].conversions
            ? 'increasing'
            : 'decreasing',
        })
      }
    })

    // =========================================================================
    // 10. GENERATE INSIGHTS
    // =========================================================================

    const insights: LocalHistoricalInsight[] = []

    // Best performing month
    const bestMonth = monthlyData.reduce((best, current) =>
      current.overallAchievement > best.overallAchievement ? current : best
    )
    insights.push({
      id: 'best-month',
      type: 'strength',
      title: `Best Month: ${bestMonth.monthName} ${bestMonth.year}`,
      description: `Achieved ${bestMonth.overallAchievement}% of targets with ${bestMonth.conversions} conversions and ${formatCurrency(bestMonth.revenue, true)} revenue.`,
      icon: 'Trophy',
    })

    // Trend analysis
    if (monthlyData.length >= 3) {
      const recent3 = monthlyData.slice(-3)
      const avgRecent = recent3.reduce((sum, d) => sum + d.overallAchievement, 0) / 3
      const older3 = monthlyData.slice(Math.max(0, monthlyData.length - 6), monthlyData.length - 3)
      const avgOlder = older3.length > 0
        ? older3.reduce((sum, d) => sum + d.overallAchievement, 0) / older3.length
        : avgRecent

      if (avgRecent > avgOlder + 10) {
        insights.push({
          id: 'improving-trend',
          type: 'strength',
          title: 'Improving Performance Trend',
          description: `Team performance has improved by ${(avgRecent - avgOlder).toFixed(1)}% over the last 3 months compared to previous period.`,
          icon: 'TrendingUp',
        })
      } else if (avgRecent < avgOlder - 10) {
        insights.push({
          id: 'declining-trend',
          type: 'alert',
          title: 'Declining Performance Trend',
          description: `Team performance has declined by ${(avgOlder - avgRecent).toFixed(1)}% over the last 3 months. Review and address issues.`,
          icon: 'AlertTriangle',
        })
      }
    }

    // Consistency check
    const achievementStdDev = calculateStdDev(monthlyData.map(d => d.overallAchievement))
    if (achievementStdDev < 10) {
      insights.push({
        id: 'consistent-performance',
        type: 'strength',
        title: 'Consistent Performance',
        description: `Team maintains stable performance with low variance (±${achievementStdDev.toFixed(1)}%).`,
        icon: 'CheckCircle',
      })
    } else if (achievementStdDev > 25) {
      insights.push({
        id: 'inconsistent-performance',
        type: 'recommendation',
        title: 'Performance Volatility',
        description: `High performance variance detected (±${achievementStdDev.toFixed(1)}%). Focus on consistency.`,
        icon: 'Lightbulb',
      })
    }

    // =========================================================================
    // 11. BUILD RESPONSE
    // =========================================================================

    const response: LocalHistoricalAnalysisResponse = {
      success: true,
      data: {
        monthlyData,
        teamTrends,
        bdeTrends: bdeTrendsMap,
        momComparison,
        seasonalPatterns,
        insights,
        periodInfo: {
          monthsAnalyzed: monthlyData.length,
          startMonth: historicalMonths[0].month,
          startYear: historicalMonths[0].year,
          endMonth: currentMonth,
          endYear: currentYear,
        },
        lastUpdated: new Date().toISOString(),
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    apiLogger.error('Error in historical analysis API', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}

function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length
  const squaredDiffs = values.map((val) => Math.pow(val - mean, 2))
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length
  return Math.sqrt(variance)
}
