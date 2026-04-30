/**
 * CRO Analytics API
 *
 * Real analytics data for the CRO analytics dashboard.
 * Queries cro_call_logs, crm_leads, crm_deals, crm_contacts, crm_followups,
 * cro_monthly_summary, and cro_ai_insights to provide today/week/month metrics
 * with trend calculations plus extended conversion, revenue, activity, and
 * pipeline-health metrics.
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import {
  verifyCROAuth,
  createErrorResponse,
} from '@/lib/api/ai-crm-middleware'
import {
  getTodayStartIST,
  getWeekStartIST,
  getMonthStartIST,
} from '@/lib/constants/sales-pipeline'


// =============================================================================
// DATE HELPERS (only keeping what's NOT in shared constants)
// =============================================================================

/** Get previous week range (7-14 days ago) for trend comparison */
function getPrevWeekRange(): { start: string; end: string } {
  const now = new Date()
  const prevWeekEnd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const prevWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  return {
    start: prevWeekStart.toISOString(),
    end: prevWeekEnd.toISOString(),
  }
}

/** Get current month string in YYYY-MM format (IST) */
function getCurrentMonthStr(): { month: string; year: number } {
  const now = new Date()
  const istOffsetMs = 5.5 * 60 * 60 * 1000
  const istNow = new Date(now.getTime() + istOffsetMs)
  const year = istNow.getUTCFullYear()
  const monthNum = istNow.getUTCMonth() + 1
  const month = `${year}-${String(monthNum).padStart(2, '0')}`
  return { month, year }
}

/** Get previous month start as ISO string */
function getPrevMonthStartIST(): string {
  const now = new Date()
  const istOffsetMs = 5.5 * 60 * 60 * 1000
  const istNow = new Date(now.getTime() + istOffsetMs)
  istNow.setUTCHours(0, 0, 0, 0)
  istNow.setUTCDate(1)
  istNow.setUTCMonth(istNow.getUTCMonth() - 1)
  return new Date(istNow.getTime() - istOffsetMs).toISOString()
}

/** Get previous month end (= current month start) as ISO string */
function getPrevMonthEndIST(): string {
  return getMonthStartIST()
}

/** Get 72 hours ago as ISO string */
function get72HoursAgo(): string {
  return new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()
}

/** Get 7 days ago as ISO string */
function get7DaysAgo(): string {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
}

// =============================================================================
// TREND CALCULATION
// =============================================================================

type TrendDirection = 'up' | 'down' | 'stable'

/** Compare current vs previous: >5% increase = 'up', >5% decrease = 'down', else 'stable' */
function calculateTrend(current: number, previous: number): TrendDirection {
  if (previous === 0) {
    return current > 0 ? 'up' : 'stable'
  }
  const changePercent = ((current - previous) / previous) * 100
  if (changePercent > 5) return 'up'
  if (changePercent < -5) return 'down'
  return 'stable'
}

/** Calculate percentage change */
function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

// =============================================================================
// CONNECTED OUTCOMES (calls that actually reached the customer)
// =============================================================================

const CONNECTED_OUTCOMES = ['connected', 'interested', 'callback_requested']
const POSITIVE_OUTCOMES = ['interested', 'callback_requested']

