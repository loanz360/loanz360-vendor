export const dynamic = 'force-dynamic'

/**
 * BDM Team Pipeline - Analytics Summary API
 * GET /api/bdm/team-pipeline/analytics/summary
 *
 * Returns 6 KPI cards with comparison data
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentBDMId, getBDEIds } from '@/lib/bdm/bde-utils'
import { formatCurrency, formatNumber, calculateGrowthRate } from '@/lib/bdm/analytics'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

function getComparisonLabel(range?: string): string {
  switch (range) {
    case 'week':
      return 'vs last week'
    case 'month':
      return 'vs last month'
    case 'quarter':
      return 'vs last quarter'
    case 'year':
      return 'vs last year'
    default:
      return 'vs previous period'
  }
}

function getTrendFromPercentage(percentage: number): 'up' | 'down' | 'stable' {
  if (Math.abs(percentage) < 5) return 'stable'
  return percentage > 0 ? 'up' : 'down'
}

export async function GET(request: NextRequest) {
  try {
    // 1. Verify user is BDM and get their ID
    const bdmId = await getCurrentBDMId()
    if (!bdmId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - BDM role required' },
        { status: 401 }
      )
    }

    // 2. Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const range = searchParams.get('range') || 'month'
    const bdeIdsParam = searchParams.get('bdeIds')?.split(',').filter(Boolean)

    // 3. Get BDEs under this BDM
    const allBDEIds = await getBDEIds(bdmId)
    const bdeIds = bdeIdsParam && bdeIdsParam.length > 0 ? bdeIdsParam : allBDEIds

    // If no BDEs found, return empty data
    if (bdeIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          totalLeads: {
            value: 0,
            trend: 'stable' as const,
            changePercentage: 0,
            comparisonPeriod: getComparisonLabel(range),
          },
          totalPipelineValue: {
            value: 0,
            formattedValue: formatCurrency(0),
            trend: 'stable' as const,
            changePercentage: 0,
          },
          conversionRate: {
            value: 0,
            trend: 'stable' as const,
            changePercentage: 0,
          },
          avgTurnAroundTime: {
            value: 0,
            trend: 'stable' as const,
            changePercentage: 0,
          },
          documentsPending: {
            value: 0,
            criticalCount: 0,
          },
          atRiskLeads: {
            value: 0,
            breakdown: {
              high: 0,
              medium: 0,
              low: 0,
            },
          },
        },
        timestamp: new Date().toISOString(),
      })
    }

    const supabase = createClient()

    // Calculate date ranges
    const now = new Date()
    let currentStart: Date
    let currentEnd = now
    let previousStart: Date
    let previousEnd: Date

    switch (range) {
      case 'week':
        currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        previousStart = new Date(currentStart.getTime() - 7 * 24 * 60 * 60 * 1000)
        previousEnd = currentStart
        break
      case 'quarter':
        currentStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        previousStart = new Date(currentStart.getTime() - 90 * 24 * 60 * 60 * 1000)
        previousEnd = currentStart
        break
      case 'year':
        currentStart = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        previousStart = new Date(currentStart.getTime() - 365 * 24 * 60 * 60 * 1000)
        previousEnd = currentStart
        break
      default: // month
        currentStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        previousStart = new Date(currentStart.getTime() - 30 * 24 * 60 * 60 * 1000)
        previousEnd = currentStart
    }

    // Fetch current period leads
    const { data: currentLeads } = await supabase
      .from('loanz360_leads')
      .select('id, loan_amount, status, created_at')
      .in('assigned_to_bde', bdeIds)
      .gte('created_at', currentStart.toISOString())
      .lte('created_at', currentEnd.toISOString())

    // Fetch previous period leads
    const { data: previousLeads } = await supabase
      .from('loanz360_leads')
      .select('id, loan_amount, status, created_at')
      .in('assigned_to_bde', bdeIds)
      .gte('created_at', previousStart.toISOString())
      .lte('created_at', previousEnd.toISOString())

    // Calculate metrics
    const currentTotalLeads = currentLeads?.length || 0
    const previousTotalLeads = previousLeads?.length || 0
    const leadsTrendPercentage = calculateGrowthRate(currentTotalLeads, previousTotalLeads)

    const currentPipelineValue = currentLeads?.reduce((sum, lead) => sum + (Number(lead.loan_amount) || 0), 0) || 0
    const previousPipelineValue = previousLeads?.reduce((sum, lead) => sum + (Number(lead.loan_amount) || 0), 0) || 0
    const pipelineTrendPercentage = calculateGrowthRate(currentPipelineValue, previousPipelineValue)

    const currentConversions = currentLeads?.filter(l => l.status === 'DISBURSED').length || 0
    const previousConversions = previousLeads?.filter(l => l.status === 'DISBURSED').length || 0
    const currentConversionRate = currentTotalLeads > 0 ? (currentConversions / currentTotalLeads) * 100 : 0
    const previousConversionRate = previousTotalLeads > 0 ? (previousConversions / previousTotalLeads) * 100 : 0
    const conversionRateTrendPercentage = calculateGrowthRate(currentConversionRate, previousConversionRate)

    // Calculate TAT for disbursed leads
    const currentDisbursed = currentLeads?.filter(l => l.status === 'DISBURSED') || []
    const currentTAT = currentDisbursed.length > 0
      ? currentDisbursed.reduce((sum, lead) => {
          const created = new Date(lead.created_at)
          const daysDiff = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
          return sum + daysDiff
        }, 0) / currentDisbursed.length
      : 0

    const previousDisbursed = previousLeads?.filter(l => l.status === 'DISBURSED') || []
    const previousTAT = previousDisbursed.length > 0
      ? previousDisbursed.reduce((sum, lead) => {
          const created = new Date(lead.created_at)
          const daysDiff = Math.floor((previousEnd.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
          return sum + daysDiff
        }, 0) / previousDisbursed.length
      : 0

    const tatTrendPercentage = calculateGrowthRate(currentTAT, previousTAT)

    // Documents pending
    const { data: docsPending } = await supabase
      .from('loanz360_leads')
      .select('id, status, created_at')
      .in('assigned_to_bde', bdeIds)
      .eq('status', 'DOCUMENTS_PENDING')

    const docsPendingCount = docsPending?.length || 0
    const criticalDocsPending = docsPending?.filter(lead => {
      const created = new Date(lead.created_at)
      const daysSince = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
      return daysSince > 7
    }).length || 0

    // At-risk leads (in progress but inactive for 7+ days)
    const { data: atRiskData } = await supabase
      .from('loanz360_leads')
      .select('id, status, created_at')
      .in('assigned_to_bde', bdeIds)
      .in('status', ['IN_PROGRESS', 'CONTACTED', 'DOCUMENTS_PENDING', 'DOCUMENTS_RECEIVED'])

    const atRiskLeads = atRiskData?.filter(lead => {
      const created = new Date(lead.created_at)
      const daysSince = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
      return daysSince > 7
    }) || []

    const atRiskHigh = atRiskLeads.filter(lead => {
      const created = new Date(lead.created_at)
      const daysSince = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
      return daysSince > 14
    }).length

    const atRiskMedium = atRiskLeads.filter(lead => {
      const created = new Date(lead.created_at)
      const daysSince = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
      return daysSince > 10 && daysSince <= 14
    }).length

    const atRiskLow = atRiskLeads.length - atRiskHigh - atRiskMedium

    // 7. Build response
    return NextResponse.json({
      success: true,
      data: {
        totalLeads: {
          value: currentTotalLeads,
          formattedValue: formatNumber(currentTotalLeads),
          trend: getTrendFromPercentage(leadsTrendPercentage),
          changePercentage: Math.round(leadsTrendPercentage),
          comparisonPeriod: getComparisonLabel(range),
          previousValue: previousTotalLeads,
        },
        totalPipelineValue: {
          value: currentPipelineValue,
          formattedValue: formatCurrency(currentPipelineValue),
          trend: getTrendFromPercentage(pipelineTrendPercentage),
          changePercentage: Math.round(pipelineTrendPercentage),
          comparisonPeriod: getComparisonLabel(range),
          previousValue: previousPipelineValue,
        },
        conversionRate: {
          value: Math.round(currentConversionRate * 10) / 10,
          formattedValue: `${Math.round(currentConversionRate * 10) / 10}%`,
          trend: getTrendFromPercentage(conversionRateTrendPercentage),
          changePercentage: Math.round(conversionRateTrendPercentage),
          comparisonPeriod: getComparisonLabel(range),
          previousValue: Math.round(previousConversionRate * 10) / 10,
        },
        avgTurnAroundTime: {
          value: Math.round(currentTAT),
          formattedValue: `${Math.round(currentTAT)} days`,
          trend: getTrendFromPercentage(-tatTrendPercentage) as 'up' | 'down' | 'stable', // Inverted - lower is better
          changePercentage: Math.round(tatTrendPercentage),
          comparisonPeriod: getComparisonLabel(range),
          previousValue: Math.round(previousTAT),
          note: 'Lower is better',
        },
        documentsPending: {
          value: docsPendingCount,
          formattedValue: formatNumber(docsPendingCount),
          criticalCount: criticalDocsPending,
          criticalFormattedValue: formatNumber(criticalDocsPending),
        },
        atRiskLeads: {
          value: atRiskLeads.length,
          formattedValue: formatNumber(atRiskLeads.length),
          breakdown: {
            high: atRiskHigh,
            medium: atRiskMedium,
            low: atRiskLow,
          },
        },
      },
      metadata: {
        dateRange: {
          start: currentStart.toISOString(),
          end: currentEnd.toISOString(),
          type: range,
        },
        bdeCount: bdeIds.length,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    apiLogger.error('[Analytics Summary API] Error', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch analytics summary',
      },
      { status: 500 }
    )
  }
}
