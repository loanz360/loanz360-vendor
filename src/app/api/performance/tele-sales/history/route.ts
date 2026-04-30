import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { PerformanceGrade } from '@/lib/types/performance.types'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/performance/tele-sales/history
 * Returns historical performance data for Tele Sales employees
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
      .select('sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || profile.sub_role !== 'TELE_SALES') {
      return NextResponse.json(
        { error: 'Access denied. This endpoint is for Tele Sales employees only.' },
        { status: 403 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const months = parseInt(searchParams.get('months') || '12')

    // Fetch monthly summaries for past months
    const { data: historicalData, error: historyError } = await supabase
      .from('tele_sales_monthly_summary')
      .select('*')
      .eq('user_id', user.id)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(months)

    if (historyError) {
      apiLogger.error('Error fetching history', historyError)
    }

    // Format history data
    const history = (historicalData || []).map((entry) => ({
      period: formatPeriod(entry.month, entry.year),
      month: entry.month,
      year: entry.year,
      overallScore: entry.performance_score || 0,
      grade: entry.performance_grade || calculateGrade(entry.performance_score || 0),
      rank: entry.company_rank || 0,
      totalEmployees: entry.total_employees || 1,
      targetAchievement: entry.target_achievement_percentage || 0,
      highlights: generateHighlights(entry),
      metrics: {
        totalRevenue: entry.total_revenue || 0,
        totalCalls: entry.total_calls || 0,
        leadsConverted: entry.leads_converted || 0,
        conversionRate: entry.conversion_rate || 0,
        avgCallQuality: entry.avg_call_quality_score || 0,
        customerSatisfaction: entry.avg_customer_satisfaction || 0,
      },
      trend: calculateHistoryTrend(historicalData || [], entry),
    }))

    // If no historical data exists, generate placeholder for current and previous months
    if (history.length === 0) {
      const now = new Date()
      const placeholderHistory = []

      for (let i = 0; i < Math.min(months, 3); i++) {
        const month = now.getMonth() + 1 - i
        const year = now.getFullYear()
        const adjustedMonth = month <= 0 ? month + 12 : month
        const adjustedYear = month <= 0 ? year - 1 : year

        // Only add months before current
        if (i > 0) {
          placeholderHistory.push({
            period: formatPeriod(adjustedMonth, adjustedYear),
            month: adjustedMonth,
            year: adjustedYear,
            overallScore: 0,
            grade: 'F' as PerformanceGrade,
            rank: 0,
            totalEmployees: 1,
            targetAchievement: 0,
            highlights: ['No data available for this period'],
            metrics: {
              totalRevenue: 0,
              totalCalls: 0,
              leadsConverted: 0,
              conversionRate: 0,
              avgCallQuality: 0,
              customerSatisfaction: 0,
            },
            trend: 'stable' as const,
          })
        }
      }

      return NextResponse.json({
        history: placeholderHistory,
        totalMonths: placeholderHistory.length,
        message: 'No historical performance data available yet.',
      })
    }

    // Calculate performance trend over time
    const performanceTrend = calculatePerformanceTrend(history)

    return NextResponse.json({
      history,
      totalMonths: history.length,
      performanceTrend,
      summary: {
        bestMonth: findBestMonth(history),
        averageScore: calculateAverageScore(history),
        averageRank: calculateAverageRank(history),
        improvementRate: calculateImprovementRate(history),
      },
    })
  } catch (error: unknown) {
    apiLogger.error('Error in Tele Sales history API', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function formatPeriod(month: number, year: number): string {
  const date = new Date(year, month - 1)
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

function calculateGrade(score: number): PerformanceGrade {
  if (score >= 95) return 'A+'
  if (score >= 90) return 'A'
  if (score >= 85) return 'B+'
  if (score >= 80) return 'B'
  if (score >= 75) return 'C+'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

function generateHighlights(entry: any): string[] {
  const highlights: string[] = []

  // Revenue highlights
  if (entry.total_revenue >= 2000000) {
    highlights.push('Exceeded revenue target by 33%+')
  } else if (entry.total_revenue >= 1500000) {
    highlights.push('Met monthly revenue target')
  }

  // Call volume highlights
  if (entry.total_calls >= 600) {
    highlights.push('Exceptional call volume achieved')
  } else if (entry.total_calls >= 500) {
    highlights.push('Call target achieved')
  }

  // Conversion highlights
  if (entry.conversion_rate >= 40) {
    highlights.push('Outstanding conversion rate')
  } else if (entry.conversion_rate >= 30) {
    highlights.push('Above-average conversion rate')
  }

  // Quality highlights
  if (entry.avg_call_quality_score >= 90) {
    highlights.push('Excellent call quality maintained')
  }

  // Ranking highlights
  if (entry.company_rank === 1) {
    highlights.push('Top performer of the month')
  } else if (entry.company_rank <= 3) {
    highlights.push('Top 3 performer')
  } else if (entry.company_rank <= 5) {
    highlights.push('Top 5 performer')
  }

  // CSAT highlights
  if (entry.avg_customer_satisfaction >= 4.5) {
    highlights.push('Exceptional customer satisfaction')
  }

  // Default if no highlights
  if (highlights.length === 0) {
    highlights.push('Performance data recorded')
  }

  return highlights.slice(0, 4) // Max 4 highlights
}

function calculateHistoryTrend(allData: any[], currentEntry: any): 'up' | 'down' | 'stable' {
  const currentIndex = allData.findIndex(
    (d) => d.month === currentEntry.month && d.year === currentEntry.year
  )

  if (currentIndex >= allData.length - 1) return 'stable'

  const nextEntry = allData[currentIndex + 1] // Next is actually previous month due to DESC order
  if (!nextEntry) return 'stable'

  const scoreDiff = (currentEntry.performance_score || 0) - (nextEntry.performance_score || 0)

  if (scoreDiff > 5) return 'up'
  if (scoreDiff < -5) return 'down'
  return 'stable'
}

function calculatePerformanceTrend(history: any[]): {
  direction: 'improving' | 'declining' | 'stable'
  averageChange: number
  consecutiveImprovements: number
} {
  if (history.length < 2) {
    return { direction: 'stable', averageChange: 0, consecutiveImprovements: 0 }
  }

  let totalChange = 0
  let consecutiveImprovements = 0
  let currentStreak = 0

  // History is already sorted descending (most recent first)
  for (let i = 0; i < history.length - 1; i++) {
    const change = history[i].overallScore - history[i + 1].overallScore
    totalChange += change

    if (change > 0) {
      currentStreak++
      consecutiveImprovements = Math.max(consecutiveImprovements, currentStreak)
    } else {
      currentStreak = 0
    }
  }

  const averageChange = totalChange / (history.length - 1)

  return {
    direction: averageChange > 3 ? 'improving' : averageChange < -3 ? 'declining' : 'stable',
    averageChange: Math.round(averageChange * 10) / 10,
    consecutiveImprovements,
  }
}

function findBestMonth(history: any[]): { period: string; score: number } | null {
  if (history.length === 0) return null

  const best = history.reduce((max, current) =>
    current.overallScore > max.overallScore ? current : max
  )

  return { period: best.period, score: best.overallScore }
}

function calculateAverageScore(history: any[]): number {
  if (history.length === 0) return 0
  const total = history.reduce((sum, h) => sum + h.overallScore, 0)
  return Math.round((total / history.length) * 10) / 10
}

function calculateAverageRank(history: any[]): number {
  const rankedHistory = history.filter((h) => h.rank > 0)
  if (rankedHistory.length === 0) return 0
  const total = rankedHistory.reduce((sum, h) => sum + h.rank, 0)
  return Math.round(total / rankedHistory.length)
}

function calculateImprovementRate(history: any[]): number {
  if (history.length < 2) return 0

  let improvements = 0
  for (let i = 0; i < history.length - 1; i++) {
    if (history[i].overallScore > history[i + 1].overallScore) {
      improvements++
    }
  }

  return Math.round((improvements / (history.length - 1)) * 100)
}
