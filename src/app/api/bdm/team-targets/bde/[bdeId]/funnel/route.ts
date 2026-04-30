/**
 * BDM Team Targets - BDE Lead Funnel API
 * Returns lead funnel breakdown for a specific BDE
 * Shows conversion through each stage
 * BDM access only
 *
 * Rate Limit: 60 requests per minute
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { readRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'


export async function GET(request: NextRequest, { params }: { params: { bdeId: string } }) {
  return readRateLimiter(request, async (req) => {
    return await getBDEFunnelHandler(req, params.bdeId)
  })
}

async function getBDEFunnelHandler(request: NextRequest, bdeId: string) {
  try {
    // =====================================================
    // 1. VERIFY AUTHENTICATION
    // =====================================================

    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        {
          success: false,
          error: auth.error || 'Unauthorized',
        },
        { status: 401 }
      )
    }

    // Verify BDM role
    if (auth.user?.sub_role !== 'BUSINESS_DEVELOPMENT_MANAGER' && !auth.isSuperAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden: BDM access required',
        },
        { status: 403 }
      )
    }

    const supabase = createSupabaseAdmin()
    const bdmUserId = auth.user!.id

    // =====================================================
    // 2. GET QUERY PARAMETERS
    // =====================================================

    const { searchParams } = new URL(request.url)
    const month = parseInt(searchParams.get('month') || new Date().getMonth().toString()) + 1
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())

    // =====================================================
    // 3. VERIFY BDE IS IN BDM'S TEAM
    // =====================================================

    const { data: bdeData, error: bdeError } = await supabase
      .from('users')
      .select('id, name, manager_id')
      .eq('id', bdeId)
      .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')
      .eq('status', 'ACTIVE')
      .maybeSingle()

    if (bdeError || !bdeData) {
      return NextResponse.json(
        {
          success: false,
          error: 'BDE not found',
        },
        { status: 404 }
      )
    }

    // Verify the BDE reports to this BDM
    if (bdeData.manager_id !== bdmUserId && !auth.isSuperAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden: This BDE does not report to you',
        },
        { status: 403 }
      )
    }

    // =====================================================
    // 4. GET LEAD COUNTS BY STATUS
    // =====================================================

    // Get all leads for this BDE in the specified month
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59)

    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, lead_status, loan_amount')
      .eq('assigned_bde_id', bdeId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    if (leadsError) {
      apiLogger.error('Error fetching leads', leadsError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch leads',
        },
        { status: 500 }
      )
    }

    // =====================================================
    // 5. BUILD FUNNEL DATA
    // =====================================================

    // Define funnel stages in order
    const funnelStages = [
      { id: 'NEW', label: 'New Leads', color: '#60A5FA' },
      { id: 'ASSIGNED_TO_BDE', label: 'Assigned', color: '#818CF8' },
      { id: 'CONTACTED', label: 'Contacted', color: '#A78BFA' },
      { id: 'QUALIFIED', label: 'Qualified', color: '#C084FC' },
      { id: 'DOCUMENT_PENDING', label: 'Documents Pending', color: '#FBBF24' },
      { id: 'UNDER_REVIEW', label: 'Under Review', color: '#34D399' },
      { id: 'SANCTIONED', label: 'Sanctioned', color: '#10B981' },
      { id: 'DISBURSED', label: 'Disbursed', color: '#059669' },
    ]

    const rejectedStatuses = ['REJECTED', 'DROPPED', 'CANCELLED', 'LOST']

    // Count leads by status
    const statusCounts: Record<string, number> = {}
    const statusValues: Record<string, number> = {}
    let totalLeads = 0
    let rejectedCount = 0
    let rejectedValue = 0

    leads?.forEach((lead) => {
      totalLeads++
      const status = lead.lead_status

      if (rejectedStatuses.includes(status)) {
        rejectedCount++
        rejectedValue += lead.loan_amount || 0
      } else {
        statusCounts[status] = (statusCounts[status] || 0) + 1
        statusValues[status] = (statusValues[status] || 0) + (lead.loan_amount || 0)
      }
    })

    // Build funnel array
    const funnel = funnelStages.map((stage, index) => {
      const count = statusCounts[stage.id] || 0
      const value = statusValues[stage.id] || 0
      const previousCount = index > 0 ? statusCounts[funnelStages[index - 1].id] || 0 : totalLeads

      return {
        stage: stage.id,
        label: stage.label,
        count,
        value,
        percentage: totalLeads > 0 ? (count / totalLeads) * 100 : 0,
        conversionRate: previousCount > 0 ? (count / previousCount) * 100 : 0,
        color: stage.color,
      }
    })

    // =====================================================
    // 6. CALCULATE CONVERSION METRICS
    // =====================================================

    const newLeads = statusCounts['NEW'] || 0
    const contacted = statusCounts['CONTACTED'] || 0
    const qualified = statusCounts['QUALIFIED'] || 0
    const sanctioned = statusCounts['SANCTIONED'] || 0
    const disbursed = statusCounts['DISBURSED'] || 0

    const conversionMetrics = {
      contactRate: newLeads > 0 ? (contacted / newLeads) * 100 : 0,
      qualificationRate: contacted > 0 ? (qualified / contacted) * 100 : 0,
      sanctionRate: qualified > 0 ? (sanctioned / qualified) * 100 : 0,
      disbursementRate: sanctioned > 0 ? (disbursed / sanctioned) * 100 : 0,
      overallConversionRate: totalLeads > 0 ? (disbursed / totalLeads) * 100 : 0,
    }

    // =====================================================
    // 7. IDENTIFY BOTTLENECKS
    // =====================================================

    // Find stages with lowest conversion rates
    const bottlenecks = funnel
      .map((stage, index) => ({
        stage: stage.label,
        conversionRate: stage.conversionRate,
        dropOff: index > 0 ? funnelStages[index - 1] ? (statusCounts[funnelStages[index - 1].id] || 0) - stage.count : 0 : 0,
      }))
      .filter((b) => b.conversionRate < 70 && b.conversionRate > 0)
      .sort((a, b) => a.conversionRate - b.conversionRate)

    // =====================================================
    // 8. BUILD RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,
      data: {
        bde: {
          id: bdeData.id,
          name: bdeData.name,
        },
        month,
        year,
        funnel,
        summary: {
          totalLeads,
          activeLeads: totalLeads - rejectedCount - (statusCounts['DISBURSED'] || 0),
          rejectedLeads: rejectedCount,
          disbursedLeads: disbursed,
          totalValue: Object.values(statusValues).reduce((sum, val) => sum + val, 0),
          rejectedValue,
        },
        conversionMetrics,
        bottlenecks,
        insights: {
          strongestStage:
            funnel.length > 0
              ? funnel.reduce((max, stage) => (stage.conversionRate > max.conversionRate ? stage : max)).label
              : null,
          weakestStage: bottlenecks.length > 0 ? bottlenecks[0].stage : null,
          avgStageConversion:
            funnel.length > 0
              ? funnel.reduce((sum, stage) => sum + stage.conversionRate, 0) / funnel.length
              : 0,
        },
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('Error in getBDEFunnelHandler', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
