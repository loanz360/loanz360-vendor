import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/performance/digital-sales/history-extended
 * Returns extended historical performance data (up to 5 years)
 * Query params:
 *   - years: number of years to fetch (default 5, max 5)
 *   - groupBy: 'month' | 'quarter' | 'year' (default 'month')
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

    // Parse query params
    const { searchParams } = new URL(request.url)
    const yearsParam = parseInt(searchParams.get('years') || '5')
    const years = Math.min(Math.max(1, yearsParam), 5)
    const groupBy = searchParams.get('groupBy') || 'month'

    const currentYear = new Date().getFullYear()
    const startYear = currentYear - years + 1

    // Fetch all monthly summaries within the range
    const { data: summaries, error: summariesError } = await supabase
      .from('digital_sales_monthly_summary')
      .select('*')
      .eq('user_id', user.id)
      .gte('year', startYear)
      .order('year', { ascending: true })
      .order('month', { ascending: true })

    if (summariesError) {
      apiLogger.error('Error fetching summaries', summariesError)
      return NextResponse.json(
        { error: 'Failed to fetch historical data' },
        { status: 500 }
      )
    }

    // Format based on groupBy parameter
    let formattedData: any[] = []

    if (groupBy === 'month') {
      formattedData = (summaries || []).map(s => ({
        period: `${getMonthName(s.month)} ${s.year}`,
        periodKey: `${s.year}-${String(s.month).padStart(2, '0')}`,
        month: s.month,
        year: s.year,
        metrics: {
          leads: s.total_digital_leads || s.total_leads || 0,
          websiteLeads: s.total_website_leads || 0,
          socialLeads: s.total_social_media_leads || s.total_social_leads || 0,
          emailLeads: s.total_email_campaign_leads || s.total_email_leads || 0,
          conversions: s.total_conversions || 0,
          revenue: s.total_revenue || 0,
          conversionRate: s.digital_conversion_rate || s.overall_conversion_rate || 0,
          avgDealSize: s.average_deal_size || 0,
          campaigns: s.total_campaigns_launched || 0,
          emailOpenRate: s.average_email_open_rate || 0,
        },
        performance: {
          score: s.performance_score || 0,
          grade: s.performance_grade || 'N/A',
          rank: s.company_rank || 0,
          totalEmployees: s.total_employees || 0,
          percentile: s.percentile || 0,
          targetAchievement: s.target_achievement_percentage || 0,
        },
      }))
    } else if (groupBy === 'quarter') {
      const quarterlyData: Record<string, any> = {}

      (summaries || []).forEach(s => {
        const quarter = Math.ceil(s.month / 3)
        const key = `${s.year}-Q${quarter}`

        if (!quarterlyData[key]) {
          quarterlyData[key] = {
            period: `Q${quarter} ${s.year}`,
            periodKey: key,
            quarter,
            year: s.year,
            months: [],
            metrics: {
              leads: 0,
              websiteLeads: 0,
              socialLeads: 0,
              emailLeads: 0,
              conversions: 0,
              revenue: 0,
            },
            performance: {
              scoreSum: 0,
              count: 0,
              bestGrade: 'F',
              rankSum: 0,
            },
          }
        }

        const q = quarterlyData[key]
        q.months.push(s.month)
        q.metrics.leads += s.total_digital_leads || s.total_leads || 0
        q.metrics.websiteLeads += s.total_website_leads || 0
        q.metrics.socialLeads += s.total_social_media_leads || s.total_social_leads || 0
        q.metrics.emailLeads += s.total_email_campaign_leads || s.total_email_leads || 0
        q.metrics.conversions += s.total_conversions || 0
        q.metrics.revenue += s.total_revenue || 0
        q.performance.scoreSum += s.performance_score || 0
        q.performance.count++
        q.performance.rankSum += s.company_rank || 0

        if (compareGrades(s.performance_grade, q.performance.bestGrade) > 0) {
          q.performance.bestGrade = s.performance_grade
        }
      })

      formattedData = Object.values(quarterlyData).map(q => ({
        period: q.period,
        periodKey: q.periodKey,
        quarter: q.quarter,
        year: q.year,
        monthsIncluded: q.months.length,
        metrics: {
          ...q.metrics,
          conversionRate: q.metrics.leads > 0 ? (q.metrics.conversions / q.metrics.leads) * 100 : 0,
          avgDealSize: q.metrics.conversions > 0 ? q.metrics.revenue / q.metrics.conversions : 0,
        },
        performance: {
          avgScore: q.performance.count > 0 ? Math.round(q.performance.scoreSum / q.performance.count) : 0,
          bestGrade: q.performance.bestGrade,
          avgRank: q.performance.count > 0 ? Math.round(q.performance.rankSum / q.performance.count) : 0,
        },
      }))
    } else if (groupBy === 'year') {
      const yearlyData: Record<number, any> = {}

      (summaries || []).forEach(s => {
        if (!yearlyData[s.year]) {
          yearlyData[s.year] = {
            period: String(s.year),
            periodKey: String(s.year),
            year: s.year,
            months: [],
            metrics: {
              leads: 0,
              websiteLeads: 0,
              socialLeads: 0,
              emailLeads: 0,
              conversions: 0,
              revenue: 0,
            },
            performance: {
              scoreSum: 0,
              count: 0,
              bestGrade: 'F',
              gradeDistribution: {} as Record<string, number>,
            },
          }
        }

        const y = yearlyData[s.year]
        y.months.push(s.month)
        y.metrics.leads += s.total_digital_leads || s.total_leads || 0
        y.metrics.websiteLeads += s.total_website_leads || 0
        y.metrics.socialLeads += s.total_social_media_leads || s.total_social_leads || 0
        y.metrics.emailLeads += s.total_email_campaign_leads || s.total_email_leads || 0
        y.metrics.conversions += s.total_conversions || 0
        y.metrics.revenue += s.total_revenue || 0
        y.performance.scoreSum += s.performance_score || 0
        y.performance.count++

        const grade = s.performance_grade || 'N/A'
        y.performance.gradeDistribution[grade] = (y.performance.gradeDistribution[grade] || 0) + 1

        if (compareGrades(s.performance_grade, y.performance.bestGrade) > 0) {
          y.performance.bestGrade = s.performance_grade
        }
      })

      formattedData = Object.values(yearlyData).map(y => ({
        period: y.period,
        periodKey: y.periodKey,
        year: y.year,
        monthsIncluded: y.months.length,
        metrics: {
          ...y.metrics,
          conversionRate: y.metrics.leads > 0 ? (y.metrics.conversions / y.metrics.leads) * 100 : 0,
          avgDealSize: y.metrics.conversions > 0 ? y.metrics.revenue / y.metrics.conversions : 0,
          avgMonthlyLeads: y.months.length > 0 ? Math.round(y.metrics.leads / y.months.length) : 0,
          avgMonthlyRevenue: y.months.length > 0 ? Math.round(y.metrics.revenue / y.months.length) : 0,
        },
        performance: {
          avgScore: y.performance.count > 0 ? Math.round(y.performance.scoreSum / y.performance.count) : 0,
          bestGrade: y.performance.bestGrade,
          gradeDistribution: y.performance.gradeDistribution,
        },
      }))
    }

    // Calculate year-over-year growth
    const yoyGrowth = calculateYoYGrowth(summaries || [])

    // Calculate overall trends
    const trends = calculateTrends(formattedData)

    // Calculate personal bests
    const personalBests = calculatePersonalBests(summaries || [])

    // Get career summary
    const careerSummary = calculateCareerSummary(summaries || [])

    return NextResponse.json({
      userId: user.id,
      userName: profile.full_name,
      dateRange: {
        startYear,
        endYear: currentYear,
        yearsIncluded: years,
      },
      groupBy,
      data: formattedData,
      yearOverYearGrowth: yoyGrowth,
      trends,
      personalBests,
      careerSummary,
    })
  } catch (error: unknown) {
    apiLogger.error('Error in extended history API', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function getMonthName(month: number): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return months[month - 1] || ''
}

function compareGrades(a: string | null, b: string | null): number {
  const gradeOrder: Record<string, number> = {
    'A+': 8, 'A': 7, 'B+': 6, 'B': 5, 'C+': 4, 'C': 3, 'D': 2, 'F': 1, 'N/A': 0,
  }
  return (gradeOrder[a || 'N/A'] || 0) - (gradeOrder[b || 'N/A'] || 0)
}

function calculateYoYGrowth(summaries: any[]): any[] {
  const yearlyTotals: Record<number, { leads: number, revenue: number, months: number }> = {}

  summaries.forEach(s => {
    if (!yearlyTotals[s.year]) {
      yearlyTotals[s.year] = { leads: 0, revenue: 0, months: 0 }
    }
    yearlyTotals[s.year].leads += s.total_digital_leads || s.total_leads || 0
    yearlyTotals[s.year].revenue += s.total_revenue || 0
    yearlyTotals[s.year].months++
  })

  const years = Object.keys(yearlyTotals).map(Number).sort()
  const growth: any[] = []

  for (let i = 1; i < years.length; i++) {
    const currentYear = years[i]
    const prevYear = years[i - 1]
    const current = yearlyTotals[currentYear]
    const prev = yearlyTotals[prevYear]

    // Normalize by months to handle partial years
    const currentAvgLeads = current.leads / current.months
    const prevAvgLeads = prev.leads / prev.months
    const currentAvgRevenue = current.revenue / current.months
    const prevAvgRevenue = prev.revenue / prev.months

    growth.push({
      year: currentYear,
      vsYear: prevYear,
      leadsGrowth: prevAvgLeads > 0 ? ((currentAvgLeads - prevAvgLeads) / prevAvgLeads) * 100 : 0,
      revenueGrowth: prevAvgRevenue > 0 ? ((currentAvgRevenue - prevAvgRevenue) / prevAvgRevenue) * 100 : 0,
    })
  }

  return growth
}

function calculateTrends(data: any[]): any {
  if (data.length < 3) {
    return { trend: 'insufficient_data', message: 'Need more data for trend analysis' }
  }

  const recent = data.slice(-6)
  const older = data.slice(-12, -6)

  if (older.length === 0) {
    return { trend: 'insufficient_data', message: 'Need more data for trend analysis' }
  }

  const recentAvgRevenue = recent.reduce((sum, d) => sum + (d.metrics?.revenue || 0), 0) / recent.length
  const olderAvgRevenue = older.reduce((sum, d) => sum + (d.metrics?.revenue || 0), 0) / older.length

  const recentAvgLeads = recent.reduce((sum, d) => sum + (d.metrics?.leads || 0), 0) / recent.length
  const olderAvgLeads = older.reduce((sum, d) => sum + (d.metrics?.leads || 0), 0) / older.length

  const revenueChange = olderAvgRevenue > 0 ? ((recentAvgRevenue - olderAvgRevenue) / olderAvgRevenue) * 100 : 0
  const leadsChange = olderAvgLeads > 0 ? ((recentAvgLeads - olderAvgLeads) / olderAvgLeads) * 100 : 0

  let trend = 'stable'
  if (revenueChange > 10) trend = 'growing'
  else if (revenueChange < -10) trend = 'declining'

  return {
    trend,
    revenueChange: Math.round(revenueChange),
    leadsChange: Math.round(leadsChange),
    message: trend === 'growing' ? 'Your performance is improving!' :
             trend === 'declining' ? 'Performance needs attention' :
             'Performance is stable',
  }
}

function calculatePersonalBests(summaries: any[]): any {
  if (summaries.length === 0) return null

  const bestRevenue = summaries.reduce((best, s) =>
    (s.total_revenue || 0) > (best?.total_revenue || 0) ? s : best, summaries[0])

  const bestLeads = summaries.reduce((best, s) =>
    (s.total_digital_leads || s.total_leads || 0) > (best?.total_digital_leads || best?.total_leads || 0) ? s : best, summaries[0])

  const bestScore = summaries.reduce((best, s) =>
    (s.performance_score || 0) > (best?.performance_score || 0) ? s : best, summaries[0])

  const bestRank = summaries.reduce((best, s) =>
    s.company_rank && (!best?.company_rank || s.company_rank < best.company_rank) ? s : best, summaries[0])

  return {
    highestRevenue: {
      value: bestRevenue?.total_revenue || 0,
      period: `${getMonthName(bestRevenue?.month)} ${bestRevenue?.year}`,
    },
    highestLeads: {
      value: bestLeads?.total_digital_leads || bestLeads?.total_leads || 0,
      period: `${getMonthName(bestLeads?.month)} ${bestLeads?.year}`,
    },
    highestScore: {
      value: bestScore?.performance_score || 0,
      grade: bestScore?.performance_grade || 'N/A',
      period: `${getMonthName(bestScore?.month)} ${bestScore?.year}`,
    },
    bestRank: {
      value: bestRank?.company_rank || 0,
      period: `${getMonthName(bestRank?.month)} ${bestRank?.year}`,
    },
  }
}

function calculateCareerSummary(summaries: any[]): any {
  if (summaries.length === 0) return null

  const totalRevenue = summaries.reduce((sum, s) => sum + (s.total_revenue || 0), 0)
  const totalLeads = summaries.reduce((sum, s) => sum + (s.total_digital_leads || s.total_leads || 0), 0)
  const totalConversions = summaries.reduce((sum, s) => sum + (s.total_conversions || 0), 0)

  const gradeCount: Record<string, number> = {}
  summaries.forEach(s => {
    const grade = s.performance_grade || 'N/A'
    gradeCount[grade] = (gradeCount[grade] || 0) + 1
  })

  const avgScore = summaries.length > 0
    ? summaries.reduce((sum, s) => sum + (s.performance_score || 0), 0) / summaries.length
    : 0

  return {
    totalMonths: summaries.length,
    totalRevenue,
    totalLeads,
    totalConversions,
    avgConversionRate: totalLeads > 0 ? (totalConversions / totalLeads) * 100 : 0,
    avgMonthlyRevenue: summaries.length > 0 ? totalRevenue / summaries.length : 0,
    avgMonthlyLeads: summaries.length > 0 ? totalLeads / summaries.length : 0,
    avgScore: Math.round(avgScore),
    gradeDistribution: gradeCount,
    mostCommonGrade: Object.entries(gradeCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A',
  }
}
