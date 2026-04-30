/**
 * API Route: BP Dashboard Aggregated Data
 * GET /api/partners/bp/dashboard - Get aggregated dashboard data for BP
 *
 * Combines lead stats, commission summary, recent leads, contests,
 * team stats, and weekly goal into a single endpoint for the BP dashboard.
 *
 * Rate Limit: 60 requests per minute (read operation)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


interface DashboardStats {
  total_leads: number
  active_leads: number
  converted_leads: number
  conversion_rate: number
  this_month_leads: number
  this_month_conversions: number
  lifetime_earnings: number
  estimated_payout: number
  team_members: number
  team_leads: number
}

interface RecentLead {
  id: string
  lead_id: string
  customer_name: string
  loan_type: string
  status: string
  loan_amount: number
  created_at: string
}

interface DashboardData {
  stats: DashboardStats
  recent_leads: RecentLead[]
  active_contests: number
  weekly_goal: {
    target: number
    current: number
  }
}

interface DashboardResponse {
  success: boolean
  data?: DashboardData
  error?: string
}

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // 1. Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as DashboardResponse,
        { status: 401 }
      )
    }

    // 2. Get partner information with partner_type filter for security
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, partner_type')
      .eq('user_id', user.id)
      .eq('partner_type', 'BUSINESS_PARTNER')
      .maybeSingle()

    if (partnerError) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch partner information' } as DashboardResponse,
        { status: 500 }
      )
    }

    // If no partner profile exists, return empty dashboard data
    if (!partner) {
      return NextResponse.json({
        success: true,
        data: {
          stats: {
            total_leads: 0,
            active_leads: 0,
            converted_leads: 0,
            conversion_rate: 0,
            this_month_leads: 0,
            this_month_conversions: 0,
            lifetime_earnings: 0,
            estimated_payout: 0,
            team_members: 0,
            team_leads: 0,
          },
          recent_leads: [],
          active_contests: 0,
          weekly_goal: { target: 15, current: 0 },
        },
      } as DashboardResponse)
    }

    // 3. Fetch all data in parallel for performance
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [
      leadsResult,
      recentLeadsResult,
      commissionResult,
      contestsResult,
      weeklyLeadsResult,
      monthLeadsResult,
      teamMembersResult,
      teamLeadsResult,
    ] = await Promise.all([
      // 3a. All leads for stats calculation (BP's own leads)
      supabase
        .from('leads')
        .select('lead_status, form_status')
        .eq('partner_id', partner.id),

      // 3b. Recent 5 leads
      supabase
        .from('leads')
        .select('id, lead_id, customer_name, loan_type, lead_status, required_loan_amount, created_at')
        .eq('partner_id', partner.id)
        .order('created_at', { ascending: false })
        .limit(5),

      // 3c. Commission data from partner_leads
      supabase
        .from('partner_leads')
        .select('status, estimated_commission, actual_commission, commission_paid')
        .eq('partner_id', partner.id)
        .eq('is_active', true),

      // 3d. Active contests count
      supabase
        .from('contests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .is('deleted_at', null),

      // 3e. This week's leads for weekly goal
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('partner_id', partner.id)
        .gte('created_at', weekStart),

      // 3f. This month's leads for monthly stats
      supabase
        .from('leads')
        .select('lead_status')
        .eq('partner_id', partner.id)
        .gte('created_at', monthStart),

      // 3g. Team members (BAs under this BP)
      supabase
        .from('partners')
        .select('id', { count: 'exact', head: true })
        .eq('referrer_id', partner.id)
        .eq('partner_type', 'BUSINESS_ASSOCIATE'),

      // 3h. Team leads (leads from BAs under this BP)
      supabase
        .from('partners')
        .select('id')
        .eq('referrer_id', partner.id)
        .eq('partner_type', 'BUSINESS_ASSOCIATE'),
    ])

    // Count team leads
    let teamLeadCount = 0
    const teamMemberIds = (teamLeadsResult.data || []).map((m) => m.id)
    if (teamMemberIds.length > 0) {
      const { count } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .in('partner_id', teamMemberIds)

      teamLeadCount = count || 0
    }

    // 4. Calculate lead stats
    const leads = leadsResult.data || []
    const totalLeads = leads.length
    const activeLeads = leads.filter((l) =>
      ['IN_PROGRESS', 'CONTACTED', 'DOCUMENTS_PENDING', 'NEW', 'NEW_UNASSIGNED', 'PENDING'].includes(
        l.lead_status || ''
      )
    ).length
    const convertedLeads = leads.filter((l) =>
      ['DISBURSED', 'SANCTIONED', 'APPROVED', 'CONVERTED'].includes(l.lead_status || '')
    ).length
    const conversionRate =
      totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0

    // 5. Calculate this month's stats
    const monthLeads = monthLeadsResult.data || []
    const thisMonthLeads = monthLeads.length
    const thisMonthConversions = monthLeads.filter((l) =>
      ['DISBURSED', 'SANCTIONED', 'APPROVED', 'CONVERTED'].includes(l.lead_status || '')
    ).length

    // 6. Calculate commission summary
    let lifetimeEarnings = 0
    let estimatedPayout = 0

    const commissionLeads = commissionResult.data || []
    commissionLeads.forEach((lead) => {
      const estimatedAmount = Number(lead.estimated_commission) || 0
      const actualAmount = Number(lead.actual_commission) || 0
      const status = (lead.status || '').toLowerCase()
      const isPaid = lead.commission_paid === true

      if (status === 'disbursed' && isPaid) {
        lifetimeEarnings += actualAmount || estimatedAmount
      } else if (['new', 'in_progress', 'documentation', 'bank_processing'].includes(status)) {
        estimatedPayout += estimatedAmount
      } else if (status === 'sanctioned') {
        estimatedPayout += actualAmount || estimatedAmount
      } else if (status === 'disbursed' && !isPaid) {
        estimatedPayout += actualAmount || estimatedAmount
      }
    })

    // 7. Format recent leads
    const recentLeads: RecentLead[] = (recentLeadsResult.data || []).map((lead) => ({
      id: lead.id,
      lead_id: lead.lead_id || '',
      customer_name: lead.customer_name || '',
      loan_type: lead.loan_type || '',
      status: lead.lead_status || '',
      loan_amount: Number(lead.required_loan_amount) || 0,
      created_at: lead.created_at || '',
    }))

    // 8. Active contests count
    const activeContests = contestsResult.count || 0

    // 9. Weekly goal (default target of 15 leads per week for BP)
    const weeklyGoal = {
      target: 15,
      current: weeklyLeadsResult.count || 0,
    }

    // 10. Return aggregated response
    return NextResponse.json({
      success: true,
      data: {
        stats: {
          total_leads: totalLeads,
          active_leads: activeLeads,
          converted_leads: convertedLeads,
          conversion_rate: conversionRate,
          this_month_leads: thisMonthLeads,
          this_month_conversions: thisMonthConversions,
          lifetime_earnings: lifetimeEarnings,
          estimated_payout: estimatedPayout,
          team_members: teamMembersResult.count || 0,
          team_leads: teamLeadCount,
        },
        recent_leads: recentLeads,
        active_contests: activeContests,
        weekly_goal: weeklyGoal,
      },
    } as DashboardResponse)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      } as DashboardResponse,
      { status: 500 }
    )
  }
}
