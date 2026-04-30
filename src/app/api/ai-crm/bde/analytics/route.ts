import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'


export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.ANALYTICS)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const userId = user.id

    // Get all deals for this BDE
    const { data: allDeals } = await supabase
      .from('crm_deals')
      .select('*')
      .eq('bde_id', userId)

    const totalDeals = allDeals?.length || 0
    const dealsInProgress =
      allDeals?.filter((d) => d.status === 'in_progress' || d.status === 'new').length || 0
    const dealsSanctioned = allDeals?.filter((d) => d.status === 'sanctioned').length || 0
    const dealsDisbursed = allDeals?.filter((d) => d.status === 'disbursed').length || 0
    const dealsDropped = allDeals?.filter((d) => d.status === 'dropped').length || 0

    // Calculate performance metrics
    const totalSanctionedAmount =
      allDeals
        ?.filter((d) => d.sanctioned_amount > 0)
        .reduce((sum, d) => sum + d.sanctioned_amount, 0) || 0

    const totalDisbursedAmount =
      allDeals
        ?.filter((d) => d.disbursed_amount > 0)
        .reduce((sum, d) => sum + d.disbursed_amount, 0) || 0

    // Calculate average days to sanction
    const sanctionedDeals = allDeals?.filter((d) => d.sanctioned_at) || []
    const avgDaysToSanction =
      sanctionedDeals.length > 0
        ? sanctionedDeals.reduce((sum, d) => {
            const assignedDate = new Date(d.assigned_at)
            const sanctionedDate = new Date(d.sanctioned_at)
            const days = Math.ceil(
              (sanctionedDate.getTime() - assignedDate.getTime()) / (1000 * 60 * 60 * 24)
            )
            return sum + days
          }, 0) / sanctionedDeals.length
        : 0

    // Calculate average days to disburse
    const disbursedDeals = allDeals?.filter((d) => d.disbursed_at) || []
    const avgDaysToDisburse =
      disbursedDeals.length > 0
        ? disbursedDeals.reduce((sum, d) => {
            const assignedDate = new Date(d.assigned_at)
            const disbursedDate = new Date(d.disbursed_at)
            const days = Math.ceil(
              (disbursedDate.getTime() - assignedDate.getTime()) / (1000 * 60 * 60 * 24)
            )
            return sum + days
          }, 0) / disbursedDeals.length
        : 0

    // Calculate conversion rate
    const conversionRate = totalDeals > 0 ? (dealsDisbursed / totalDeals) * 100 : 0

    // Calculate update compliance
    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)

    const dealsWithRecentUpdates =
      allDeals?.filter(
        (d) =>
          d.status === 'in_progress' &&
          d.last_updated_by_bde_at &&
          new Date(d.last_updated_by_bde_at) >= oneDayAgo
      ).length || 0

    const updateCompliance =
      dealsInProgress > 0 ? (dealsWithRecentUpdates / dealsInProgress) * 100 : 100

    // Calculate performance grade
    const timeEfficiencyScore = Math.max(0, 100 - avgDaysToSanction * 2)
    const conversionScore = conversionRate
    const complianceScore = updateCompliance
    const volumeScore = Math.min(100, (dealsSanctioned + dealsDisbursed) * 5)

    const overallScore = Math.round(
      timeEfficiencyScore * 0.3 + conversionScore * 0.3 + complianceScore * 0.2 + volumeScore * 0.2
    )

    const grade = getPerformanceGrade(overallScore)

    // Get percentile rank from performance_metrics
    const { data: metrics } = await supabase
      .from('performance_metrics')
      .select('percentile_rank')
      .eq('user_id', userId)
      .eq('user_role', 'BDE')
      .order('metric_date', { ascending: false })
      .limit(1)

    const percentileRank = metrics?.[0]?.percentile_rank || 50

    // Weekly trends
    const thisWeekStart = new Date()
    thisWeekStart.setDate(thisWeekStart.getDate() - 7)

    const lastWeekStart = new Date()
    lastWeekStart.setDate(lastWeekStart.getDate() - 14)
    const lastWeekEnd = new Date()
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 7)

    const { count: thisWeekAssigned } = await supabase
      .from('crm_deals')
      .select('*', { count: 'exact', head: true })
      .eq('bde_id', userId)
      .gte('assigned_at', thisWeekStart.toISOString())

    const { count: thisWeekSanctioned } = await supabase
      .from('crm_deals')
      .select('*', { count: 'exact', head: true })
      .eq('bde_id', userId)
      .gte('sanctioned_at', thisWeekStart.toISOString())

    const { count: thisWeekDisbursed } = await supabase
      .from('crm_deals')
      .select('*', { count: 'exact', head: true })
      .eq('bde_id', userId)
      .gte('disbursed_at', thisWeekStart.toISOString())

    const { count: lastWeekAssigned } = await supabase
      .from('crm_deals')
      .select('*', { count: 'exact', head: true })
      .eq('bde_id', userId)
      .gte('assigned_at', lastWeekStart.toISOString())
      .lte('assigned_at', lastWeekEnd.toISOString())

    const { count: lastWeekSanctioned } = await supabase
      .from('crm_deals')
      .select('*', { count: 'exact', head: true })
      .eq('bde_id', userId)
      .gte('sanctioned_at', lastWeekStart.toISOString())
      .lte('sanctioned_at', lastWeekEnd.toISOString())

    const { count: lastWeekDisbursed } = await supabase
      .from('crm_deals')
      .select('*', { count: 'exact', head: true })
      .eq('bde_id', userId)
      .gte('disbursed_at', lastWeekStart.toISOString())
      .lte('disbursed_at', lastWeekEnd.toISOString())

    // Stage breakdown
    const stageBreakdown = [
      { stage: 'docs_collected', count: 0, percentage: 0 },
      { stage: 'bank_login', count: 0, percentage: 0 },
      { stage: 'valuation', count: 0, percentage: 0 },
      { stage: 'pd_initiation', count: 0, percentage: 0 },
      { stage: 'credit_manager', count: 0, percentage: 0 },
      { stage: 'sanctions', count: 0, percentage: 0 },
      { stage: 'documentation', count: 0, percentage: 0 },
      { stage: 'final_submission', count: 0, percentage: 0 },
      { stage: 'pre_disbursement', count: 0, percentage: 0 },
      { stage: 'disbursed', count: 0, percentage: 0 },
    ]

    allDeals?.forEach((deal) => {
      const stageIndex = stageBreakdown.findIndex((s) => s.stage === deal.stage)
      if (stageIndex !== -1) {
        stageBreakdown[stageIndex].count++
      }
    })

    stageBreakdown.forEach((stage) => {
      stage.percentage = totalDeals > 0 ? (stage.count / totalDeals) * 100 : 0
    })

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalDeals,
          dealsInProgress,
          dealsSanctioned,
          dealsDisbursed,
          dealsDropped,
        },
        performance: {
          avgDaysToSanction: Math.round(avgDaysToSanction),
          avgDaysToDisburse: Math.round(avgDaysToDisburse),
          conversionRate: Math.round(conversionRate * 10) / 10,
          updateCompliance: Math.round(updateCompliance * 10) / 10,
          totalSanctionedAmount,
          totalDisbursedAmount,
          grade,
          percentileRank,
        },
        trends: {
          thisWeek: {
            dealsAssigned: thisWeekAssigned || 0,
            dealsSanctioned: thisWeekSanctioned || 0,
            dealsDisbursed: thisWeekDisbursed || 0,
          },
          lastWeek: {
            dealsAssigned: lastWeekAssigned || 0,
            dealsSanctioned: lastWeekSanctioned || 0,
            dealsDisbursed: lastWeekDisbursed || 0,
          },
        },
        stageBreakdown: stageBreakdown.filter((s) => s.count > 0),
      },
    })
  } catch (error) {
    apiLogger.error('BDE analytics error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { success: false, message: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}

function getPerformanceGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 60) return 'C'
  if (score >= 45) return 'D'
  return 'F'
}
