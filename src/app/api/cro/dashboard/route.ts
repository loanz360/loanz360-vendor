import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export const dynamic = 'force-dynamic'

/**
 * CRO Dashboard API
 * GET /api/cro/dashboard
 *
 * Returns aggregated dashboard data for the authenticated CRO:
 * - Pipeline stats (contacts, positive contacts, leads, deals)
 * - Today's activity metrics
 * - Target progress
 * - Recent activities
 * - Pending follow-ups count
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const todayStr = today.toISOString()
    const tomorrowStr = tomorrow.toISOString()

    // Current month for targets
    const currentMonth = today.getMonth() + 1
    const currentYear = today.getFullYear()

    // Run all queries in parallel for maximum performance
    const [
      leadsResult,
      contactsCountResult,
      positiveCountResult,
      dealsResult,
      followupsTodayResult,
      overdueFollowupsResult,
      dailyMetricsResult,
      targetResult,
      monthlySummaryResult,
      recentLeadsResult,
      recentFollowupsResult,
      streakResult,
    ] = await Promise.all([
      // 1. CRM leads aggregate (status + priority)
      supabase
        .from('crm_leads')
        .select('lead_status, priority, loan_amount_required')
        .is('deleted_at', null)
        .or(`assigned_to.eq.${userId},created_by.eq.${userId}`),

      // 2. Contacts count from AI-CRM pipeline
      supabase
        .from('crm_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('cro_id', userId),

      // 3. Positive contacts count
      supabase
        .from('positive_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('cro_id', userId),

      // 4. Deals aggregate
      supabase
        .from('crm_deals')
        .select('stage, deal_value')
        .eq('cro_id', userId),

      // 5. Today's follow-ups count
      supabase
        .from('crm_followups')
        .select('id', { count: 'exact', head: true })
        .gte('scheduled_at', todayStr)
        .lt('scheduled_at', tomorrowStr)
        .in('status', ['scheduled', 'pending']),

      // 6. Overdue follow-ups count
      supabase
        .from('crm_followups')
        .select('id', { count: 'exact', head: true })
        .lt('scheduled_at', todayStr)
        .in('status', ['scheduled', 'pending']),

      // 7. Today's daily metrics
      supabase
        .from('cro_daily_metrics')
        .select('*')
        .eq('cro_id', userId)
        .eq('date', today.toISOString().split('T')[0])
        .maybeSingle(),

      // 8. Current month targets
      supabase
        .from('cro_targets')
        .select('*')
        .eq('cro_id', userId)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .maybeSingle(),

      // 9. Monthly summary (for ranking)
      supabase
        .from('cro_monthly_summary')
        .select('company_rank, performance_score, conversion_rate')
        .eq('cro_id', userId)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .maybeSingle(),

      // 10. Recent 5 leads
      supabase
        .from('crm_leads')
        .select('id, lead_id, customer_name, customer_mobile, loan_type, lead_status, priority, lead_score, created_at')
        .is('deleted_at', null)
        .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(5),

      // 11. Today's follow-ups (5 items for display)
      supabase
        .from('crm_followups')
        .select(`
          id,
          lead_id,
          scheduled_at,
          purpose,
          status,
          lead:crm_leads!crm_followups_lead_id_fkey(customer_name, lead_id)
        `)
        .gte('scheduled_at', todayStr)
        .lt('scheduled_at', tomorrowStr)
        .in('status', ['scheduled', 'pending'])
        .order('scheduled_at', { ascending: true })
        .limit(5),

      // 12. Activity streak (from cro_streaks table)
      supabase
        .from('cro_streaks')
        .select('current_streak, best_streak, last_activity_date')
        .eq('cro_id', userId)
        .eq('streak_type', 'daily_calls')
        .maybeSingle(),
    ])

    // Process leads data
    const leads = leadsResult.data || []
    const totalLeads = leads.length
    const activeLeads = leads.filter(l => !['Converted', 'Lost', 'DNC'].includes(l.lead_status)).length
    const convertedLeads = leads.filter(l => l.lead_status === 'Converted').length
    const conversionRate = totalLeads > 0 ? parseFloat(((convertedLeads / totalLeads) * 100).toFixed(1)) : 0

    // Process deals data
    const deals = dealsResult.data || []
    const totalDealValue = deals.reduce((sum, d) => sum + (d.deal_value || 0), 0)
    const wonDeals = deals.filter(d => d.stage === 'won' || d.stage === 'closed_won')
    const wonDealValue = wonDeals.reduce((sum, d) => sum + (d.deal_value || 0), 0)

    // Daily metrics (from cro_daily_metrics table)
    const dailyMetrics = dailyMetricsResult.data
    const callsMadeToday = dailyMetrics?.calls_made || 0
    const avgCallDuration = dailyMetrics?.avg_call_duration_minutes || 0

    // Target progress
    const target = targetResult.data
    const monthlyTarget = target?.target_leads_converted || 0
    const currentProgress = convertedLeads

    // Monthly summary (ranking)
    const summary = monthlySummaryResult.data
    const teamRanking = summary?.company_rank || 0
    const performanceScore = summary?.performance_score || 0

    // Activity streak (real data from cro_streaks table)
    const streakData = streakResult.data
    const currentStreak = streakData?.current_streak || 0
    const bestStreak = streakData?.best_streak || 0
    const lastActivityDate = streakData?.last_activity_date || null

    // Recent activities (combine leads + followups into a timeline)
    const recentActivities: Array<{
      id: string
      type: string
      customer: string
      action: string
      time: string
      status: string
    }> = []

    // Add recent leads to activities
    const recentLeads = recentLeadsResult.data || []
    for (const lead of recentLeads.slice(0, 3)) {
      const timeAgo = getTimeAgo(lead.created_at)
      recentActivities.push({
        id: lead.id,
        type: lead.lead_status === 'Converted' ? 'conversion' : 'lead',
        customer: lead.customer_name,
        action: lead.lead_status === 'Converted'
          ? 'Converted to customer'
          : `New lead - ${lead.loan_type}`,
        time: timeAgo,
        status: lead.lead_status === 'Converted' ? 'success' : 'new'
      })
    }

    // Add today's followups to activities
    const todayFollowups = recentFollowupsResult.data || []
    for (const followup of todayFollowups.slice(0, 2)) {
      const lead = Array.isArray(followup.lead) ? followup.lead[0] : followup.lead
      recentActivities.push({
        id: followup.id,
        type: 'call',
        customer: lead?.customer_name || 'Unknown',
        action: followup.purpose || 'Follow-up scheduled',
        time: new Date(followup.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'pending'
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalLeads,
          activeLeads,
          convertedToday: dailyMetrics?.leads_converted || 0,
          conversionRate,
          callsMade: callsMadeToday,
          avgCallDuration: avgCallDuration > 0
            ? `${Math.floor(avgCallDuration)}:${String(Math.round((avgCallDuration % 1) * 60)).padStart(2, '0')}`
            : '0:00',
          responseTime: dailyMetrics?.avg_response_time_minutes
            ? `${(dailyMetrics.avg_response_time_minutes / 60).toFixed(1)} hrs`
            : '-',
          customerSatisfaction: dailyMetrics?.customer_satisfaction_score || 0,
          monthlyTarget,
          currentProgress,
          teamRanking,
          revenue: wonDealValue,
          pendingFollowups: (followupsTodayResult.count || 0) + (overdueFollowupsResult.count || 0),
          totalContacts: contactsCountResult.count || 0,
          positiveContacts: positiveCountResult.count || 0,
          totalDeals: deals.length,
          totalDealValue,
          performanceScore,
          currentStreak,
          bestStreak,
          lastActivityDate,
        },
        recentActivities,
        recentLeads,
        todayFollowups,
      }
    })
  } catch (error) {
    console.error('Error fetching CRO dashboard:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function getTimeAgo(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays === 1) return 'Yesterday'
  return `${diffDays} days ago`
}
