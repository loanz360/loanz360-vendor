
/**
 * BDM Team Pipeline - Pipeline Funnel API
 * GET /api/bdm/team-pipeline/analytics/funnel
 *
 * Returns stage-wise lead distribution for funnel visualization
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBDMId, getBDEIds } from '@/lib/bdm/bde-utils'
import { getDateRangeFilter, parseDateRangeParams } from '@/lib/bdm/date-utils'
import { formatCurrency, formatNumber } from '@/lib/bdm/analytics'
import { apiLogger } from '@/lib/utils/logger'

// Define stage order and colors
const STAGE_CONFIG = [
  { status: 'NEW', label: 'New Leads', color: '#3B82F6', order: 1 },
  { status: 'ASSIGNED_TO_BDE', label: 'Assigned', color: '#8B5CF6', order: 2 },
  { status: 'CONTACTED', label: 'Contacted', color: '#6366F1', order: 3 },
  { status: 'IN_PROGRESS', label: 'In Progress', color: '#06B6D4', order: 4 },
  { status: 'DOCUMENTS_PENDING', label: 'Docs Pending', color: '#F59E0B', order: 5 },
  { status: 'DOCUMENTS_RECEIVED', label: 'Docs Received', color: '#10B981', order: 6 },
  { status: 'SUBMITTED_TO_BANK', label: 'Submitted to Bank', color: '#14B8A6', order: 7 },
  { status: 'UNDER_REVIEW', label: 'Under Review', color: '#8B5CF6', order: 8 },
  { status: 'SANCTIONED', label: 'Sanctioned', color: '#22C55E', order: 9 },
  { status: 'DISBURSED', label: 'Disbursed', color: '#16A34A', order: 10 },
]

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.ANALYTICS)
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
    const { range, startDate, endDate } = parseDateRangeParams(searchParams)
    const bdeIdsParam = searchParams.get('bdeIds')?.split(',').filter(Boolean)

    // 3. Get BDEs under this BDM
    const allBDEIds = await getBDEIds(bdmId)
    const bdeIds = bdeIdsParam && bdeIdsParam.length > 0 ? bdeIdsParam : allBDEIds

    if (bdeIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          stages: [],
          totalLeads: 0,
          totalValue: 0,
          overallConversion: 0,
        },
      })
    }

    // 4. Get date range
    const dateRange = getDateRangeFilter(range, startDate, endDate)
    const supabase = createClient()

    // 5. Fetch stage-wise data
    const { data: leads, error } = await supabase
      .from('leads')
      .select('lead_status, loan_amount, days_in_current_stage, created_at')
      .in('assigned_bde_id', bdeIds)
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString())

    if (error) {
      apiLogger.error('[Funnel API] Error fetching leads', error)
      throw new Error(`Failed to fetch leads: ${error.message}`)
    }

    // 6. Group by stage
    const stageData: Map<
      string,
      { count: number; value: number; daysInStage: number[] }
    > = new Map()

    leads?.forEach((lead) => {
      const status = lead.lead_status || 'NEW'
      const existing = stageData.get(status) || { count: 0, value: 0, daysInStage: [] }

      existing.count++
      existing.value += lead.loan_amount || 0
      if (lead.days_in_current_stage !== null) {
        existing.daysInStage.push(lead.days_in_current_stage)
      }

      stageData.set(status, existing)
    })

    // 7. Calculate conversion rates
    const totalLeads = leads?.length || 0
    const stages = STAGE_CONFIG.map((config, index) => {
      const data = stageData.get(config.status) || { count: 0, value: 0, daysInStage: [] }
      const previousStageData =
        index > 0
          ? stageData.get(STAGE_CONFIG[index - 1].status)
          : { count: totalLeads, value: 0, daysInStage: [] }

      const conversionRate =
        previousStageData && previousStageData.count > 0
          ? (data.count / previousStageData.count) * 100
          : 0

      const avgDaysInStage =
        data.daysInStage.length > 0
          ? data.daysInStage.reduce((sum, days) => sum + days, 0) / data.daysInStage.length
          : 0

      return {
        stage: config.status,
        label: config.label,
        count: data.count,
        value: data.value,
        formattedValue: formatCurrency(data.value),
        formattedCount: formatNumber(data.count),
        conversionRate: Math.round(conversionRate * 10) / 10,
        avgDaysInStage: Math.round(avgDaysInStage),
        color: config.color,
        order: config.order,
        percentage: totalLeads > 0 ? (data.count / totalLeads) * 100 : 0,
      }
    }).filter((stage) => stage.count > 0) // Only include stages with data

    // 8. Calculate totals
    const totalValue = stages.reduce((sum, stage) => sum + stage.value, 0)
    const disbursedCount = stageData.get('DISBURSED')?.count || 0
    const overallConversion = totalLeads > 0 ? (disbursedCount / totalLeads) * 100 : 0

    // 9. Return response
    return NextResponse.json({
      success: true,
      data: {
        stages,
        totalLeads,
        totalValue,
        formattedTotalValue: formatCurrency(totalValue),
        overallConversion: Math.round(overallConversion * 10) / 10,
        metadata: {
          dateRange: {
            start: dateRange.start.toISOString(),
            end: dateRange.end.toISOString(),
            type: range,
          },
          bdeCount: bdeIds.length,
          stagesWithData: stages.length,
        },
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('[Funnel API] Error', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch funnel data',
      },
      { status: 500 }
    )
  }
}
