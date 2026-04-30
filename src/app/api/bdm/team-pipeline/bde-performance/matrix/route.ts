
/**
 * BDM Team Pipeline - BDE Performance Matrix API
 * GET /api/bdm/team-pipeline/bde-performance/matrix
 *
 * Returns performance matrix comparing all BDEs across key metrics
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBDMId, getBDEIds, getBDEsByIds } from '@/lib/bdm/bde-utils'
import { getDateRangeFilter, parseDateRangeParams } from '@/lib/bdm/date-utils'
import { apiLogger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    // 1. Verify user is BDM
    const bdmId = await getCurrentBDMId()
    if (!bdmId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - BDM role required' },
        { status: 401 }
      )
    }

    // 2. Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const { range, startDate, endDate } = parseDateRangeParams(searchParams)
    const sortBy = searchParams.get('sortBy') || 'conversion_rate' // conversion_rate, revenue, lead_count, avg_tat
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // 3. Get BDEs under this BDM
    const bdeIds = await getBDEIds(bdmId)

    if (bdeIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          matrix: [],
          teamAverage: null,
        },
      })
    }

    // 4. Get BDE details
    const bdes = await getBDEsByIds(bdeIds)

    // 5. Get date range
    const dateRange = getDateRangeFilter(range, startDate, endDate)
    const comparisonRange = getComparisonDateRange(dateRange)
    const supabase = createClient()

    // 6. Fetch performance snapshots for current period
    const { data: currentSnapshots, error: currentError } = await supabase
      .from('bde_performance_snapshots')
      .select('*')
      .in('bde_user_id', bdeIds)
      .gte('snapshot_date', dateRange.start.toISOString())
      .lte('snapshot_date', dateRange.end.toISOString())

    if (currentError) {
      apiLogger.error('[Performance Matrix API] Error fetching current snapshots', currentError)
      throw new Error(`Failed to fetch snapshots: ${currentError.message}`)
    }

    // 7. Fetch performance snapshots for comparison period
    const { data: comparisonSnapshots } = await supabase
      .from('bde_performance_snapshots')
      .select('*')
      .in('bde_user_id', bdeIds)
      .gte('snapshot_date', comparisonRange.start.toISOString())
      .lte('snapshot_date', comparisonRange.end.toISOString())

    // 8. Aggregate metrics for each BDE
    const bdeMetrics = bdes.map(bde => {
      const bdeCurrentSnaps = currentSnapshots?.filter(s => s.bde_user_id === bde.id) || []
      const bdeComparisonSnaps = comparisonSnapshots?.filter(s => s.bde_user_id === bde.id) || []

      // Current period metrics
      const currentLeadCount = bdeCurrentSnaps.reduce((sum, s) => sum + (s.total_leads || 0), 0)
      const currentConversions = bdeCurrentSnaps.reduce((sum, s) => sum + (s.conversions || 0), 0)
      const currentRevenue = bdeCurrentSnaps.reduce((sum, s) => sum + (s.total_revenue || 0), 0)
      const currentDocsPending = bdeCurrentSnaps.reduce((sum, s) => sum + (s.documents_pending || 0), 0)
      const currentAtRisk = bdeCurrentSnaps.reduce((sum, s) => sum + (s.at_risk_leads || 0), 0)

      // Average TAT calculation
      const tatValues = bdeCurrentSnaps
        .map(s => s.avg_turnaround_time)
        .filter(tat => tat !== null && tat !== undefined)
      const currentAvgTat = tatValues.length > 0
        ? tatValues.reduce((sum, tat) => sum + tat, 0) / tatValues.length
        : 0

      // Conversion rate
      const currentConversionRate = currentLeadCount > 0 ? (currentConversions / currentLeadCount) * 100 : 0

      // Average deal size
      const currentAvgDealSize = currentConversions > 0 ? currentRevenue / currentConversions : 0

      // Comparison period metrics
      const comparisonLeadCount = bdeComparisonSnaps.reduce((sum, s) => sum + (s.total_leads || 0), 0)
      const comparisonConversions = bdeComparisonSnaps.reduce((sum, s) => sum + (s.conversions || 0), 0)
      const comparisonRevenue = bdeComparisonSnaps.reduce((sum, s) => sum + (s.total_revenue || 0), 0)
      const comparisonConversionRate = comparisonLeadCount > 0 ? (comparisonConversions / comparisonLeadCount) * 100 : 0

      // Calculate trends
      const conversionTrend = calculateTrend(currentConversionRate, comparisonConversionRate)
      const revenueTrend = calculateTrend(currentRevenue, comparisonRevenue)
      const leadCountTrend = calculateTrend(currentLeadCount, comparisonLeadCount)

      // Performance score (weighted composite)
      const performanceScore = calculatePerformanceScore({
        conversionRate: currentConversionRate,
        revenue: currentRevenue,
        leadCount: currentLeadCount,
        avgTat: currentAvgTat,
        atRiskLeads: currentAtRisk,
      })

      return {
        bdeId: bde.id,
        bdeName: bde.full_name,
        bdeEmail: bde.email,
        bdeAvatar: bde.avatar_url,

        // Key metrics
        leadCount: currentLeadCount,
        conversions: currentConversions,
        conversionRate: Math.round(currentConversionRate * 10) / 10,
        revenue: currentRevenue,
        formattedRevenue: formatCurrency(currentRevenue),
        avgDealSize: currentAvgDealSize,
        formattedAvgDealSize: formatCurrency(currentAvgDealSize),
        avgTat: Math.round(currentAvgTat * 10) / 10,
        documentsPending: currentDocsPending,
        atRiskLeads: currentAtRisk,

        // Trends
        conversionTrend: conversionTrend.direction,
        conversionTrendPercent: conversionTrend.changePercentage,
        revenueTrend: revenueTrend.direction,
        revenueTrendPercent: revenueTrend.changePercentage,
        leadCountTrend: leadCountTrend.direction,
        leadCountTrendPercent: leadCountTrend.changePercentage,

        // Performance indicators
        performanceScore,
        performanceLevel: getPerformanceLevel(performanceScore),
        performanceColor: getPerformanceColor(performanceScore),

        // Ranking (will be calculated after sorting)
        rank: 0,
      }
    })

    // 9. Sort by selected metric
    bdeMetrics.sort((a, b) => {
      let aValue: number, bValue: number

      switch (sortBy) {
        case 'conversion_rate':
          aValue = a.conversionRate
          bValue = b.conversionRate
          break
        case 'revenue':
          aValue = a.revenue
          bValue = b.revenue
          break
        case 'lead_count':
          aValue = a.leadCount
          bValue = b.leadCount
          break
        case 'avg_tat':
          aValue = a.avgTat
          bValue = b.avgTat
          break
        case 'performance_score':
          aValue = a.performanceScore
          bValue = b.performanceScore
          break
        default:
          aValue = a.performanceScore
          bValue = b.performanceScore
      }

      return sortOrder === 'desc' ? bValue - aValue : aValue - bValue
    })

    // 10. Assign ranks
    bdeMetrics.forEach((bde, index) => {
      bde.rank = index + 1
    })

    // 11. Calculate team averages
    const teamAverage = {
      leadCount: Math.round(bdeMetrics.reduce((sum, bde) => sum + bde.leadCount, 0) / bdeMetrics.length),
      conversions: Math.round(bdeMetrics.reduce((sum, bde) => sum + bde.conversions, 0) / bdeMetrics.length),
      conversionRate: Math.round((bdeMetrics.reduce((sum, bde) => sum + bde.conversionRate, 0) / bdeMetrics.length) * 10) / 10,
      revenue: Math.round(bdeMetrics.reduce((sum, bde) => sum + bde.revenue, 0) / bdeMetrics.length),
      formattedRevenue: formatCurrency(Math.round(bdeMetrics.reduce((sum, bde) => sum + bde.revenue, 0) / bdeMetrics.length)),
      avgDealSize: Math.round(bdeMetrics.reduce((sum, bde) => sum + bde.avgDealSize, 0) / bdeMetrics.length),
      formattedAvgDealSize: formatCurrency(Math.round(bdeMetrics.reduce((sum, bde) => sum + bde.avgDealSize, 0) / bdeMetrics.length)),
      avgTat: Math.round((bdeMetrics.reduce((sum, bde) => sum + bde.avgTat, 0) / bdeMetrics.length) * 10) / 10,
      performanceScore: Math.round(bdeMetrics.reduce((sum, bde) => sum + bde.performanceScore, 0) / bdeMetrics.length),
    }

    // 12. Identify top/bottom performers
    const topPerformers = bdeMetrics.slice(0, 3)
    const bottomPerformers = bdeMetrics.slice(-3).reverse()

    // 13. Return response
    return NextResponse.json({
      success: true,
      data: {
        matrix: bdeMetrics,
        teamAverage,
        topPerformers,
        bottomPerformers,
        filters: {
          dateRange: {
            start: dateRange.start.toISOString(),
            end: dateRange.end.toISOString(),
            type: range,
          },
          sortBy,
          sortOrder,
        },
        metadata: {
          totalBDEs: bdeMetrics.length,
          totalLeads: bdeMetrics.reduce((sum, bde) => sum + bde.leadCount, 0),
          totalConversions: bdeMetrics.reduce((sum, bde) => sum + bde.conversions, 0),
          totalRevenue: bdeMetrics.reduce((sum, bde) => sum + bde.revenue, 0),
        },
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('[Performance Matrix API] Error', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch performance matrix',
      },
      { status: 500 }
    )
  }
}

// Helper functions
function getComparisonDateRange(currentRange: { start: Date; end: Date }) {
  const duration = currentRange.end.getTime() - currentRange.start.getTime()
  const start = new Date(currentRange.start.getTime() - duration)
  const end = new Date(currentRange.end.getTime() - duration)
  return { start, end }
}

function calculateTrend(current: number, previous: number) {
  if (previous === 0) {
    return {
      direction: current > 0 ? ('up' as const) : ('neutral' as const),
      changePercentage: 0,
    }
  }

  const change = ((current - previous) / previous) * 100
  return {
    direction: change > 0 ? ('up' as const) : change < 0 ? ('down' as const) : ('neutral' as const),
    changePercentage: Math.round(Math.abs(change) * 10) / 10,
  }
}

function calculatePerformanceScore(metrics: {
  conversionRate: number
  revenue: number
  leadCount: number
  avgTat: number
  atRiskLeads: number
}): number {
  // Weighted scoring (0-100)
  const conversionScore = Math.min(metrics.conversionRate * 2, 40) // Max 40 points
  const revenueScore = Math.min((metrics.revenue / 10000000) * 30, 30) // Max 30 points (₹1Cr = 30 points)
  const leadScore = Math.min((metrics.leadCount / 50) * 15, 15) // Max 15 points (50 leads = 15 points)
  const tatScore = Math.max(15 - (metrics.avgTat / 2), 0) // Max 15 points (lower TAT = higher score)
  const riskPenalty = metrics.atRiskLeads * -0.5 // Penalty for at-risk leads

  const totalScore = conversionScore + revenueScore + leadScore + tatScore + riskPenalty
  return Math.max(0, Math.min(100, Math.round(totalScore)))
}

function getPerformanceLevel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Average'
  if (score >= 20) return 'Below Average'
  return 'Needs Improvement'
}

function getPerformanceColor(score: number): string {
  if (score >= 80) return '#10B981' // Green
  if (score >= 60) return '#3B82F6' // Blue
  if (score >= 40) return '#F59E0B' // Orange
  if (score >= 20) return '#EF4444' // Red
  return '#DC2626' // Dark Red
}

function formatCurrency(amount: number): string {
  if (!amount) return '₹0'
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`
  } else if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)} L`
  }
  return `₹${amount.toLocaleString('en-IN')}`
}
