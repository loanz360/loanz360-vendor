import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { FUNNEL_STAGES } from '@/lib/types/dse-enhanced-performance.types'
import type { FunnelAnalytics, FunnelStageMetrics } from '@/lib/types/dse-enhanced-performance.types'


/** Stage labels for display */
const STAGE_LABELS: Record<string, string> = {
  lead_generated: 'Lead Generated',
  qualified: 'Qualified',
  application_filed: 'Application Filed',
  documents_collected: 'Documents Collected',
  bank_submitted: 'Bank Submitted',
  bank_login: 'Bank Login',
  credit_approved: 'Credit Approved',
  sanction_letter: 'Sanction Letter',
  disbursed: 'Disbursed',
  first_emi_collected: 'First EMI Collected',
  rejected: 'Rejected',
  dropped: 'Dropped',
}

/** Default SLA hours per stage */
const STAGE_SLA_HOURS: Record<string, number> = {
  lead_generated: 24,
  qualified: 48,
  application_filed: 72,
  documents_collected: 72,
  bank_submitted: 24,
  bank_login: 48,
  credit_approved: 120,
  sanction_letter: 72,
  disbursed: 168,
  first_emi_collected: 720,
}

/**
 * GET /api/performance/dse/funnel-analytics
 * Returns full lead-to-disbursement funnel analytics for the authenticated DSE.
 * Includes stage-wise metrics, bottleneck detection, and SLA breach tracking.
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const months = Math.min(Math.max(parseInt(searchParams.get('months') || '3'), 1), 12)

    // Authenticate
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSE role
    const adminClient = createSupabaseAdmin()
    const { data: profile } = await adminClient
      .from('users')
      .select('sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || profile.sub_role !== 'DIRECT_SALES_EXECUTIVE') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months)

    // Fetch all funnel entries for the DSE
    const { data: funnelData, error: funnelError } = await adminClient
      .from('dse_loan_funnel')
      .select('*')
      .eq('dse_user_id', user.id)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })

    if (funnelError) {
      apiLogger.error('Error fetching funnel data', funnelError)
      return NextResponse.json({ error: 'Failed to fetch funnel data' }, { status: 500 })
    }

    const entries = funnelData || []

    // Build stage-wise metrics
    const stageMetrics: FunnelStageMetrics[] = FUNNEL_STAGES.map((stage, index) => {
      const inStage = entries.filter((e) => e.current_stage === stage)
      const passedThrough = entries.filter((e) => {
        const history: Array<{ stage: string }> = e.stage_history || []
        return history.some((h) => h.stage === stage) || e.current_stage === stage
      })

      const nextStage = FUNNEL_STAGES[index + 1]
      const passedToNext = nextStage
        ? entries.filter((e) => {
            const history: Array<{ stage: string }> = e.stage_history || []
            return history.some((h) => h.stage === nextStage) || e.current_stage === nextStage ||
              FUNNEL_STAGES.indexOf(e.current_stage as unknown) > index
          }).length
        : 0

      const slaBreach = inStage.filter((e) => e.is_sla_breached).length
      const dropOff = entries.filter((e) => e.drop_off_stage === stage).length

      // Calculate average duration in this stage
      let totalDuration = 0
      let durationCount = 0
      entries.forEach((e) => {
        const history: Array<{ stage: string; entered_at: string; exited_at?: string }> = e.stage_history || []
        const stageEntry = history.find((h) => h.stage === stage)
        if (stageEntry?.entered_at && stageEntry?.exited_at) {
          totalDuration += (new Date(stageEntry.exited_at).getTime() - new Date(stageEntry.entered_at).getTime()) / (1000 * 60 * 60)
          durationCount++
        }
      })

      // Revenue weighted by stage probability
      const stageWeight = (index + 1) / FUNNEL_STAGES.length
      const revenueWeighted = passedThrough.reduce((sum, e) => sum + ((e.loan_amount || 0) * stageWeight), 0)

      return {
        stage,
        stage_label: STAGE_LABELS[stage] || stage,
        count: passedThrough.length,
        conversion_to_next: passedThrough.length > 0 ? (passedToNext / passedThrough.length) * 100 : 0,
        average_duration_hours: durationCount > 0 ? totalDuration / durationCount : 0,
        sla_breach_count: slaBreach,
        drop_off_count: dropOff,
        revenue_weighted: revenueWeighted,
      }
    })

    // Find bottleneck (stage with lowest conversion to next)
    const activeStages = stageMetrics.filter((s) => s.count > 0 && s.conversion_to_next > 0)
    const bottleneck = activeStages.length > 0
      ? activeStages.reduce((min, s) => s.conversion_to_next < min.conversion_to_next ? s : min).stage
      : 'N/A'

    // Total counts
    const totalLeads = entries.length
    const totalDisbursed = entries.filter((e) => e.current_stage === 'disbursed' || e.current_stage === 'first_emi_collected').length
    const slaBreaches = entries.filter((e) => e.is_sla_breached).length

    // Average cycle time (lead to disbursement)
    const disbursedEntries = entries.filter((e) => e.actual_disbursement_date)
    const avgCycleDays = disbursedEntries.length > 0
      ? disbursedEntries.reduce((sum, e) => {
          const created = new Date(e.created_at).getTime()
          const disbursed = new Date(e.actual_disbursement_date).getTime()
          return sum + (disbursed - created) / (1000 * 60 * 60 * 24)
        }, 0) / disbursedEntries.length
      : 0

    const analytics: FunnelAnalytics = {
      stages: stageMetrics,
      total_leads: totalLeads,
      total_disbursed: totalDisbursed,
      overall_conversion_rate: totalLeads > 0 ? (totalDisbursed / totalLeads) * 100 : 0,
      average_cycle_days: Number(avgCycleDays.toFixed(1)),
      bottleneck_stage: bottleneck,
      sla_breach_count: slaBreaches,
    }

    // Also return items currently at risk (stuck in stage, approaching SLA)
    const atRiskItems = entries
      .filter((e) => {
        if (['disbursed', 'first_emi_collected', 'rejected', 'dropped'].includes(e.current_stage)) return false
        const hoursInStage = (Date.now() - new Date(e.stage_entered_at).getTime()) / (1000 * 60 * 60)
        const sla = STAGE_SLA_HOURS[e.current_stage] || 72
        return hoursInStage > sla * 0.75 // 75% of SLA used
      })
      .slice(0, 20) // Limit to 20 items
      .map((e) => ({
        id: e.id,
        customer_name: e.customer_name,
        product_type: e.product_type,
        bank_partner: e.bank_partner,
        loan_amount: e.loan_amount,
        current_stage: e.current_stage,
        stage_label: STAGE_LABELS[e.current_stage],
        hours_in_stage: Math.round((Date.now() - new Date(e.stage_entered_at).getTime()) / (1000 * 60 * 60)),
        sla_hours: STAGE_SLA_HOURS[e.current_stage] || 72,
        is_breached: e.is_sla_breached,
      }))

    return NextResponse.json({
      analytics,
      at_risk_items: atRiskItems,
      period: { months, start: startDate.toISOString(), end: endDate.toISOString() },
    })
  } catch (error) {
    apiLogger.error('Error in funnel analytics API', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
