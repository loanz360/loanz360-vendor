/**
 * API Route: CP Dashboard Aggregated Data
 * GET /api/partners/cp/dashboard - Get aggregated dashboard data for CP
 *
 * Combines application stats, commission summary, recent applications,
 * contests, and weekly goal into a single endpoint for the CP dashboard.
 *
 * Rate Limit: 60 requests per minute (read operation)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export const dynamic = 'force-dynamic'

interface DashboardStats {
  total_applications: number
  active_applications: number
  approved_applications: number
  disbursed_applications: number
  conversion_rate: number
  this_month_applications: number
  this_month_disbursals: number
  lifetime_earnings: number
  estimated_payout: number
}

interface RecentApplication {
  id: string
  application_id: string
  borrower_name: string
  loan_type: string
  status: string
  loan_amount: number
  created_at: string
}

interface DashboardData {
  stats: DashboardStats
  recent_applications: RecentApplication[]
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
      .eq('partner_type', 'CHANNEL_PARTNER')
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
            total_applications: 0,
            active_applications: 0,
            approved_applications: 0,
            disbursed_applications: 0,
            conversion_rate: 0,
            this_month_applications: 0,
            this_month_disbursals: 0,
            lifetime_earnings: 0,
            estimated_payout: 0,
          },
          recent_applications: [],
          active_contests: 0,
          weekly_goal: { target: 10, current: 0 },
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
    ] = await Promise.all([
      // 3a. All leads for stats calculation
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
    ])

    // 4. Calculate application stats
    const leads = leadsResult.data || []
    const totalApplications = leads.length
    const activeApplications = leads.filter((l) =>
      ['IN_PROGRESS', 'CONTACTED', 'DOCUMENTS_PENDING', 'NEW', 'NEW_UNASSIGNED', 'PENDING'].includes(
        l.lead_status || ''
      )
    ).length
    const approvedApplications = leads.filter((l) =>
      ['SANCTIONED', 'APPROVED'].includes(l.lead_status || '')
    ).length
    const disbursedApplications = leads.filter((l) =>
      ['DISBURSED'].includes(l.lead_status || '')
    ).length
    const conversionRate =
      totalApplications > 0 ? Math.round((disbursedApplications / totalApplications) * 100) : 0

    // 5. Calculate this month's stats
    const monthLeads = monthLeadsResult.data || []
    const thisMonthApplications = monthLeads.length
    const thisMonthDisbursals = monthLeads.filter((l) =>
      ['DISBURSED'].includes(l.lead_status || '')
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

    // 7. Format recent applications
    const recentApplications: RecentApplication[] = (recentLeadsResult.data || []).map((lead) => ({
      id: lead.id,
      application_id: lead.lead_id || '',
      borrower_name: lead.customer_name || '',
      loan_type: lead.loan_type || '',
      status: lead.lead_status || '',
      loan_amount: Number(lead.required_loan_amount) || 0,
      created_at: lead.created_at || '',
    }))

    // 8. Active contests count
    const activeContests = contestsResult.count || 0

    // 9. Weekly goal (default target of 10 applications per week for CP)
    const weeklyGoal = {
      target: 10,
      current: weeklyLeadsResult.count || 0,
    }

    // 10. Return aggregated response
    return NextResponse.json({
      success: true,
      data: {
        stats: {
          total_applications: totalApplications,
          active_applications: activeApplications,
          approved_applications: approvedApplications,
          disbursed_applications: disbursedApplications,
          conversion_rate: conversionRate,
          this_month_applications: thisMonthApplications,
          this_month_disbursals: thisMonthDisbursals,
          lifetime_earnings: lifetimeEarnings,
          estimated_payout: estimatedPayout,
        },
        recent_applications: recentApplications,
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
