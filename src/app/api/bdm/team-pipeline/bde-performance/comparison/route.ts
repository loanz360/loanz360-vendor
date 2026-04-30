
/**
 * BDM Team Pipeline - BDE Comparison API
 * GET /api/bdm/team-pipeline/bde-performance/comparison
 *
 * Compare performance of 2-4 BDEs side-by-side
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBDMId, getBDEIds, getBDEsByIds } from '@/lib/bdm/bde-utils'
import { getDateRangeFilter, parseDateRangeParams } from '@/lib/bdm/date-utils'
import { apiLogger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
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
    const bdeIdsParam = searchParams.get('bdeIds')

    if (!bdeIdsParam) {
      return NextResponse.json(
        { success: false, error: 'BDE IDs are required (comma-separated, 2-4 BDEs)' },
        { status: 400 }
      )
    }

    const selectedBdeIds = bdeIdsParam.split(',').filter(Boolean)

    if (selectedBdeIds.length < 2 || selectedBdeIds.length > 4) {
      return NextResponse.json(
        { success: false, error: 'Please select 2-4 BDEs for comparison' },
        { status: 400 }
      )
    }

    const { range, startDate, endDate } = parseDateRangeParams(searchParams)

    // 3. Verify all BDEs are under this BDM
    const bdeIds = await getBDEIds(bdmId)
    const invalidIds = selectedBdeIds.filter(id => !bdeIds.includes(id))

    if (invalidIds.length > 0) {
      return NextResponse.json(
        { success: false, error: 'One or more BDEs are not under your management' },
        { status: 403 }
      )
    }

    // 4. Get BDE details
    const bdes = await getBDEsByIds(selectedBdeIds)

    // 5. Get date range
    const dateRange = getDateRangeFilter(range, startDate, endDate)
    const supabase = createClient()

    // 6. Fetch leads for all selected BDEs
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, assigned_to, status, priority, loan_amount, loan_type, bank_name, created_at, days_in_current_stage')
      .in('assigned_to', selectedBdeIds)
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString())

    if (leadsError) {
      apiLogger.error('[Comparison API] Error fetching leads', leadsError)
      throw new Error(`Failed to fetch leads: ${leadsError.message}`)
    }

    // 7. Fetch timeline events for activity metrics
    const { data: timelineEvents } = await supabase
      .from('lead_timeline_events')
      .select('id, performed_by, event_type, created_at')
      .in('performed_by', selectedBdeIds)
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString())

    // 8. Calculate metrics for each BDE
    const comparisons = bdes.map(bde => {
      const bdeLeads = leads?.filter(l => l.assigned_to === bde.id) || []
      const bdeEvents = timelineEvents?.filter(e => e.performed_by === bde.id) || []

      // Basic metrics
      const totalLeads = bdeLeads.length
      const conversions = bdeLeads.filter(l => l.status === 'DISBURSED').length
      const revenue = bdeLeads
        .filter(l => l.status === 'DISBURSED')
        .reduce((sum, l) => sum + (l.loan_amount || 0), 0)
      const pipelineValue = bdeLeads
        .filter(l => !['REJECTED', 'CANCELLED', 'DISBURSED'].includes(l.status))
        .reduce((sum, l) => sum + (l.loan_amount || 0), 0)

      // Conversion metrics
      const conversionRate = totalLeads > 0 ? (conversions / totalLeads) * 100 : 0
      const avgDealSize = conversions > 0 ? revenue / conversions : 0

      // Stage distribution
      const stageDistribution = {
        new: bdeLeads.filter(l => l.status === 'NEW').length,
        contacted: bdeLeads.filter(l => l.status === 'CONTACTED').length,
        docsPending: bdeLeads.filter(l => l.status === 'DOCUMENTS_PENDING').length,
        docsSubmitted: bdeLeads.filter(l => l.status === 'DOCUMENTS_SUBMITTED').length,
        underReview: bdeLeads.filter(l => l.status === 'UNDER_REVIEW').length,
        approved: bdeLeads.filter(l => l.status === 'APPROVED').length,
        disbursed: bdeLeads.filter(l => l.status === 'DISBURSED').length,
        rejected: bdeLeads.filter(l => l.status === 'REJECTED').length,
      }

      // Priority distribution
      const priorityDistribution = {
        critical: bdeLeads.filter(l => l.priority === 'CRITICAL').length,
        high: bdeLeads.filter(l => l.priority === 'HIGH').length,
        medium: bdeLeads.filter(l => l.priority === 'MEDIUM').length,
        low: bdeLeads.filter(l => l.priority === 'LOW').length,
      }

      // Activity metrics
      const activityMetrics = {
        totalActivities: bdeEvents.length,
        notesAdded: bdeEvents.filter(e => e.event_type === 'NOTE_ADDED').length,
        callsLogged: bdeEvents.filter(e => e.event_type === 'CALL_LOGGED').length,
        documentsUploaded: bdeEvents.filter(e => e.event_type === 'DOCUMENT_UPLOADED').length,
        statusChanges: bdeEvents.filter(e => e.event_type === 'STATUS_CHANGED').length,
      }

      // Loan type distribution
      const loanTypeMap = new Map<string, number>()
      bdeLeads.forEach(lead => {
        const loanType = lead.loan_type || 'UNKNOWN'
        loanTypeMap.set(loanType, (loanTypeMap.get(loanType) || 0) + 1)
      })
      const loanTypeDistribution = Array.from(loanTypeMap.entries()).map(([type, count]) => ({
        loanType: type,
        loanTypeLabel: getLoanTypeLabel(type),
        count,
        percentage: totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0,
      }))

      // Top banks
      const bankMap = new Map<string, number>()
      bdeLeads.forEach(lead => {
        const bankName = lead.bank_name || 'Not Assigned'
        bankMap.set(bankName, (bankMap.get(bankName) || 0) + 1)
      })
      const topBanks = Array.from(bankMap.entries())
        .map(([name, count]) => ({ bankName: name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      // Risk indicators
      const staleLeads = bdeLeads.filter(l => (l.days_in_current_stage || 0) > 7).length
      const criticalLeads = priorityDistribution.critical

      return {
        bdeId: bde.id,
        bdeName: bde.full_name,
        bdeEmail: bde.email,
        bdeAvatar: bde.avatar_url,

        // Core metrics
        totalLeads,
        conversions,
        conversionRate: Math.round(conversionRate * 10) / 10,
        revenue,
        formattedRevenue: formatCurrency(revenue),
        pipelineValue,
        formattedPipelineValue: formatCurrency(pipelineValue),
        avgDealSize,
        formattedAvgDealSize: formatCurrency(avgDealSize),

        // Distributions
        stageDistribution,
        priorityDistribution,
        loanTypeDistribution,
        topBanks,

        // Activity
        activityMetrics,
        avgActivitiesPerLead: totalLeads > 0 ? Math.round((activityMetrics.totalActivities / totalLeads) * 10) / 10 : 0,

        // Risk indicators
        staleLeads,
        staleLeadsPercentage: totalLeads > 0 ? Math.round((staleLeads / totalLeads) * 100) : 0,
        criticalLeads,
        criticalLeadsPercentage: totalLeads > 0 ? Math.round((criticalLeads / totalLeads) * 100) : 0,
      }
    })

    // 9. Calculate comparative insights
    const insights = generateComparativeInsights(comparisons)

    // 10. Build comparison chart data
    const comparisonCharts = {
      conversionRate: comparisons.map(c => ({
        bdeId: c.bdeId,
        bdeName: c.bdeName,
        value: c.conversionRate,
      })),
      revenue: comparisons.map(c => ({
        bdeId: c.bdeId,
        bdeName: c.bdeName,
        value: c.revenue,
        formattedValue: c.formattedRevenue,
      })),
      leadCount: comparisons.map(c => ({
        bdeId: c.bdeId,
        bdeName: c.bdeName,
        value: c.totalLeads,
      })),
      activityLevel: comparisons.map(c => ({
        bdeId: c.bdeId,
        bdeName: c.bdeName,
        value: c.activityMetrics.totalActivities,
      })),
    }

    // 11. Return response
    return NextResponse.json({
      success: true,
      data: {
        comparisons,
        insights,
        charts: comparisonCharts,
        filters: {
          dateRange: {
            start: dateRange.start.toISOString(),
            end: dateRange.end.toISOString(),
            type: range,
          },
          bdeIds: selectedBdeIds,
        },
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('[Comparison API] Error', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch comparison data',
      },
      { status: 500 }
    )
  }
}

// Helper functions
function generateComparativeInsights(comparisons: unknown[]) {
  const insights = []

  // Find best performers in each category
  const bestConversion = comparisons.reduce((max, c) => c.conversionRate > max.conversionRate ? c : max)
  const bestRevenue = comparisons.reduce((max, c) => c.revenue > max.revenue ? c : max)
  const mostActive = comparisons.reduce((max, c) => c.activityMetrics.totalActivities > max.activityMetrics.totalActivities ? c : max)
  const mostLeads = comparisons.reduce((max, c) => c.totalLeads > max.totalLeads ? c : max)

  insights.push({
    type: 'best_conversion',
    title: 'Highest Conversion Rate',
    bdeName: bestConversion.bdeName,
    value: `${bestConversion.conversionRate}%`,
    icon: 'trophy',
    color: '#10B981',
  })

  insights.push({
    type: 'highest_revenue',
    title: 'Highest Revenue',
    bdeName: bestRevenue.bdeName,
    value: bestRevenue.formattedRevenue,
    icon: 'dollar-sign',
    color: '#3B82F6',
  })

  insights.push({
    type: 'most_active',
    title: 'Most Active',
    bdeName: mostActive.bdeName,
    value: `${mostActive.activityMetrics.totalActivities} activities`,
    icon: 'activity',
    color: '#F59E0B',
  })

  insights.push({
    type: 'most_leads',
    title: 'Most Leads Handled',
    bdeName: mostLeads.bdeName,
    value: `${mostLeads.totalLeads} leads`,
    icon: 'users',
    color: '#8B5CF6',
  })

  // Calculate average metrics
  const avgConversionRate = comparisons.reduce((sum, c) => sum + c.conversionRate, 0) / comparisons.length
  const avgRevenue = comparisons.reduce((sum, c) => sum + c.revenue, 0) / comparisons.length

  // Identify outliers
  comparisons.forEach(c => {
    if (c.conversionRate > avgConversionRate * 1.5) {
      insights.push({
        type: 'outlier_high',
        title: 'Exceptional Performance',
        bdeName: c.bdeName,
        value: `${Math.round((c.conversionRate / avgConversionRate - 1) * 100)}% above average`,
        icon: 'trending-up',
        color: '#10B981',
      })
    }

    if (c.conversionRate < avgConversionRate * 0.5 && c.totalLeads > 5) {
      insights.push({
        type: 'outlier_low',
        title: 'Needs Attention',
        bdeName: c.bdeName,
        value: `${Math.round((1 - c.conversionRate / avgConversionRate) * 100)}% below average`,
        icon: 'alert-circle',
        color: '#EF4444',
      })
    }
  })

  return insights
}

function getLoanTypeLabel(loanType: string): string {
  const labels: Record<string, string> = {
    HOME_LOAN: 'Home Loan',
    PERSONAL_LOAN: 'Personal Loan',
    BUSINESS_LOAN: 'Business Loan',
    CAR_LOAN: 'Car Loan',
    EDUCATION_LOAN: 'Education Loan',
    GOLD_LOAN: 'Gold Loan',
    LAP: 'Loan Against Property',
    UNKNOWN: 'Unknown',
  }
  return labels[loanType] || loanType
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
