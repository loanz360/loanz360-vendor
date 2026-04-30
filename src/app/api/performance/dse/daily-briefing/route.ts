import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import type { DailyBriefing, BriefingFocusArea, BriefingOpportunity, PaceIndicator } from '@/lib/types/dse-enhanced-performance.types'


/**
 * GET /api/performance/dse/daily-briefing
 * Returns a personalized daily performance briefing for the DSE.
 * Includes pace tracking, focus areas, top opportunities, and meeting count.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Authenticate
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSE role
    const adminClient = createSupabaseAdmin()
    const { data: profile } = await adminClient
      .from('users')
      .select('sub_role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || profile.sub_role !== 'DIRECT_SALES_EXECUTIVE') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()
    const currentDay = now.getDate()
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate()
    const hour = now.getHours()

    // Calculate working days
    let totalWorkingDays = 0
    let elapsedWorkingDays = 0
    for (let d = 1; d <= daysInMonth; d++) {
      if (new Date(currentYear, currentMonth - 1, d).getDay() !== 0) {
        totalWorkingDays++
        if (d <= currentDay) elapsedWorkingDays++
      }
    }

    // Fetch monthly summary (both schemas)
    let summary: unknown = null
    const { data: s1 } = await adminClient
      .from('dse_monthly_summary')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle()
    summary = s1

    if (!summary) {
      const { data: s2 } = await adminClient
        .from('dse_monthly_summary')
        .select('*')
        .eq('dse_user_id', user.id)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .maybeSingle()
      summary = s2
    }

    // Fetch targets
    const { data: targets } = await adminClient
      .from('dse_targets')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle()

    // Fetch today's schedule
    const todayStr = now.toISOString().split('T')[0]
    const { data: todaySchedules } = await adminClient
      .from('dse_loan_funnel')
      .select('id, customer_name, product_type, loan_amount, current_stage, bank_partner')
      .eq('dse_user_id', user.id)
      .not('current_stage', 'in', '("disbursed","first_emi_collected","rejected","dropped")')
      .order('updated_at', { ascending: false })
      .limit(50)

    // Greeting based on time of day
    const firstName = (profile.full_name || 'there').split(' ')[0]
    let greeting: string
    if (hour < 12) greeting = `Good Morning, ${firstName}!`
    else if (hour < 17) greeting = `Good Afternoon, ${firstName}!`
    else greeting = `Good Evening, ${firstName}!`

    // Calculate pace
    const currentRevenue = summary?.total_revenue || summary?.total_converted_revenue || 0
    const revenueTarget = targets?.revenue_target || 800000
    const expectedPct = (elapsedWorkingDays / totalWorkingDays) * 100
    const actualPct = revenueTarget > 0 ? (currentRevenue / revenueTarget) * 100 : 0
    const paceDelta = actualPct - expectedPct

    let paceStatus: PaceIndicator
    if (paceDelta >= 10) paceStatus = 'ahead'
    else if (paceDelta >= -5) paceStatus = 'on_track'
    else if (paceDelta >= -20) paceStatus = 'behind'
    else paceStatus = 'critical'

    // Focus areas
    const focusAreas: BriefingFocusArea[] = []
    const activeItems = todaySchedules || []

    // SLA-at-risk items
    const slaAtRisk = activeItems.filter((item) => {
      // Simplified - check items not yet disbursed
      return ['documents_collected', 'bank_submitted', 'bank_login'].includes(item.current_stage)
    })
    if (slaAtRisk.length > 0) {
      focusAreas.push({
        title: 'Follow-up Required',
        description: `${slaAtRisk.length} application(s) need follow-up at bank`,
        count: slaAtRisk.length,
        urgency: slaAtRisk.length > 3 ? 'high' : 'medium',
      })
    }

    // Document collection pending
    const docPending = activeItems.filter((i) => i.current_stage === 'qualified' || i.current_stage === 'application_filed')
    if (docPending.length > 0) {
      focusAreas.push({
        title: 'Document Collection',
        description: `${docPending.length} customer(s) pending document collection`,
        count: docPending.length,
        urgency: docPending.length > 5 ? 'high' : 'medium',
      })
    }

    // Credit approved - ready for disbursement
    const creditApproved = activeItems.filter((i) => i.current_stage === 'credit_approved' || i.current_stage === 'sanction_letter')
    if (creditApproved.length > 0) {
      focusAreas.push({
        title: 'Ready for Disbursement',
        description: `${creditApproved.length} case(s) approved - push for disbursement`,
        count: creditApproved.length,
        urgency: 'high',
      })
    }

    // Top opportunity (highest value in pipeline)
    let topOpportunity: BriefingOpportunity | null = null
    const pipelineItems = activeItems.filter((i) =>
      ['qualified', 'application_filed', 'documents_collected'].includes(i.current_stage)
    )
    if (pipelineItems.length > 0) {
      const topItem = pipelineItems.sort((a, b) => (b.loan_amount || 0) - (a.loan_amount || 0))[0]
      topOpportunity = {
        customer_name: topItem.customer_name || 'Unknown',
        product_type: topItem.product_type,
        loan_amount: topItem.loan_amount || 0,
        conversion_probability: 70, // Simplified - would use ML in production
        recommended_action: topItem.current_stage === 'qualified'
          ? 'File application today'
          : topItem.current_stage === 'application_filed'
            ? 'Collect remaining documents'
            : 'Submit to bank',
        best_contact_time: hour < 12 ? '10:00 AM - 12:00 PM' : '2:00 PM - 4:00 PM',
      }
    }

    const briefing: DailyBriefing = {
      greeting,
      day_of_month: currentDay,
      working_days_total: totalWorkingDays,
      month_progress_pct: Number(actualPct.toFixed(1)),
      pace_status: paceStatus,
      pace_delta_pct: Number(paceDelta.toFixed(1)),
      focus_areas: focusAreas,
      top_opportunity: topOpportunity,
      pending_follow_ups: slaAtRisk.length,
      sla_at_risk: slaAtRisk.length,
      meetings_today: 0, // Would fetch from schedule
      generated_at: now.toISOString(),
    }

    return NextResponse.json({ briefing })
  } catch (error) {
    apiLogger.error('Error in daily briefing API', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
