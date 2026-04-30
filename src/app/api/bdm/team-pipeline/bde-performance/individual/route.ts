
/**
 * BDM Team Pipeline - Individual BDE Performance API
 * GET /api/bdm/team-pipeline/bde-performance/individual
 *
 * Returns detailed performance metrics for a single BDE
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBDMId, getBDEIds } from '@/lib/bdm/bde-utils'
import { apiLogger } from '@/lib/utils/logger'

// Internal date range helper types
interface DateRange {
  start: Date
  end: Date
}

/**
 * Parse date range from search params.
 * Supports: range (today/7d/30d/90d/this_month/last_month), or explicit startDate/endDate.
 */
function parseDateRange(searchParams: URLSearchParams): { range: string; dateRange: DateRange } {
  const range = searchParams.get('range') || '30d'
  const startDateParam = searchParams.get('startDate')
  const endDateParam = searchParams.get('endDate')

  if (startDateParam && endDateParam) {
    return {
      range: 'custom',
      dateRange: {
        start: new Date(startDateParam),
        end: new Date(endDateParam),
      },
    }
  }

  const now = new Date()
  let start: Date

  switch (range) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      break
    case '7d':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case '90d':
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      break
    case 'this_month':
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    case 'last_month':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      return {
        range,
        dateRange: {
          start,
          end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
        },
      }
    case '30d':
    default:
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
  }

  return { range, dateRange: { start, end: now } }
}

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
    const bdeId = searchParams.get('bdeId')

    if (!bdeId) {
      return NextResponse.json(
        { success: false, error: 'BDE ID is required' },
        { status: 400 }
      )
    }

    const { range, dateRange } = parseDateRange(searchParams)

    // 3. Verify BDE is under this BDM
    const bdeIds = await getBDEIds(bdmId)
    if (!bdeIds.includes(bdeId)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - BDE not under your management' },
        { status: 403 }
      )
    }

    // 4. Get BDE details
    const supabase = await createClient()
    const { data: bde, error: bdeError } = await supabase
      .from('users')
      .select('id, full_name, email, phone, avatar_url, created_at')
      .eq('id', bdeId)
      .maybeSingle()

    if (bdeError || !bde) {
      return NextResponse.json(
        { success: false, error: 'BDE not found' },
        { status: 404 }
      )
    }

    // 5. Get comparison date range (same duration, immediately before)
    const comparisonRange = getComparisonDateRange(dateRange)

    // 6. Fetch leads for current period
    const { data: currentLeads, error: leadsError } = await supabase
      .from('leads')
      .select('id, status, priority, loan_amount, loan_type, bank_id, bank_name, created_at, updated_at, days_in_current_stage')
      .eq('assigned_to', bdeId)
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString())

    if (leadsError) {
      apiLogger.error('[Individual Performance API] Error fetching leads', leadsError)
      throw new Error(`Failed to fetch leads: ${leadsError.message}`)
    }

    // 7. Fetch leads for comparison period
    const { data: comparisonLeads } = await supabase
      .from('leads')
      .select('id, status, loan_amount')
      .eq('assigned_to', bdeId)
      .gte('created_at', comparisonRange.start.toISOString())
      .lte('created_at', comparisonRange.end.toISOString())

    // 8. Calculate current metrics
    const leads = currentLeads || []
    const totalLeads = leads.length
    const newLeads = leads.filter((l: Record<string, unknown>) => l.status === 'NEW').length
    const contacted = leads.filter((l: Record<string, unknown>) => l.status === 'CONTACTED').length
    const docsPending = leads.filter((l: Record<string, unknown>) => l.status === 'DOCUMENTS_PENDING').length
    const docsSubmitted = leads.filter((l: Record<string, unknown>) => l.status === 'DOCUMENTS_SUBMITTED').length
    const underReview = leads.filter((l: Record<string, unknown>) => l.status === 'UNDER_REVIEW').length
    const approved = leads.filter((l: Record<string, unknown>) => l.status === 'APPROVED').length
    const disbursed = leads.filter((l: Record<string, unknown>) => l.status === 'DISBURSED').length
    const rejected = leads.filter((l: Record<string, unknown>) => l.status === 'REJECTED').length
    const conversions = disbursed
    const totalRevenue = leads
      .filter((l: Record<string, unknown>) => l.status === 'DISBURSED')
      .reduce((sum: number, l: Record<string, unknown>) => sum + (Number(l.loan_amount) || 0), 0)
    const pipelineValue = leads
      .filter((l: Record<string, unknown>) => !['REJECTED', 'CANCELLED', 'DISBURSED'].includes(l.status as string))
      .reduce((sum: number, l: Record<string, unknown>) => sum + (Number(l.loan_amount) || 0), 0)
    const criticalLeads = leads.filter((l: Record<string, unknown>) => l.priority === 'CRITICAL').length
    const highPriorityLeads = leads.filter((l: Record<string, unknown>) => l.priority === 'HIGH').length
    const staleLeads = leads.filter((l: Record<string, unknown>) => (Number(l.days_in_current_stage) || 0) > 7).length

    // Calculate derived metrics
    const conversionRate = totalLeads > 0
      ? (conversions / totalLeads) * 100
      : 0

    const avgDealSize = conversions > 0
      ? totalRevenue / conversions
      : 0

    const currentMetrics = {
      totalLeads,
      newLeads,
      contacted,
      docsPending,
      docsSubmitted,
      underReview,
      approved,
      disbursed,
      rejected,
      conversions,
      totalRevenue,
      pipelineValue,
      criticalLeads,
      highPriorityLeads,
      staleLeads,
      conversionRate,
      avgDealSize,
    }

    // 9. Calculate comparison metrics
    const compLeads = comparisonLeads || []
    const compTotalLeads = compLeads.length
    const compConversions = compLeads.filter((l: Record<string, unknown>) => l.status === 'DISBURSED').length
    const compTotalRevenue = compLeads
      .filter((l: Record<string, unknown>) => l.status === 'DISBURSED')
      .reduce((sum: number, l: Record<string, unknown>) => sum + (Number(l.loan_amount) || 0), 0)
    const compConversionRate = compTotalLeads > 0
      ? (compConversions / compTotalLeads) * 100
      : 0

    const comparisonMetrics = {
      totalLeads: compTotalLeads,
      conversions: compConversions,
      totalRevenue: compTotalRevenue,
      conversionRate: compConversionRate,
    }

    // 10. Calculate trends
    const trends = {
      leadCount: calculateTrend(currentMetrics.totalLeads, comparisonMetrics.totalLeads),
      conversions: calculateTrend(currentMetrics.conversions, comparisonMetrics.conversions),
      conversionRate: calculateTrend(currentMetrics.conversionRate, comparisonMetrics.conversionRate),
      revenue: calculateTrend(currentMetrics.totalRevenue, comparisonMetrics.totalRevenue),
    }

    // 11. Breakdown by loan type
    const loanTypeBreakdown = getLoanTypeBreakdown(leads)

    // 12. Breakdown by bank
    const bankBreakdown = getBankBreakdown(leads)

    // 13. Breakdown by status
    const statusBreakdown = [
      { status: 'NEW', label: 'New', count: currentMetrics.newLeads, color: '#3B82F6' },
      { status: 'CONTACTED', label: 'Contacted', count: currentMetrics.contacted, color: '#6366F1' },
      { status: 'DOCUMENTS_PENDING', label: 'Docs Pending', count: currentMetrics.docsPending, color: '#8B5CF6' },
      { status: 'DOCUMENTS_SUBMITTED', label: 'Docs Submitted', count: currentMetrics.docsSubmitted, color: '#A855F7' },
      { status: 'UNDER_REVIEW', label: 'Under Review', count: currentMetrics.underReview, color: '#D946EF' },
      { status: 'APPROVED', label: 'Approved', count: currentMetrics.approved, color: '#10B981' },
      { status: 'DISBURSED', label: 'Disbursed', count: currentMetrics.disbursed, color: '#059669' },
      { status: 'REJECTED', label: 'Rejected', count: currentMetrics.rejected, color: '#EF4444' },
    ].filter(item => item.count > 0)

    // 14. Get recent timeline activity
    const { data: recentActivity } = await supabase
      .from('lead_timeline_events')
      .select(`
        id,
        event_type,
        description,
        created_at,
        lead_id,
        leads:lead_id (
          customer_name
        )
      `)
      .eq('performed_by', bdeId)
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString())
      .order('created_at', { ascending: false })
      .limit(20)

    // 15. Calculate activity stats
    const activities = recentActivity || []
    const activityStats = {
      totalActivities: activities.length,
      notesAdded: activities.filter((a: Record<string, unknown>) => a.event_type === 'NOTE_ADDED').length,
      callsLogged: activities.filter((a: Record<string, unknown>) => a.event_type === 'CALL_LOGGED').length,
      emailsSent: activities.filter((a: Record<string, unknown>) => a.event_type === 'EMAIL_SENT').length,
      documentsUploaded: activities.filter((a: Record<string, unknown>) => a.event_type === 'DOCUMENT_UPLOADED').length,
      statusChanges: activities.filter((a: Record<string, unknown>) => a.event_type === 'STATUS_CHANGED').length,
    }

    // 16. Get performance snapshots for trend chart
    const { data: snapshots } = await supabase
      .from('bde_performance_snapshots')
      .select('snapshot_date, total_leads, conversions, total_revenue, avg_turnaround_time')
      .eq('bde_user_id', bdeId)
      .gte('snapshot_date', dateRange.start.toISOString())
      .lte('snapshot_date', dateRange.end.toISOString())
      .order('snapshot_date', { ascending: true })

    // 17. Build response
    return NextResponse.json({
      success: true,
      data: {
        bde: {
          id: bde.id,
          name: bde.full_name,
          email: bde.email,
          phone: bde.phone,
          avatar: bde.avatar_url,
          joinedAt: bde.created_at,
        },
        metrics: {
          ...currentMetrics,
          formattedRevenue: formatCurrency(currentMetrics.totalRevenue),
          formattedPipelineValue: formatCurrency(currentMetrics.pipelineValue),
          formattedAvgDealSize: formatCurrency(currentMetrics.avgDealSize),
          conversionRate: Math.round(currentMetrics.conversionRate * 10) / 10,
        },
        trends,
        breakdowns: {
          loanType: loanTypeBreakdown,
          bank: bankBreakdown,
          status: statusBreakdown,
        },
        activity: {
          stats: activityStats,
          recent: activities.map((a: Record<string, unknown>) => {
            const leadsRelation = a.leads as Record<string, unknown> | null
            return {
              id: a.id,
              type: a.event_type,
              description: a.description,
              createdAt: a.created_at,
              createdAtFormatted: formatRelativeTime(a.created_at as string),
              customerName: leadsRelation?.customer_name || 'Unknown',
            }
          }),
        },
        performanceHistory: (snapshots || []).map((s: Record<string, unknown>) => ({
          date: s.snapshot_date,
          formattedDate: formatDate(s.snapshot_date as string),
          leadCount: Number(s.total_leads) || 0,
          conversions: Number(s.conversions) || 0,
          revenue: Number(s.total_revenue) || 0,
          formattedRevenue: formatCurrency(Number(s.total_revenue) || 0),
          avgTat: Number(s.avg_turnaround_time) || 0,
        })),
        filters: {
          dateRange: {
            start: dateRange.start.toISOString(),
            end: dateRange.end.toISOString(),
            type: range,
          },
        },
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('[Individual Performance API] Error', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch individual performance',
      },
      { status: 500 }
    )
  }
}

