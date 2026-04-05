import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cro/reports?period=week|month|quarter&from=...&to=...
 * Server-side aggregated analytics for the authenticated CRO.
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Role verification - only CRO roles can access this endpoint
    const userRole = user.user_metadata?.sub_role || user.user_metadata?.role || ''
    const allowedRoles = ['CRO', 'CUSTOMER RELATIONSHIP OFFICER', 'CRO_TEAM_LEADER', 'CRO_STATE_MANAGER', 'SUPER_ADMIN', 'ADMIN']
    if (!allowedRoles.some(r => userRole.toUpperCase() === r)) {
      return NextResponse.json({ success: false, error: 'Forbidden: CRO access required' }, { status: 403 })
    }

    const croId = user.id
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month'

    // Calculate date range
    const now = new Date()
    let fromDate: Date

    switch (period) {
      case 'week':
        fromDate = new Date(now)
        fromDate.setDate(now.getDate() - 7)
        break
      case 'quarter':
        fromDate = new Date(now)
        fromDate.setMonth(now.getMonth() - 3)
        break
      case 'year':
        fromDate = new Date(now)
        fromDate.setFullYear(now.getFullYear() - 1)
        break
      case 'month':
      default:
        fromDate = new Date(now)
        fromDate.setMonth(now.getMonth() - 1)
        break
    }

    // Custom date range override
    const customFrom = searchParams.get('from')
    const customTo = searchParams.get('to')
    if (customFrom) fromDate = new Date(customFrom)
    const toDate = customTo ? new Date(customTo) : now

    const fromISO = fromDate.toISOString()
    const toISO = toDate.toISOString()

    // Parallel data fetches
    const [
      contactsResult,
      positiveContactsResult,
      leadsResult,
      dealsResult,
      callLogsResult,
      followupsResult,
    ] = await Promise.all([
      // Contacts in period
      supabase
        .from('crm_contacts')
        .select('id, status, created_at', { count: 'exact' })
        .or(`cro_id.eq.${croId},assigned_to_cro.eq.${croId}`)
        .gte('created_at', fromISO)
        .lte('created_at', toISO),

      // Positive contacts in period
      supabase
        .from('positive_contacts')
        .select('id, status, created_at', { count: 'exact' })
        .eq('cro_id', croId)
        .gte('created_at', fromISO)
        .lte('created_at', toISO),

      // Leads in period
      supabase
        .from('crm_leads')
        .select('id, status, loan_type, loan_amount, created_at', { count: 'exact' })
        .eq('cro_id', croId)
        .gte('created_at', fromISO)
        .lte('created_at', toISO),

      // Deals in period
      supabase
        .from('crm_deals')
        .select('id, stage, loan_amount, created_at', { count: 'exact' })
        .eq('cro_id', croId)
        .gte('created_at', fromISO)
        .lte('created_at', toISO),

      // Call logs in period
      supabase
        .from('cro_call_logs')
        .select('id, call_outcome, call_duration_seconds, ai_rating, interest_level, call_started_at')
        .eq('cro_id', croId)
        .gte('call_started_at', fromISO)
        .lte('call_started_at', toISO)
        .order('call_started_at', { ascending: true }),

      // Follow-ups in period
      supabase
        .from('crm_followups')
        .select('id, status, scheduled_at, completed_at')
        .eq('owner_id', croId)
        .gte('scheduled_at', fromISO)
        .lte('scheduled_at', toISO),
    ])

    const contacts = contactsResult.data || []
    const positiveContacts = positiveContactsResult.data || []
    const leads = leadsResult.data || []
    const deals = dealsResult.data || []
    const callLogs = callLogsResult.data || []
    const followups = followupsResult.data || []

    // Compute call analytics
    const totalCalls = callLogs.length
    const connectedCalls = callLogs.filter(c =>
      ['connected', 'interested', 'callback_requested'].includes(c.call_outcome)
    ).length
    const avgDuration = totalCalls > 0
      ? Math.round(callLogs.reduce((sum, c) => sum + (c.call_duration_seconds || 0), 0) / totalCalls)
      : 0
    const avgAIRating = (() => {
      const rated = callLogs.filter(c => c.ai_rating)
      return rated.length > 0
        ? Number((rated.reduce((sum, c) => sum + (c.ai_rating || 0), 0) / rated.length).toFixed(1))
        : 0
    })()

    // Call outcome distribution
    const outcomeMap: Record<string, number> = {}
    callLogs.forEach(c => {
      outcomeMap[c.call_outcome] = (outcomeMap[c.call_outcome] || 0) + 1
    })

    // Interest level distribution
    const interestMap: Record<string, number> = {}
    callLogs.forEach(c => {
      if (c.interest_level) {
        interestMap[c.interest_level] = (interestMap[c.interest_level] || 0) + 1
      }
    })

    // Daily call trend
    const dailyCalls: Record<string, { calls: number; connected: number; duration: number }> = {}
    callLogs.forEach(c => {
      const day = c.call_started_at.slice(0, 10)
      if (!dailyCalls[day]) dailyCalls[day] = { calls: 0, connected: 0, duration: 0 }
      dailyCalls[day].calls++
      dailyCalls[day].duration += c.call_duration_seconds || 0
      if (['connected', 'interested', 'callback_requested'].includes(c.call_outcome)) {
        dailyCalls[day].connected++
      }
    })

    // Conversion funnel
    const funnel = {
      contacts: contacts.length,
      positiveContacts: positiveContacts.length,
      leads: leads.length,
      deals: deals.length,
      conversions: deals.filter(d => d.stage === 'won' || d.stage === 'closed_won').length,
    }

    // Lead status breakdown
    const leadStatusMap: Record<string, number> = {}
    leads.forEach(l => {
      leadStatusMap[l.status] = (leadStatusMap[l.status] || 0) + 1
    })

    // Loan type breakdown
    const loanTypeMap: Record<string, number> = {}
    leads.forEach(l => {
      if (l.loan_type) {
        loanTypeMap[l.loan_type] = (loanTypeMap[l.loan_type] || 0) + 1
      }
    })

    // Pipeline value
    const totalPipelineValue = leads.reduce((sum, l) => sum + (Number(l.loan_amount) || 0), 0)
    const totalDealValue = deals.reduce((sum, d) => sum + (Number(d.loan_amount) || 0), 0)

    // Follow-up stats
    const completedFollowups = followups.filter(f => f.status === 'Completed').length
    const pendingFollowups = followups.filter(f => f.status === 'Pending').length
    const overdueFollowups = followups.filter(
      f => f.status === 'Pending' && new Date(f.scheduled_at) < now
    ).length

    return NextResponse.json({
      success: true,
      data: {
        period,
        dateRange: { from: fromISO, to: toISO },
        summary: {
          totalContacts: contacts.length,
          totalPositiveContacts: positiveContacts.length,
          totalLeads: leads.length,
          totalDeals: deals.length,
          totalCalls,
          connectedCalls,
          connectRate: totalCalls > 0 ? Math.round((connectedCalls / totalCalls) * 100) : 0,
          avgCallDuration: avgDuration,
          avgAIRating,
          totalPipelineValue,
          totalDealValue,
        },
        funnel,
        callAnalytics: {
          outcomeDistribution: outcomeMap,
          interestDistribution: interestMap,
          dailyTrend: Object.entries(dailyCalls)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, data]) => ({ date, ...data })),
        },
        leadBreakdown: {
          byStatus: leadStatusMap,
          byLoanType: loanTypeMap,
        },
        followupStats: {
          total: followups.length,
          completed: completedFollowups,
          pending: pendingFollowups,
          overdue: overdueFollowups,
          completionRate: followups.length > 0
            ? Math.round((completedFollowups / followups.length) * 100)
            : 0,
        },
      },
    })
  } catch (error) {
    apiLogger.error('CRO reports error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