// =============================================================================
// ROUTE HANDLER
// =============================================================================

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  // Authenticate and verify CRO role
  const authResult = await verifyCROAuth(request)
  if (!authResult.success) {
    return authResult.response
  }

  const { user, supabase, requestId } = authResult.context

  try {
    // =========================================================================
    // DATE BOUNDARIES (using shared IST-consistent helpers)
    // =========================================================================
    const todayStart = getTodayStartIST()
    const weekStart = getWeekStartIST()
    const monthStart = getMonthStartIST()
    const prevWeek = getPrevWeekRange()
    const { month: currentMonth, year: currentYear } = getCurrentMonthStr()
    const prevMonthStart = getPrevMonthStartIST()
    const prevMonthEnd = getPrevMonthEndIST()
    const staleThreshold = get72HoursAgo()
    const agingThreshold = get7DaysAgo()
    const nowISO = new Date().toISOString()

    // =========================================================================
    // PARALLEL QUERIES - All scoped to authenticated CRO's user.id
    // =========================================================================
    const [
      todayCallsResult,
      weekCallsResult,
      monthCallsResult,
      prevWeekCallsResult,
      todayLeadsResult,
      weekLeadsResult,
      weekLeadsConvertedResult,
      monthLeadsResult,
      monthLeadsConvertedResult,
      prevWeekLeadsResult,
      prevWeekLeadsConvertedResult,
      monthlySummaryResult,
      strengthInsightsResult,
      improvementInsightsResult,
      totalCROsResult,
      // ---- EXTENDED: Conversion metrics ----
      weekContactsTotalResult,
      prevWeekContactsTotalResult,
      weekPositiveTotalResult,
      prevWeekPositiveTotalResult,
      allContactsTotalResult,
      allPositiveTotalResult,
      allLeadsTotalResult,
      allDealsTotalResult,
      // ---- EXTENDED: Revenue metrics ----
      monthDealsResult,
      prevMonthDealsResult,
      pipelineDealsResult,
      // ---- EXTENDED: Activity metrics ----
      weekCallsWithTimeResult,
      weekFollowupsCompletedResult,
      firstCallResponseResult,
      // ---- EXTENDED: Loan type, daily activity, top hours ----
      loanTypeResult,
      dailyActivityResult,
      hourlyActivityResult,
      // ---- EXTENDED: Pipeline Health ----
      agingLeadsResult,
      overdueFollowupsResult,
      staleContactsResult,
    ] = await Promise.all([
      // TODAY calls
      supabase
        .from('cro_call_logs')
        .select('call_outcome, call_duration_seconds, ai_rating')
        .eq('cro_id', user.id)
        .gte('call_started_at', todayStart),

      // WEEK calls
      supabase
        .from('cro_call_logs')
        .select('call_outcome, call_duration_seconds, ai_rating')
        .eq('cro_id', user.id)
        .gte('call_started_at', weekStart),

      // MONTH calls
      supabase
        .from('cro_call_logs')
        .select('call_outcome, ai_rating')
        .eq('cro_id', user.id)
        .gte('call_started_at', monthStart),

      // PREV WEEK calls (for trend comparison)
      supabase
        .from('cro_call_logs')
        .select('call_outcome, call_duration_seconds, ai_rating')
        .eq('cro_id', user.id)
        .gte('call_started_at', prevWeek.start)
        .lt('call_started_at', prevWeek.end),

      // TODAY leads created
      supabase
        .from('crm_leads')
        .select('id', { count: 'exact', head: true })
        .eq('cro_id', user.id)
        .gte('created_at', todayStart),

      // WEEK leads created
      supabase
        .from('crm_leads')
        .select('id', { count: 'exact', head: true })
        .eq('cro_id', user.id)
        .gte('created_at', weekStart),

      // WEEK leads converted
      supabase
        .from('crm_leads')
        .select('id', { count: 'exact', head: true })
        .eq('cro_id', user.id)
        .eq('status', 'converted')
        .gte('converted_at', weekStart),

      // MONTH leads created
      supabase
        .from('crm_leads')
        .select('id', { count: 'exact', head: true })
        .eq('cro_id', user.id)
        .gte('created_at', monthStart),

      // MONTH leads converted
      supabase
        .from('crm_leads')
        .select('id', { count: 'exact', head: true })
        .eq('cro_id', user.id)
        .eq('status', 'converted')
        .gte('converted_at', monthStart),

      // PREV WEEK leads created (for trend)
      supabase
        .from('crm_leads')
        .select('id', { count: 'exact', head: true })
        .eq('cro_id', user.id)
        .gte('created_at', prevWeek.start)
        .lt('created_at', prevWeek.end),

      // PREV WEEK leads converted (for trend)
      supabase
        .from('crm_leads')
        .select('id', { count: 'exact', head: true })
        .eq('cro_id', user.id)
        .eq('status', 'converted')
        .gte('converted_at', prevWeek.start)
        .lt('converted_at', prevWeek.end),

      // MONTHLY SUMMARY (grade, aiScore, percentileRank)
      supabase
        .from('cro_monthly_summary')
        .select('performance_grade, performance_score, company_rank')
        .eq('cro_id', user.id)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .limit(1)
        .maybeSingle(),

      // AI INSIGHTS: bestPoints (strength type)
      supabase
        .from('cro_ai_insights')
        .select('title, description')
        .eq('cro_id', user.id)
        .eq('insight_type', 'strength')
        .eq('is_dismissed', false)
        .order('created_at', { ascending: false })
        .limit(5),

      // AI INSIGHTS: improvementAreas (improvement type)
      supabase
        .from('cro_ai_insights')
        .select('title, description')
        .eq('cro_id', user.id)
        .eq('insight_type', 'improvement')
        .eq('is_dismissed', false)
        .order('created_at', { ascending: false })
        .limit(5),

      // TOTAL CRO count for percentile calculation
      supabase
        .from('cro_monthly_summary')
        .select('id', { count: 'exact', head: true })
        .eq('month', currentMonth)
        .eq('year', currentYear),

      // ---- EXTENDED: Conversion metrics ----
      // This week contacts assigned
      supabase
        .from('crm_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to_cro', user.id)
        .gte('assigned_at', weekStart),

      // Prev week contacts assigned
      supabase
        .from('crm_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to_cro', user.id)
        .gte('assigned_at', prevWeek.start)
        .lt('assigned_at', prevWeek.end),

      // This week positive contacts created
      supabase
        .from('crm_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to_cro', user.id)
        .eq('status', 'positive')
        .gte('updated_at', weekStart),

      // Prev week positive contacts
      supabase
        .from('crm_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to_cro', user.id)
        .eq('status', 'positive')
        .gte('updated_at', prevWeek.start)
        .lt('updated_at', prevWeek.end),

      // All-time contacts for overall pipeline
      supabase
        .from('crm_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to_cro', user.id),

      // All-time positive contacts
      supabase
        .from('crm_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to_cro', user.id)
        .in('status', ['positive', 'converted']),

      // All-time leads
      supabase
        .from('crm_leads')
        .select('id', { count: 'exact', head: true })
        .eq('cro_id', user.id),

      // All-time deals
      supabase
        .from('crm_deals')
        .select('id', { count: 'exact', head: true })
        .eq('cro_id', user.id),

      // ---- EXTENDED: Revenue metrics ----
      // Deals this month (with loan_amount for revenue calc)
      supabase
        .from('crm_deals')
        .select('loan_amount, sanctioned_amount, disbursed_amount, status')
        .eq('cro_id', user.id)
        .gte('created_at', monthStart),

      // Deals prev month (for revenue trend)
      supabase
        .from('crm_deals')
        .select('loan_amount, sanctioned_amount, disbursed_amount, status')
        .eq('cro_id', user.id)
        .gte('created_at', prevMonthStart)
        .lt('created_at', prevMonthEnd),

      // Deals in pipeline (in_progress) for expected revenue
      supabase
        .from('crm_deals')
        .select('loan_amount, stage')
        .eq('cro_id', user.id)
        .eq('status', 'in_progress'),

      // ---- EXTENDED: Activity metrics ----
      // Week calls with timestamps (for avg calls per day calculation)
      supabase
        .from('cro_call_logs')
        .select('call_started_at')
        .eq('cro_id', user.id)
        .gte('call_started_at', weekStart),

      // Week followups completed
      supabase
        .from('crm_followups')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', user.id)
        .eq('status', 'Completed')
        .gte('completed_at', weekStart),

      // First call response times: contacts assigned this month with first call
      supabase
        .from('crm_contacts')
        .select('assigned_at, last_called_at')
        .eq('assigned_to_cro', user.id)
        .gte('assigned_at', monthStart)
        .not('last_called_at', 'is', null),

      // ---- EXTENDED: Loan type distribution ----
      supabase
        .from('crm_leads')
        .select('loan_type')
        .eq('cro_id', user.id)
        .is('deleted_at', null),

      // ---- EXTENDED: Daily activity last 7 days ----
      supabase
        .from('cro_call_logs')
        .select('call_started_at, call_outcome')
        .eq('cro_id', user.id)
        .gte('call_started_at', get7DaysAgo()),

      // ---- EXTENDED: Top performing hours ----
      supabase
        .from('cro_call_logs')
        .select('call_started_at, call_outcome')
        .eq('cro_id', user.id)
        .gte('call_started_at', monthStart),

      // ---- EXTENDED: Pipeline Health ----
      // Aging leads (> 7 days without update, still active)
      supabase
        .from('crm_leads')
        .select('id, customer_name, updated_at', { count: 'exact' })
        .eq('cro_id', user.id)
        .eq('status', 'active')
        .lt('updated_at', agingThreshold)
        .limit(10),

      // Overdue followups
      supabase
        .from('crm_followups')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', user.id)
        .eq('status', 'Pending')
        .lt('scheduled_at', nowISO),

      // Stale contacts (assigned, not called in 72 hours, not terminal status)
      supabase
        .from('crm_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to_cro', user.id)
        .in('status', ['new', 'contacted', 'called', 'follow_up'])
        .lt('updated_at', staleThreshold),
    ])

    // =========================================================================
    // ERROR CHECKING - collect warnings for partial failures
    // =========================================================================
    const warnings: string[] = []
    if (todayCallsResult.error) warnings.push('today_calls')
    if (weekCallsResult.error) warnings.push('week_calls')
    if (monthCallsResult.error) warnings.push('month_calls')
    if (prevWeekCallsResult.error) warnings.push('prev_week_calls')
    if (todayLeadsResult.error) warnings.push('today_leads')
    if (weekLeadsResult.error) warnings.push('week_leads')
    if (weekLeadsConvertedResult.error) warnings.push('week_leads_converted')
    if (monthLeadsResult.error) warnings.push('month_leads')
    if (monthLeadsConvertedResult.error) warnings.push('month_leads_converted')
    if (prevWeekLeadsResult.error) warnings.push('prev_week_leads')
    if (prevWeekLeadsConvertedResult.error) warnings.push('prev_week_leads_converted')
    if (monthlySummaryResult.error) warnings.push('monthly_summary')
    if (strengthInsightsResult.error) warnings.push('strength_insights')
    if (improvementInsightsResult.error) warnings.push('improvement_insights')
    if (totalCROsResult.error) warnings.push('total_cros')
    // Extended warnings
    if (weekContactsTotalResult.error) warnings.push('ext_week_contacts')
    if (monthDealsResult.error) warnings.push('ext_month_deals')
    if (pipelineDealsResult.error) warnings.push('ext_pipeline_deals')
    if (agingLeadsResult.error) warnings.push('ext_aging_leads')
    if (overdueFollowupsResult.error) warnings.push('ext_overdue_followups')
    if (staleContactsResult.error) warnings.push('ext_stale_contacts')
    if (loanTypeResult.error) warnings.push('ext_loan_types')
    if (dailyActivityResult.error) warnings.push('ext_daily_activity')
    if (hourlyActivityResult.error) warnings.push('ext_hourly_activity')

    if (warnings.length > 0) {
      logApiError(
        new Error(`Partial query failures: ${warnings.join(', ')}`),
        request,
        { action: 'get_cro_analytics_partial', requestId }
      )
    }

    // =========================================================================
    // TODAY METRICS
    // =========================================================================
    const todayCalls = todayCallsResult.data || []
    const todayCallsMade = todayCalls.length
    const todayCallsConnected = todayCalls.filter(
      (c) => CONNECTED_OUTCOMES.includes(c.call_outcome)
    ).length
    const todayPositiveCalls = todayCalls.filter(
      (c) => POSITIVE_OUTCOMES.includes(c.call_outcome)
    ).length
    const todayTotalDuration = todayCalls.reduce(
      (sum, c) => sum + (c.call_duration_seconds || 0),
      0
    )
    const todayAvgCallDuration =
      todayCallsMade > 0 ? Math.round(todayTotalDuration / todayCallsMade) : 0
    const todayRatedCalls = todayCalls.filter((c) => c.ai_rating != null)
    const todayAvgAIRating =
      todayRatedCalls.length > 0
        ? Math.round(
            (todayRatedCalls.reduce((sum, c) => sum + Number(c.ai_rating), 0) /
              todayRatedCalls.length) *
              10
          ) / 10
        : 0

    // =========================================================================
    // WEEK METRICS
    // =========================================================================
    const weekCalls = weekCallsResult.data || []
    const weekCallsMade = weekCalls.length
    const weekCallsConnected = weekCalls.filter(
      (c) => CONNECTED_OUTCOMES.includes(c.call_outcome)
    ).length
    const weekPositiveCalls = weekCalls.filter(
      (c) => POSITIVE_OUTCOMES.includes(c.call_outcome)
    ).length

    // =========================================================================
    // MONTH METRICS
    // =========================================================================
    const monthCalls = monthCallsResult.data || []
    const monthCallsMade = monthCalls.length
    const monthRatedCalls = monthCalls.filter((c) => c.ai_rating != null)
    const monthAvgAIRating =
      monthRatedCalls.length > 0
        ? Math.round(
            (monthRatedCalls.reduce((sum, c) => sum + Number(c.ai_rating), 0) /
              monthRatedCalls.length) *
              10
          ) / 10
        : 0

    const summary = monthlySummaryResult.data
    const grade = summary?.performance_grade || 'N/A'
    const aiScore = summary?.performance_score
      ? Number(summary.performance_score)
      : 0

    // Percentile rank: proper formula based on total CRO count
    const totalCROs = totalCROsResult.count ?? 0
    const percentileRank = totalCROs > 0
      ? Math.round(((totalCROs - (summary?.company_rank || totalCROs)) / totalCROs) * 100)
      : 0

    // =========================================================================
    // TREND CALCULATION (current week vs previous week)
    // =========================================================================
    const prevWeekCalls = prevWeekCallsResult.data || []
    const prevWeekCallsMade = prevWeekCalls.length
    const prevWeekRatedCalls = prevWeekCalls.filter((c) => c.ai_rating != null)
    const prevWeekAvgRating =
      prevWeekRatedCalls.length > 0
        ? prevWeekRatedCalls.reduce((sum, c) => sum + Number(c.ai_rating), 0) /
          prevWeekRatedCalls.length
        : 0

    const currWeekRatedCalls = weekCalls.filter((c) => c.ai_rating != null)
    const currWeekAvgRating =
      currWeekRatedCalls.length > 0
        ? currWeekRatedCalls.reduce((sum, c) => sum + Number(c.ai_rating), 0) /
          currWeekRatedCalls.length
        : 0

    const currWeekLeadsConverted = weekLeadsConvertedResult.count ?? 0
    const prevWeekLeadsConverted = prevWeekLeadsConvertedResult.count ?? 0

    const trends = {
      callQuality: calculateTrend(currWeekAvgRating, prevWeekAvgRating),
      callVolume: calculateTrend(weekCallsMade, prevWeekCallsMade),
      conversionRate: calculateTrend(currWeekLeadsConverted, prevWeekLeadsConverted),
    }

    // =========================================================================
    // PERFORMANCE INSIGHTS (from cro_ai_insights)
    // =========================================================================
    const bestPoints: string[] = (strengthInsightsResult.data || []).map(
      (i) => i.title || i.description
    )
    const improvementAreas: string[] = (improvementInsightsResult.data || []).map(
      (i) => i.title || i.description
    )

    // =========================================================================
    // EXTENDED: CONVERSION METRICS
    // =========================================================================
    const weekContacts = weekContactsTotalResult.count ?? 0
    const prevWeekContacts = prevWeekContactsTotalResult.count ?? 0
    const weekPositive = weekPositiveTotalResult.count ?? 0
    const prevWeekPositive = prevWeekPositiveTotalResult.count ?? 0
    const weekLeadsCreated = weekLeadsResult.count ?? 0
    const prevWeekLeads = prevWeekLeadsResult.count ?? 0

    const contactToPositiveRate = weekContacts > 0
      ? Math.round((weekPositive / weekContacts) * 100)
      : 0
    const prevContactToPositiveRate = prevWeekContacts > 0
      ? Math.round((prevWeekPositive / prevWeekContacts) * 100)
      : 0

    const positiveToLeadRate = weekPositive > 0
      ? Math.round((weekLeadsCreated / weekPositive) * 100)
      : 0

    const leadToDealRate = weekLeadsCreated > 0
      ? Math.round((currWeekLeadsConverted / weekLeadsCreated) * 100)
      : 0

    // Overall pipeline (all-time)
    const totalContactsAll = allContactsTotalResult.count ?? 0
    const totalDealsAll = allDealsTotalResult.count ?? 0
    const overallConversion = totalContactsAll > 0
      ? Math.round((totalDealsAll / totalContactsAll) * 100)
      : 0

    // =========================================================================
    // EXTENDED: REVENUE METRICS
    // =========================================================================
    const monthDeals = monthDealsResult.data || []
    const prevMonthDeals = prevMonthDealsResult.data || []
    const pipelineDeals = pipelineDealsResult.data || []

    // Total deal value this month (use sanctioned_amount if available, else loan_amount)
    const totalDealValueThisMonth = monthDeals.reduce((sum, d) => {
      return sum + Number(d.sanctioned_amount || d.loan_amount || 0)
    }, 0)

    const totalDealValuePrevMonth = prevMonthDeals.reduce((sum, d) => {
      return sum + Number(d.sanctioned_amount || d.loan_amount || 0)
    }, 0)

    const avgDealSize = monthDeals.length > 0
      ? Math.round(totalDealValueThisMonth / monthDeals.length)
      : 0

    // Expected revenue: pipeline deals weighted by stage probability
    const stageProbability: Record<string, number> = {
      docs_collected: 0.15,
      finalized_bank: 0.25,
      login_complete: 0.35,
      post_login_pending_cleared: 0.50,
      process_started_at_bank: 0.60,
      case_assessed_by_banker: 0.70,
      pd_complete: 0.85,
      sanctioned: 0.95,
    }
    const expectedRevenue = pipelineDeals.reduce((sum, d) => {
      const prob = stageProbability[d.stage] || 0.20
      return sum + (Number(d.loan_amount || 0) * prob)
    }, 0)

    // =========================================================================
    // EXTENDED: ACTIVITY METRICS
    // =========================================================================
    const weekCallTimestamps = weekCallsWithTimeResult.data || []

    // Average calls per day this week
    const daysSinceWeekStart = Math.max(1,
      Math.ceil((Date.now() - new Date(weekStart).getTime()) / (24 * 60 * 60 * 1000))
    )
    const avgCallsPerDay = weekCallTimestamps.length > 0
      ? Math.round((weekCallTimestamps.length / daysSinceWeekStart) * 10) / 10
      : 0

    // Average follow-ups completed per day
    const weekFollowupsCompleted = weekFollowupsCompletedResult.count ?? 0
    const avgFollowupsPerDay = daysSinceWeekStart > 0
      ? Math.round((weekFollowupsCompleted / daysSinceWeekStart) * 10) / 10
      : 0

    // Average response time (contact assignment → first call, in hours)
    const responseTimes = (firstCallResponseResult.data || [])
      .filter(c => c.assigned_at && c.last_called_at)
      .map(c => {
        const assigned = new Date(c.assigned_at).getTime()
        const called = new Date(c.last_called_at).getTime()
        return Math.max(0, called - assigned) / (1000 * 60 * 60) // hours
      })
    const avgResponseTimeHrs = responseTimes.length > 0
      ? Math.round((responseTimes.reduce((s, t) => s + t, 0) / responseTimes.length) * 10) / 10
      : 0

    // =========================================================================
    // EXTENDED: LOAN TYPE DISTRIBUTION
    // =========================================================================
    const loanTypeMap: Record<string, number> = {}
    for (const row of (loanTypeResult.data || [])) {
      const lt = row.loan_type || 'Unknown'
      loanTypeMap[lt] = (loanTypeMap[lt] || 0) + 1
    }
    const loanTypeDistribution = Object.entries(loanTypeMap)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)

    // =========================================================================
    // EXTENDED: DAILY ACTIVITY (last 7 days)
    // =========================================================================
    const IST_OFFSET_MS_LOCAL = 5.5 * 60 * 60 * 1000
    const dailyMap: Record<string, { total: number; positive: number }> = {}
    // Pre-fill last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000 + IST_OFFSET_MS_LOCAL)
      const dateKey = d.toISOString().slice(0, 10)
      dailyMap[dateKey] = { total: 0, positive: 0 }
    }
    for (const row of (dailyActivityResult.data || [])) {
      if (!row.call_started_at) continue
      const istDate = new Date(new Date(row.call_started_at).getTime() + IST_OFFSET_MS_LOCAL)
      const dateKey = istDate.toISOString().slice(0, 10)
      if (dailyMap[dateKey]) {
        dailyMap[dateKey].total++
        if (POSITIVE_OUTCOMES.includes(row.call_outcome)) {
          dailyMap[dateKey].positive++
        }
      }
    }
    const dailyActivity = Object.entries(dailyMap).map(([date, stats]) => ({
      date,
      dayLabel: new Date(date).toLocaleDateString('en-IN', { weekday: 'short' }),
      calls: stats.total,
      positive: stats.positive,
    }))

    // =========================================================================
    // EXTENDED: TOP PERFORMING HOURS
    // =========================================================================
    const hourMap: Record<number, { total: number; positive: number }> = {}
    for (let h = 8; h <= 20; h++) {
      hourMap[h] = { total: 0, positive: 0 }
    }
    for (const row of (hourlyActivityResult.data || [])) {
      if (!row.call_started_at) continue
      const istDate = new Date(new Date(row.call_started_at).getTime() + IST_OFFSET_MS_LOCAL)
      const hour = istDate.getUTCHours()
      if (hour >= 8 && hour <= 20) {
        hourMap[hour].total++
        if (POSITIVE_OUTCOMES.includes(row.call_outcome)) {
          hourMap[hour].positive++
        }
      }
    }
    const topHours = Object.entries(hourMap).map(([hour, stats]) => ({
      hour: Number(hour),
      label: `${Number(hour) > 12 ? Number(hour) - 12 : Number(hour)}${Number(hour) >= 12 ? 'PM' : 'AM'}`,
      calls: stats.total,
      positive: stats.positive,
      successRate: stats.total > 0 ? Math.round((stats.positive / stats.total) * 100) : 0,
    }))

    // =========================================================================
    // EXTENDED: PIPELINE HEALTH
    // =========================================================================
    const agingLeadsCount = agingLeadsResult.count ?? 0
    const agingLeadsList = (agingLeadsResult.data || []).map(l => ({
      id: l.id,
      customerName: l.customer_name,
      lastUpdated: l.updated_at,
    }))
    const overdueFollowupsCount = overdueFollowupsResult.count ?? 0
    const staleContactsCount = staleContactsResult.count ?? 0

    // =========================================================================
    // RESPONSE (with caching header)
    // =========================================================================
    const response = NextResponse.json({
      success: true,
      data: {
        today: {
          callsMade: todayCallsMade,
          callsConnected: todayCallsConnected,
          positiveCalls: todayPositiveCalls,
          avgCallDuration: todayAvgCallDuration,
          leadsCreated: todayLeadsResult.count ?? 0,
          avgAIRating: todayAvgAIRating,
        },
        week: {
          callsMade: weekCallsMade,
          callsConnected: weekCallsConnected,
          positiveCalls: weekPositiveCalls,
          leadsCreated: weekLeadsResult.count ?? 0,
          leadsConverted: currWeekLeadsConverted,
        },
        month: {
          callsMade: monthCallsMade,
          leadsCreated: monthLeadsResult.count ?? 0,
          leadsConverted: monthLeadsConvertedResult.count ?? 0,
          avgAIRating: monthAvgAIRating,
          aiScore,
          grade,
          percentileRank,
        },
        performance: {
          bestPoints,
          improvementAreas,
          trends,
        },
        extended: {
          conversion: {
            contactToPositive: contactToPositiveRate,
            positiveToLead: positiveToLeadRate,
            leadToDeal: leadToDealRate,
            overall: overallConversion,
            trends: {
              contactToPositive: calculateTrend(contactToPositiveRate, prevContactToPositiveRate),
              contactToPositiveChange: percentChange(contactToPositiveRate, prevContactToPositiveRate),
              leadToDeal: calculateTrend(currWeekLeadsConverted, prevWeekLeadsConverted),
              leadToDealChange: percentChange(currWeekLeadsConverted, prevWeekLeadsConverted),
            },
          },
          revenue: {
            totalThisMonth: Math.round(totalDealValueThisMonth),
            avgDealSize,
            expectedRevenue: Math.round(expectedRevenue),
            trend: calculateTrend(totalDealValueThisMonth, totalDealValuePrevMonth),
            trendChange: percentChange(totalDealValueThisMonth, totalDealValuePrevMonth),
          },
          activity: {
            avgCallsPerDay,
            avgFollowupsPerDay,
            avgResponseTime: avgResponseTimeHrs,
          },
          pipelineHealth: {
            agingLeads: agingLeadsCount,
            agingLeadsList,
            overdueFollowups: overdueFollowupsCount,
            staleContacts: staleContactsCount,
          },
          loanTypeDistribution,
          dailyActivity,
          topHours,
          funnel: {
            contacts: totalContactsAll,
            positive: allPositiveTotalResult.count ?? 0,
            leads: allLeadsTotalResult.count ?? 0,
            deals: totalDealsAll,
          },
        },
      },
      ...(warnings.length > 0 ? { warnings } : {}),
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    })

    response.headers.set('Cache-Control', 'private, max-age=30')
    return response
  } catch (error) {
    logApiError(error as Error, request, { action: 'get_cro_analytics', requestId })
    return createErrorResponse('Internal server error', 500, requestId)
  }
}
