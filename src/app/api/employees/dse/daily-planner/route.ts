import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSERole } from '@/lib/auth/verify-dse-role'
import { calculateCommission } from '@/lib/validations/dse-validation'
import { STAGE_SLA_HOURS } from '@/lib/validations/dse-validation'


/**
 * GET /api/employees/dse/daily-planner
 *
 * Aggregates today's work items for the DSE:
 * - Daily target progress
 * - Urgent items (overdue follow-ups, SLA breached leads)
 * - Today's schedule (follow-ups + meetings)
 * - New items (leads created today)
 * - Pipeline snapshot (active deals by stage)
 * - Performance metrics (MTD conversions, commission, tier)
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSE role
    const roleCheck = await verifyDSERole(supabase, user.id)
    if (!roleCheck.isValid) return roleCheck.response

    const now = new Date()
    const today = now.toISOString().split('T')[0] // YYYY-MM-DD
    const todayStart = `${today}T00:00:00.000Z`
    const todayEnd = `${today}T23:59:59.999Z`
    const monthStart = `${today.slice(0, 7)}-01`
    const monthStartISO = `${monthStart}T00:00:00.000Z`

    // Run all queries in parallel for performance
    const [
      remindersResult,
      meetingsResult,
      newLeadsResult,
      newPartnerLeadsResult,
      pipelineResult,
      overdueRemindersResult,
      slaBreachedResult,
      disbursedDealsResult,
      allDisbursedResult,
    ] = await Promise.all([
      // 1. Today's reminders (follow-ups)
      supabase
        .from('dse_reminders')
        .select('id, title, reminder_type, reminder_datetime, priority, status, customer_id, lead_id, dse_customers(full_name), dse_leads(customer_name)')
        .eq('owner_id', user.id)
        .eq('status', 'Active')
        .gte('reminder_datetime', todayStart)
        .lte('reminder_datetime', todayEnd)
        .order('reminder_datetime', { ascending: true }),

      // 2. Today's meetings
      supabase
        .from('dse_meetings')
        .select('id, title, scheduled_date, start_time, end_time, meeting_type, location_type, location_address, status, customer_id, lead_id, dse_customers(full_name), dse_leads(customer_name)')
        .eq('dse_user_id', user.id)
        .eq('scheduled_date', today)
        .order('start_time', { ascending: true }),

      // 3. New leads created today (own)
      supabase
        .from('dse_leads')
        .select('id', { count: 'exact', head: true })
        .eq('dse_user_id', user.id)
        .gte('created_at', todayStart)
        .lte('created_at', todayEnd)
        .neq('source', 'Partner'),

      // 4. New partner leads today
      supabase
        .from('dse_leads')
        .select('id', { count: 'exact', head: true })
        .eq('dse_user_id', user.id)
        .gte('created_at', todayStart)
        .lte('created_at', todayEnd)
        .eq('source', 'Partner'),

      // 5. Pipeline - all active leads (not Won/Lost)
      supabase
        .from('dse_leads')
        .select('id, lead_stage, estimated_value')
        .eq('dse_user_id', user.id)
        .not('lead_stage', 'in', '("Won","Lost")'),

      // 6. Overdue reminders (past due, still active)
      supabase
        .from('dse_reminders')
        .select('id, title, reminder_type, reminder_datetime, priority, customer_id, lead_id, dse_customers(full_name), dse_leads(customer_name)')
        .eq('owner_id', user.id)
        .eq('status', 'Active')
        .lt('reminder_datetime', todayStart)
        .order('reminder_datetime', { ascending: true })
        .limit(10),

      // 7. SLA breached leads - leads that have been in their current stage too long
      supabase
        .from('dse_leads')
        .select('id, customer_name, lead_stage, stage_changed_at, created_at')
        .eq('dse_user_id', user.id)
        .not('lead_stage', 'in', '("Won","Lost")'),

      // 8. Disbursed deals this month (for conversion count)
      supabase
        .from('crm_deals')
        .select('id, loan_amount, product_type, disbursed_at')
        .eq('dse_user_id', user.id)
        .eq('status', 'disbursed')
        .gte('disbursed_at', monthStartISO),

      // 9. All disbursed deals this month for total commission
      supabase
        .from('crm_deals')
        .select('id, loan_amount, product_type')
        .eq('dse_user_id', user.id)
        .eq('status', 'disbursed')
        .gte('disbursed_at', monthStartISO),
    ])

    // Process reminders into follow-ups
    const followUps = (remindersResult.data || []).map((r) => ({
      id: r.id,
      customer_name: r.dse_customers?.full_name || r.dse_leads?.customer_name || 'Unknown',
      reminder_type: r.reminder_type,
      time: r.reminder_datetime,
      priority: r.priority,
    }))

    // Process meetings
    const meetings = (meetingsResult.data || []).map((m) => ({
      id: m.id,
      customer_name: m.dse_customers?.full_name || m.dse_leads?.customer_name || 'Unknown',
      title: m.title,
      time: `${m.scheduled_date}T${m.start_time}`,
      location: m.location_address || m.location_type || m.meeting_type,
    }))

    // Process overdue reminders
    const overdueItems = (overdueRemindersResult.data || []).map((r) => ({
      id: r.id,
      customer_name: r.dse_customers?.full_name || r.dse_leads?.customer_name || 'Unknown',
      reminder_type: r.reminder_type,
      overdue_since: r.reminder_datetime,
      priority: r.priority,
    }))

    // Process SLA breached leads
    const slaBreachedLeads = (slaBreachedResult.data || []).filter((lead) => {
      const slaHours = STAGE_SLA_HOURS[lead.lead_stage]
      if (!slaHours) return false
      const stageDate = lead.stage_changed_at || lead.created_at
      if (!stageDate) return false
      const stageTime = new Date(stageDate).getTime()
      const slaDeadline = stageTime + slaHours * 60 * 60 * 1000
      return now.getTime() > slaDeadline
    }).map((lead) => ({
      id: lead.id,
      customer_name: lead.customer_name,
      stage: lead.lead_stage,
      stage_since: lead.stage_changed_at || lead.created_at,
    }))

    // Pipeline snapshot
    const pipelineLeads = pipelineResult.data || []
    const byStage: Record<string, { count: number; value: number }> = {}
    let totalValue = 0

    for (const lead of pipelineLeads) {
      const stage = lead.lead_stage || 'Unknown'
      if (!byStage[stage]) {
        byStage[stage] = { count: 0, value: 0 }
      }
      byStage[stage].count++
      const val = Number(lead.estimated_value) || 0
      byStage[stage].value += val
      totalValue += val
    }

    // Performance - conversions & commission
    const disbursedDeals = disbursedDealsResult.data || []
    const conversionsMTD = disbursedDeals.length

    // Calculate total commission
    let commissionMTD = 0
    let tier = 'Bronze'
    let nextTierIn = 6

    if (disbursedDeals.length > 0) {
      for (const deal of disbursedDeals) {
        const result = calculateCommission({
          loan_amount: Number(deal.loan_amount) || 0,
          product_type: deal.product_type || 'Home Loan',
          monthly_conversions: conversionsMTD,
        })
        commissionMTD += result.commission
        tier = result.tier
        nextTierIn = result.next_tier_in
      }
    } else {
      const result = calculateCommission({
        loan_amount: 0,
        product_type: 'Home Loan',
        monthly_conversions: 0,
      })
      tier = result.tier
      nextTierIn = result.next_tier_in
    }

    // Calculate conversion rate (won leads / total closed leads this month)
    // For daily target: assume 5 leads per day target
    const dailyTarget = 5
    const todaysLeadCount = (newLeadsResult.count || 0) + (newPartnerLeadsResult.count || 0)

    // Avg response time - we'll use a placeholder since we'd need interaction logs
    const avgResponseTimeHours = 0

    const response = {
      success: true,
      data: {
        date: today,
        target: {
          daily_leads: dailyTarget,
          achieved: todaysLeadCount,
          remaining: Math.max(0, dailyTarget - todaysLeadCount),
        },
        urgent_items: [
          {
            type: 'overdue_followup' as const,
            count: overdueItems.length,
            items: overdueItems,
          },
          {
            type: 'sla_breached' as const,
            count: slaBreachedLeads.length,
            items: slaBreachedLeads.slice(0, 10),
          },
        ],
        today_schedule: {
          follow_ups: followUps,
          meetings: meetings,
        },
        new_items: {
          new_leads: newLeadsResult.count || 0,
          new_partner_leads: newPartnerLeadsResult.count || 0,
        },
        pipeline_snapshot: {
          total_active: pipelineLeads.length,
          total_value: totalValue,
          by_stage: byStage,
        },
        performance: {
          conversions_mtd: conversionsMTD,
          conversion_rate: 0, // Would need total closed leads to calculate properly
          avg_response_time_hours: avgResponseTimeHours,
          commission_mtd: commissionMTD,
          tier,
          next_tier_in: nextTierIn,
        },
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    apiLogger.error('Daily planner API error', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
