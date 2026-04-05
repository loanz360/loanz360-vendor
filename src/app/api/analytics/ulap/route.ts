/**
 * API Route: ULAP Lead Analytics
 * GET /api/analytics/ulap
 *
 * Provides comprehensive analytics for ULAP leads
 * - Summary metrics (total leads, conversion rates, processing time)
 * - Source performance breakdown
 * - Conversion funnel data
 * - Daily/weekly/monthly trends
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

interface AnalyticsSummary {
  totalLeads: number
  totalLeadsChange: number
  conversionRate: number
  conversionRateChange: number
  avgProcessingTime: number
  avgProcessingTimeChange: number
  totalDisbursed: number
  totalDisbursedChange: number
  pendingLeads: number
  approvedLeads: number
  rejectedLeads: number
  disbursedLeads: number
}

interface SourceMetrics {
  source: string
  leads: number
  conversions: number
  conversionRate: number
  avgAmount: number
  avgProcessingDays: number
}

interface FunnelStage {
  stage: string
  count: number
  percentage: number
  dropoff: number
}

interface DailyTrend {
  date: string
  leads: number
  conversions: number
  disbursements: number
}

interface AnalyticsResponse {
  success: boolean
  summary?: AnalyticsSummary
  sourceMetrics?: SourceMetrics[]
  funnel?: FunnelStage[]
  trends?: DailyTrend[]
  error?: string
}

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as AnalyticsResponse,
        { status: 401 }
      )
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || 'month'
    const partnerId = searchParams.get('partnerId')
    const employeeId = searchParams.get('employeeId')

    // Calculate date range
    const now = new Date()
    let startDate: Date
    let previousStartDate: Date

    switch (range) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        previousStartDate = new Date(startDate)
        previousStartDate.setDate(previousStartDate.getDate() - 1)
        break
      case 'week':
        startDate = new Date(now)
        startDate.setDate(startDate.getDate() - 7)
        previousStartDate = new Date(startDate)
        previousStartDate.setDate(previousStartDate.getDate() - 7)
        break
      case 'month':
        startDate = new Date(now)
        startDate.setMonth(startDate.getMonth() - 1)
        previousStartDate = new Date(startDate)
        previousStartDate.setMonth(previousStartDate.getMonth() - 1)
        break
      case 'quarter':
        startDate = new Date(now)
        startDate.setMonth(startDate.getMonth() - 3)
        previousStartDate = new Date(startDate)
        previousStartDate.setMonth(previousStartDate.getMonth() - 3)
        break
      case 'year':
        startDate = new Date(now)
        startDate.setFullYear(startDate.getFullYear() - 1)
        previousStartDate = new Date(startDate)
        previousStartDate.setFullYear(previousStartDate.getFullYear() - 1)
        break
      default:
        startDate = new Date(now)
        startDate.setMonth(startDate.getMonth() - 1)
        previousStartDate = new Date(startDate)
        previousStartDate.setMonth(previousStartDate.getMonth() - 1)
    }

    // Build base query filters
    const buildFilters = (query: ReturnType<typeof supabase.from>) => {
      if (partnerId) {
        query = query.eq('partner_id', partnerId)
      }
      if (employeeId) {
        query = query.or(`employee_id.eq.${employeeId},assigned_bde_id.eq.${employeeId}`)
      }
      return query
    }

    // 1. Get current period leads
    let currentQuery = supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .gte('created_at', startDate.toISOString())
      .lte('created_at', now.toISOString())

    currentQuery = buildFilters(currentQuery)
    const { data: currentLeads, count: currentCount } = await currentQuery

    // 2. Get previous period leads for comparison
    let previousQuery = supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .gte('created_at', previousStartDate.toISOString())
      .lt('created_at', startDate.toISOString())

    previousQuery = buildFilters(previousQuery)
    const { count: previousCount } = await previousQuery

    // 3. Calculate summary metrics
    const leads = currentLeads || []

    const pendingLeads = leads.filter(l => ['NEW', 'CONTACTED', 'UNDER_REVIEW', 'DOCUMENT_PENDING'].includes(l.lead_status)).length
    const approvedLeads = leads.filter(l => l.lead_status === 'APPROVED').length
    const rejectedLeads = leads.filter(l => l.lead_status === 'REJECTED').length
    const disbursedLeads = leads.filter(l => l.lead_status === 'DISBURSED').length

    const totalDisbursed = leads
      .filter(l => l.lead_status === 'DISBURSED')
      .reduce((sum, l) => sum + (l.disbursed_amount || l.required_loan_amount || 0), 0)

    // Calculate processing time (days from creation to disbursement)
    const disbursedWithTime = leads.filter(l => l.lead_status === 'DISBURSED' && l.disbursed_at)
    const avgProcessingTime = disbursedWithTime.length > 0
      ? disbursedWithTime.reduce((sum, l) => {
          const created = new Date(l.created_at)
          const disbursed = new Date(l.disbursed_at)
          return sum + ((disbursed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
        }, 0) / disbursedWithTime.length
      : 0

    // Calculate changes
    const totalLeadsChange = previousCount && previousCount > 0
      ? ((currentCount! - previousCount) / previousCount) * 100
      : 0

    const conversionRate = currentCount! > 0 ? (disbursedLeads / currentCount!) * 100 : 0

    const summary: AnalyticsSummary = {
      totalLeads: currentCount || 0,
      totalLeadsChange: Math.round(totalLeadsChange * 10) / 10,
      conversionRate: Math.round(conversionRate * 10) / 10,
      conversionRateChange: 0, // Would need previous period conversion data
      avgProcessingTime: Math.round(avgProcessingTime * 10) / 10,
      avgProcessingTimeChange: 0, // Would need previous period data
      totalDisbursed,
      totalDisbursedChange: 0, // Would need previous period data
      pendingLeads,
      approvedLeads,
      rejectedLeads,
      disbursedLeads
    }

    // 4. Source performance metrics
    const sourceGroups: Record<string, { leads: number; conversions: number; totalAmount: number; totalDays: number }> = {}

    leads.forEach(lead => {
      const source = lead.form_source || 'UNKNOWN'
      if (!sourceGroups[source]) {
        sourceGroups[source] = { leads: 0, conversions: 0, totalAmount: 0, totalDays: 0 }
      }
      sourceGroups[source].leads++

      if (lead.lead_status === 'DISBURSED') {
        sourceGroups[source].conversions++
        sourceGroups[source].totalAmount += lead.disbursed_amount || lead.required_loan_amount || 0

        if (lead.disbursed_at) {
          const created = new Date(lead.created_at)
          const disbursed = new Date(lead.disbursed_at)
          sourceGroups[source].totalDays += (disbursed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
        }
      }
    })

    const sourceMetrics: SourceMetrics[] = Object.entries(sourceGroups)
      .map(([source, data]) => ({
        source: formatSourceName(source),
        leads: data.leads,
        conversions: data.conversions,
        conversionRate: data.leads > 0 ? Math.round((data.conversions / data.leads) * 1000) / 10 : 0,
        avgAmount: data.conversions > 0 ? Math.round(data.totalAmount / data.conversions) : 0,
        avgProcessingDays: data.conversions > 0 ? Math.round((data.totalDays / data.conversions) * 10) / 10 : 0
      }))
      .sort((a, b) => b.leads - a.leads)

    // 5. Conversion funnel
    const funnelStages = [
      { stage: 'New Leads', statuses: ['NEW', 'CONTACTED', 'UNDER_REVIEW', 'DOCUMENT_PENDING', 'CAM_PENDING', 'APPROVED', 'REJECTED', 'DISBURSED'] },
      { stage: 'Contacted', statuses: ['CONTACTED', 'UNDER_REVIEW', 'DOCUMENT_PENDING', 'CAM_PENDING', 'APPROVED', 'REJECTED', 'DISBURSED'] },
      { stage: 'Documents Collected', statuses: ['UNDER_REVIEW', 'DOCUMENT_PENDING', 'CAM_PENDING', 'APPROVED', 'REJECTED', 'DISBURSED'] },
      { stage: 'Under Review', statuses: ['UNDER_REVIEW', 'CAM_PENDING', 'APPROVED', 'REJECTED', 'DISBURSED'] },
      { stage: 'CAM Generated', statuses: ['CAM_PENDING', 'APPROVED', 'REJECTED', 'DISBURSED'] },
      { stage: 'Approved', statuses: ['APPROVED', 'DISBURSED'] },
      { stage: 'Disbursed', statuses: ['DISBURSED'] }
    ]

    const totalLeadsCount = leads.length || 1
    let previousCount2 = totalLeadsCount

    const funnel: FunnelStage[] = funnelStages.map((stage, index) => {
      // For simplicity, using lead_status to determine funnel position
      // In reality, you'd track status history
      const count = leads.filter(l => {
        if (index === 0) return true // All leads start at stage 0
        if (index === 1) return l.lead_status !== 'NEW'
        if (index === 2) return ['UNDER_REVIEW', 'DOCUMENT_PENDING', 'CAM_PENDING', 'APPROVED', 'REJECTED', 'DISBURSED'].includes(l.lead_status)
        if (index === 3) return ['UNDER_REVIEW', 'CAM_PENDING', 'APPROVED', 'REJECTED', 'DISBURSED'].includes(l.lead_status)
        if (index === 4) return ['CAM_PENDING', 'APPROVED', 'REJECTED', 'DISBURSED'].includes(l.lead_status) || l.cam_status === 'COMPLETED'
        if (index === 5) return ['APPROVED', 'DISBURSED'].includes(l.lead_status)
        if (index === 6) return l.lead_status === 'DISBURSED'
        return false
      }).length

      const percentage = Math.round((count / totalLeadsCount) * 1000) / 10
      const dropoff = index === 0 ? 0 : Math.round(((previousCount2 - count) / previousCount2) * 1000) / 10
      previousCount2 = count

      return { stage: stage.stage, count, percentage, dropoff }
    })

    // 6. Daily trends
    const trendsData: Record<string, { leads: number; conversions: number; disbursements: number }> = {}

    // Get last 30 days
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      trendsData[dateStr] = { leads: 0, conversions: 0, disbursements: 0 }
    }

    leads.forEach(lead => {
      const createdDate = lead.created_at.split('T')[0]
      if (trendsData[createdDate]) {
        trendsData[createdDate].leads++
      }

      if (lead.lead_status === 'APPROVED' && lead.updated_at) {
        const approvedDate = lead.updated_at.split('T')[0]
        if (trendsData[approvedDate]) {
          trendsData[approvedDate].conversions++
        }
      }

      if (lead.lead_status === 'DISBURSED' && lead.disbursed_at) {
        const disbursedDate = lead.disbursed_at.split('T')[0]
        if (trendsData[disbursedDate]) {
          trendsData[disbursedDate].disbursements++
        }
      }
    })

    const trends: DailyTrend[] = Object.entries(trendsData)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({
      success: true,
      summary,
      sourceMetrics,
      funnel,
      trends
    } as AnalyticsResponse)
  } catch (error) {
    apiLogger.error('ULAP Analytics API error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as AnalyticsResponse,
      { status: 500 }
    )
  }
}

function formatSourceName(source: string): string {
  const sourceNames: Record<string, string> = {
    'BA': 'Business Associate',
    'BUSINESS_ASSOCIATE': 'Business Associate',
    'BP': 'Business Partner',
    'BUSINESS_PARTNER': 'Business Partner',
    'DSE': 'DSE Direct',
    'DSE_DIRECT': 'DSE Direct',
    'DIRECT_SUBMISSION': 'Direct Submission',
    'TELECALLER': 'Telecaller',
    'FIELD_SALES': 'Field Sales',
    'CUSTOMER': 'Customer Self-Service',
    'WEBSITE': 'Website',
    'REFERRAL': 'Referral',
    'WALK_IN': 'Walk-In',
    'UNKNOWN': 'Other'
  }
  return sourceNames[source] || source
}