// Helper functions
function getComparisonDateRange(currentRange: DateRange): DateRange {
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

function getLoanTypeBreakdown(leads: Record<string, unknown>[]) {
  const breakdown = new Map<string, { count: number; value: number }>()

  leads.forEach((lead: Record<string, unknown>) => {
    const loanType = (lead.loan_type as string) || 'UNKNOWN'
    const existing = breakdown.get(loanType) || { count: 0, value: 0 }
    breakdown.set(loanType, {
      count: existing.count + 1,
      value: existing.value + (Number(lead.loan_amount) || 0),
    })
  })

  return Array.from(breakdown.entries())
    .map(([loanType, data]) => ({
      loanType,
      loanTypeLabel: getLoanTypeLabel(loanType),
      count: data.count,
      totalValue: data.value,
      formattedValue: formatCurrency(data.value),
      percentage: leads.length > 0 ? Math.round((data.count / leads.length) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
}

function getBankBreakdown(leads: Record<string, unknown>[]) {
  const breakdown = new Map<string, { count: number; value: number }>()

  leads.forEach((lead: Record<string, unknown>) => {
    const bankName = (lead.bank_name as string) || 'Not Assigned'
    const existing = breakdown.get(bankName) || { count: 0, value: 0 }
    breakdown.set(bankName, {
      count: existing.count + 1,
      value: existing.value + (Number(lead.loan_amount) || 0),
    })
  })

  return Array.from(breakdown.entries())
    .map(([bankName, data]) => ({
      bankName,
      count: data.count,
      totalValue: data.value,
      formattedValue: formatCurrency(data.value),
      percentage: leads.length > 0 ? Math.round((data.count / leads.length) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10) // Top 10 banks
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
  if (!amount) return '\u20B90'
  if (amount >= 10000000) {
    return `\u20B9${(amount / 10000000).toFixed(2)} Cr`
  } else if (amount >= 100000) {
    return `\u20B9${(amount / 100000).toFixed(2)} L`
  }
  return `\u20B9${amount.toLocaleString('en-IN')}`
}

function formatDate(dateString: string): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatRelativeTime(dateString: string): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return formatDate(dateString)
}
