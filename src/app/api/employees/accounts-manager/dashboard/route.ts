import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


/** Get IST date string (YYYY-MM-DD) */
function getISTDate(): string {
  const now = new Date()
  const istOffset = 5.5 * 60 * 60 * 1000
  const istDate = new Date(now.getTime() + istOffset)
  return istDate.toISOString().split('T')[0]
}

/** Get IST datetime for start-of-day */
function getISTStartOfDay(dateStr: string): string {
  return `${dateStr}T00:00:00+05:30`
}

/** Get IST datetime for start of N days ago */
function getISTDaysAgo(days: number): string {
  const now = new Date()
  const istOffset = 5.5 * 60 * 60 * 1000
  const istDate = new Date(now.getTime() + istOffset - days * 24 * 60 * 60 * 1000)
  return istDate.toISOString().split('T')[0]
}

/** Get first day of previous month */
function getPrevMonthStart(todayStr: string): string {
  const [year, month] = todayStr.split('-').map(Number)
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  return `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
}

/** Get last day of previous month */
function getPrevMonthEnd(todayStr: string): string {
  const [year, month] = todayStr.split('-').map(Number)
  // Last day of prev month = day 0 of current month
  const lastDay = new Date(year, month - 1, 0).getDate()
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  return `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
}

/** Get first day of month N months ago from a date string */
function getMonthStart(todayStr: string, monthsAgo: number): string {
  const [year, month] = todayStr.split('-').map(Number)
  let m = month - monthsAgo
  let y = year
  while (m <= 0) { m += 12; y-- }
  return `${y}-${String(m).padStart(2, '0')}-01`
}

/** Get last day of a given month from a YYYY-MM-DD start-of-month string */
function getMonthEnd(monthStartStr: string): string {
  const [year, month] = monthStartStr.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
}

/**
 * GET /api/employees/accounts-manager/dashboard
 * Comprehensive manager dashboard with team oversight, per-AE performance,
 * financial summary, aging alerts, weekly trends, pipeline status,
 * approval rates, MoM comparison, bank/partner analytics, anomaly detection,
 * avg processing times, workload distribution, overdue SLA details,
 * aging breakdown, monthly payout trend, verification quality metrics,
 * priority scoring, department KPIs, escalation data, and skill-based stats.
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

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role, sub_role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || !userData) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    // Only ACCOUNTS_MANAGER or SUPER_ADMIN
    if (userData.role !== 'SUPER_ADMIN' &&
        !(userData.role === 'EMPLOYEE' && userData.sub_role === 'ACCOUNTS_MANAGER')) {
      return NextResponse.json({ success: false, error: 'Access denied. Accounts Manager only.' }, { status: 403 })
    }

    const today = getISTDate()
    const todayStart = getISTStartOfDay(today)
    const monthStart = `${today.substring(0, 7)}-01`
    const monthStartIST = getISTStartOfDay(monthStart)
    const prevMonthStart = getISTStartOfDay(getPrevMonthStart(today))
    const prevMonthEnd = getISTStartOfDay(getPrevMonthEnd(today))
    const oneDayAgo = getISTStartOfDay(getISTDaysAgo(1))
    const threeDaysAgo = getISTStartOfDay(getISTDaysAgo(3))
    const fiveDaysAgo = getISTStartOfDay(getISTDaysAgo(5))
    const sevenDaysAgo = getISTStartOfDay(getISTDaysAgo(7))
    const fourteenDaysAgo = getISTStartOfDay(getISTDaysAgo(14))

    // 6-month trend date ranges
    const sixMonthStart = getISTStartOfDay(getMonthStart(today, 5))

    // === Run all queries in parallel ===
    const [
      // Core pipeline counts
      cpPending, cpInVerification, cpVerifiedToday,
      baPending, baInVerification, baVerifiedToday,
      bpPending, bpInVerification, bpVerifiedToday,
      // Monthly verified
      cpMonthlyVerified, baMonthlyVerified, bpMonthlyVerified,
      // Previous month verified (MoM)
      cpPrevMonthVerified, baPrevMonthVerified, bpPrevMonthVerified,
      // Monthly rejected (approval rate)
      cpMonthlyRejected, baMonthlyRejected, bpMonthlyRejected,
      // Previous month rejected (MoM)
      cpPrevMonthRejected, baPrevMonthRejected, bpPrevMonthRejected,
      // Financial: pending payout amounts
      cpPendingAmounts, baPendingAmounts, bpPendingAmounts,
      // Aging: pending > 3 days
      cpAgingCount, baAgingCount, bpAgingCount,
      // Aging: 5+ days
      cpAging5Count, baAging5Count, bpAging5Count,
      // Aging: 7+ days
      cpAging7Count, baAging7Count, bpAging7Count,
      // Rejected today
      cpRejectedToday, partnerRejectedToday,
      // On hold counts
      cpOnHold, baOnHold, bpOnHold,
      // Downstream tracking
      cpSAApproved, baSAApproved, bpSAApproved,
      cpFinanceProcessing, baFinanceProcessing, bpFinanceProcessing,
      // 7-day trend data
      cpWeeklyActivity, partnerWeeklyActivity,
      // Team activity (last 15 combined)
      cpRecentActivity, partnerRecentActivity,
      // Team members
      teamMembers,
      // Per-AE performance: CP history today
      cpHistoryToday,
      // Per-AE performance: Partner history today
      partnerHistoryToday,
      // Per-AE performance: CP history this month
      cpHistoryMonth,
      // Per-AE performance: Partner history this month
      partnerHistoryMonth,
      // Overdue SLA details (pending apps with created_at for age calculation)
      cpOverdueDetails, baOverdueDetails, bpOverdueDetails,
      // Bank-wise analytics
      cpByBank, baByBank,
      // Per-AE current queue (in-verification)
      cpInVerifByAE, partnerInVerifByAE,
      // Processing time data: verified apps with timestamps
      cpProcessingTime, partnerProcessingTime,
      // Duplicate detection: same customer+bank within 30 days
      cpPotentialDuplicates,

      // === NEW: Aging Breakdown (granular buckets) ===
      // 0-1 day buckets
      cpAging1Day, baAging1Day, bpAging1Day,
      // 14+ day buckets
      cpAging14Count, baAging14Count, bpAging14Count,

      // === NEW: Monthly Payout Trend (last 6 months verified data) ===
      cpMonthlyTrend, partnerMonthlyTrend,

      // === NEW: Verification Quality Metrics (verified then rejected) ===
      cpQualityIssues, partnerQualityIssues,

      // === NEW: Escalation Data (pending > 5 days) ===
      cpEscalationItems, baEscalationItems, bpEscalationItems,

      // === NEW: Skill-Based Stats (history by partner type per AE) ===
      cpSkillHistory, partnerSkillHistory,

      // === NEW: Priority Scoring - pending apps with amounts ===
      cpPendingForPriority, baPendingForPriority, bpPendingForPriority,
    ] = await Promise.all([
      // Pipeline counts
      supabase.from('cp_applications').select('id', { count: 'exact', head: true })
        .in('status', ['PENDING', 'UNDER_REVIEW']),
      supabase.from('cp_applications').select('id', { count: 'exact', head: true })
        .eq('status', 'ACCOUNTS_VERIFICATION'),
      supabase.from('cp_applications').select('id', { count: 'exact', head: true })
        .eq('status', 'ACCOUNTS_VERIFIED').gte('accounts_verified_at', todayStart),

      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BA').eq('status', 'PENDING'),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BA').eq('status', 'ACCOUNTS_VERIFICATION'),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BA').eq('status', 'ACCOUNTS_VERIFIED').gte('accounts_verified_at', todayStart),

      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BP').eq('status', 'PENDING'),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BP').eq('status', 'ACCOUNTS_VERIFICATION'),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BP').eq('status', 'ACCOUNTS_VERIFIED').gte('accounts_verified_at', todayStart),

      // Monthly verified
      supabase.from('cp_applications').select('id', { count: 'exact', head: true })
        .eq('status', 'ACCOUNTS_VERIFIED').gte('accounts_verified_at', monthStartIST),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BA').eq('status', 'ACCOUNTS_VERIFIED').gte('accounts_verified_at', monthStartIST),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BP').eq('status', 'ACCOUNTS_VERIFIED').gte('accounts_verified_at', monthStartIST),

      // Previous month verified (MoM comparison)
      supabase.from('cp_applications').select('id', { count: 'exact', head: true })
        .eq('status', 'ACCOUNTS_VERIFIED').gte('accounts_verified_at', prevMonthStart).lte('accounts_verified_at', prevMonthEnd),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BA').eq('status', 'ACCOUNTS_VERIFIED').gte('accounts_verified_at', prevMonthStart).lte('accounts_verified_at', prevMonthEnd),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BP').eq('status', 'ACCOUNTS_VERIFIED').gte('accounts_verified_at', prevMonthStart).lte('accounts_verified_at', prevMonthEnd),

      // Monthly rejected (for approval rate)
      supabase.from('cp_applications').select('id', { count: 'exact', head: true })
        .eq('status', 'REJECTED').gte('reviewed_at', monthStartIST),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BA').eq('status', 'REJECTED').gte('updated_at', monthStartIST),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BP').eq('status', 'REJECTED').gte('updated_at', monthStartIST),

      // Previous month rejected (MoM)
      supabase.from('cp_applications').select('id', { count: 'exact', head: true })
        .eq('status', 'REJECTED').gte('reviewed_at', prevMonthStart).lte('reviewed_at', prevMonthEnd),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BA').eq('status', 'REJECTED').gte('updated_at', prevMonthStart).lte('updated_at', prevMonthEnd),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BP').eq('status', 'REJECTED').gte('updated_at', prevMonthStart).lte('updated_at', prevMonthEnd),

      // Financial: pending payout amounts
      supabase.from('cp_applications').select('expected_payout_amount')
        .in('status', ['PENDING', 'UNDER_REVIEW', 'ACCOUNTS_VERIFICATION']),
      supabase.from('partner_payout_applications').select('expected_commission_amount')
        .eq('partner_type', 'BA').in('status', ['PENDING', 'ACCOUNTS_VERIFICATION']),
      supabase.from('partner_payout_applications').select('expected_commission_amount')
        .eq('partner_type', 'BP').in('status', ['PENDING', 'ACCOUNTS_VERIFICATION']),

      // Aging buckets: >3 days
      supabase.from('cp_applications').select('id', { count: 'exact', head: true })
        .in('status', ['PENDING', 'UNDER_REVIEW']).lt('created_at', threeDaysAgo),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BA').eq('status', 'PENDING').lt('created_at', threeDaysAgo),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BP').eq('status', 'PENDING').lt('created_at', threeDaysAgo),

      // Aging buckets: >5 days
      supabase.from('cp_applications').select('id', { count: 'exact', head: true })
        .in('status', ['PENDING', 'UNDER_REVIEW']).lt('created_at', fiveDaysAgo),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BA').eq('status', 'PENDING').lt('created_at', fiveDaysAgo),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BP').eq('status', 'PENDING').lt('created_at', fiveDaysAgo),

      // Aging buckets: >7 days (critical)
      supabase.from('cp_applications').select('id', { count: 'exact', head: true })
        .in('status', ['PENDING', 'UNDER_REVIEW']).lt('created_at', getISTStartOfDay(getISTDaysAgo(7))),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BA').eq('status', 'PENDING').lt('created_at', getISTStartOfDay(getISTDaysAgo(7))),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BP').eq('status', 'PENDING').lt('created_at', getISTStartOfDay(getISTDaysAgo(7))),

      // Rejected today
      supabase.from('cp_applications').select('id', { count: 'exact', head: true })
        .eq('status', 'REJECTED').gte('reviewed_at', todayStart),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('status', 'REJECTED').gte('updated_at', todayStart),

      // On hold
      supabase.from('cp_applications').select('id', { count: 'exact', head: true })
        .eq('status', 'ON_HOLD'),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BA').eq('status', 'ON_HOLD'),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BP').eq('status', 'ON_HOLD'),

      // Downstream
      supabase.from('cp_applications').select('id', { count: 'exact', head: true })
        .eq('status', 'SA_APPROVED'),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BA').eq('status', 'SA_APPROVED'),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BP').eq('status', 'SA_APPROVED'),

      supabase.from('cp_applications').select('id', { count: 'exact', head: true })
        .eq('status', 'FINANCE_PROCESSING'),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BA').eq('status', 'FINANCE_PROCESSING'),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BP').eq('status', 'FINANCE_PROCESSING'),

      // 7-day trend
      supabase.from('cp_application_status_history')
        .select('new_status, created_at')
        .in('new_status', ['ACCOUNTS_VERIFIED', 'REJECTED'])
        .gte('created_at', sevenDaysAgo),
      supabase.from('partner_payout_status_history')
        .select('new_status, created_at')
        .in('new_status', ['ACCOUNTS_VERIFIED', 'REJECTED'])
        .gte('created_at', sevenDaysAgo),

      // Team activity (last 15 combined)
      supabase.from('cp_application_status_history')
        .select('id, application_id, previous_status, new_status, changed_by, changed_by_name, changed_by_role, notes, created_at')
        .order('created_at', { ascending: false }).limit(10),
      supabase.from('partner_payout_status_history')
        .select('id, application_id, app_id, partner_type, previous_status, new_status, changed_by, changed_by_name, changed_by_role, notes, created_at')
        .order('created_at', { ascending: false }).limit(10),

      // Team members
      supabase.from('users')
        .select('id, full_name, email, sub_role, status, last_login_at, created_at')
        .eq('role', 'EMPLOYEE')
        .in('sub_role', ['ACCOUNTS_EXECUTIVE', 'ACCOUNTS_MANAGER'])
        .order('full_name', { ascending: true }),

      // Per-AE today performance (CP)
      supabase.from('cp_application_status_history')
        .select('changed_by, new_status')
        .in('new_status', ['ACCOUNTS_VERIFICATION', 'ACCOUNTS_VERIFIED', 'REJECTED'])
        .gte('created_at', todayStart),
      // Per-AE today performance (Partner)
      supabase.from('partner_payout_status_history')
        .select('changed_by, new_status')
        .in('new_status', ['ACCOUNTS_VERIFICATION', 'ACCOUNTS_VERIFIED', 'REJECTED'])
        .gte('created_at', todayStart),
      // Per-AE monthly performance (CP)
      supabase.from('cp_application_status_history')
        .select('changed_by, new_status')
        .in('new_status', ['ACCOUNTS_VERIFICATION', 'ACCOUNTS_VERIFIED', 'REJECTED'])
        .gte('created_at', monthStartIST),
      // Per-AE monthly performance (Partner)
      supabase.from('partner_payout_status_history')
        .select('changed_by, new_status')
        .in('new_status', ['ACCOUNTS_VERIFICATION', 'ACCOUNTS_VERIFIED', 'REJECTED'])
        .gte('created_at', monthStartIST),

      // Overdue SLA details: pending apps with age info
      supabase.from('cp_applications')
        .select('id, app_id, customer_name, bank_name, expected_payout_amount, status, created_at')
        .in('status', ['PENDING', 'UNDER_REVIEW'])
        .lt('created_at', threeDaysAgo)
        .order('created_at', { ascending: true })
        .limit(20),
      supabase.from('partner_payout_applications')
        .select('id, app_id, customer_name, bank_name, expected_commission_amount, partner_type, status, created_at')
        .eq('partner_type', 'BA').eq('status', 'PENDING')
        .lt('created_at', threeDaysAgo)
        .order('created_at', { ascending: true })
        .limit(20),
      supabase.from('partner_payout_applications')
        .select('id, app_id, customer_name, bank_name, expected_commission_amount, partner_type, status, created_at')
        .eq('partner_type', 'BP').eq('status', 'PENDING')
        .lt('created_at', threeDaysAgo)
        .order('created_at', { ascending: true })
        .limit(20),

      // Bank-wise analytics: CP apps by bank
      supabase.from('cp_applications')
        .select('bank_name, status, expected_payout_amount')
        .in('status', ['PENDING', 'UNDER_REVIEW', 'ACCOUNTS_VERIFICATION', 'ACCOUNTS_VERIFIED', 'REJECTED']),
      // Bank-wise analytics: Partner apps by bank
      supabase.from('partner_payout_applications')
        .select('bank_name, status, partner_type, expected_commission_amount')
        .in('status', ['PENDING', 'ACCOUNTS_VERIFICATION', 'ACCOUNTS_VERIFIED', 'REJECTED']),

      // Per-AE current queue (who has what in verification) - CP
      supabase.from('cp_applications')
        .select('accounts_verified_by, status')
        .eq('status', 'ACCOUNTS_VERIFICATION'),
      // Per-AE current queue - Partner
      supabase.from('partner_payout_applications')
        .select('accounts_verified_by, status')
        .eq('status', 'ACCOUNTS_VERIFICATION'),

      // Processing time: recently verified CP apps (created_at + accounts_verified_at)
      supabase.from('cp_applications')
        .select('created_at, accounts_verified_at')
        .eq('status', 'ACCOUNTS_VERIFIED')
        .gte('accounts_verified_at', monthStartIST)
        .limit(200),
      // Processing time: recently verified partner apps
      supabase.from('partner_payout_applications')
        .select('created_at, accounts_verified_at, partner_type')
        .eq('status', 'ACCOUNTS_VERIFIED')
        .gte('accounts_verified_at', monthStartIST)
        .limit(200),

      // Duplicate detection: CP apps with same customer+bank, recently created
      supabase.from('cp_applications')
        .select('id, app_id, customer_name, bank_name, created_at, status')
        .in('status', ['PENDING', 'UNDER_REVIEW', 'ACCOUNTS_VERIFICATION'])
        .gte('created_at', getISTStartOfDay(getISTDaysAgo(30)))
        .order('customer_name', { ascending: true }),

      // === NEW QUERIES ===

      // Aging Breakdown: 0-1 day (pending, created within last 1 day)
      supabase.from('cp_applications').select('id', { count: 'exact', head: true })
        .in('status', ['PENDING', 'UNDER_REVIEW']).gte('created_at', oneDayAgo),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BA').eq('status', 'PENDING').gte('created_at', oneDayAgo),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BP').eq('status', 'PENDING').gte('created_at', oneDayAgo),

      // Aging Breakdown: 14+ days
      supabase.from('cp_applications').select('id', { count: 'exact', head: true })
        .in('status', ['PENDING', 'UNDER_REVIEW']).lt('created_at', fourteenDaysAgo),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BA').eq('status', 'PENDING').lt('created_at', fourteenDaysAgo),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BP').eq('status', 'PENDING').lt('created_at', fourteenDaysAgo),

      // Monthly Payout Trend: last 6 months verified CP apps with amounts and dates
      supabase.from('cp_applications')
        .select('accounts_verified_at, expected_payout_amount')
        .eq('status', 'ACCOUNTS_VERIFIED')
        .gte('accounts_verified_at', sixMonthStart)
        .limit(500),
      // Monthly Payout Trend: last 6 months verified partner apps with amounts and dates
      supabase.from('partner_payout_applications')
        .select('accounts_verified_at, expected_commission_amount, partner_type')
        .eq('status', 'ACCOUNTS_VERIFIED')
        .gte('accounts_verified_at', sixMonthStart)
        .limit(500),

      // Verification Quality: CP apps that were ACCOUNTS_VERIFIED then moved to REJECTED or SA_REJECTED
      supabase.from('cp_application_status_history')
        .select('application_id, new_status, previous_status, created_at')
        .in('new_status', ['REJECTED', 'SA_REJECTED'])
        .eq('previous_status', 'ACCOUNTS_VERIFIED')
        .gte('created_at', sixMonthStart),
      // Verification Quality: Partner apps that were ACCOUNTS_VERIFIED then rejected
      supabase.from('partner_payout_status_history')
        .select('application_id, new_status, previous_status, partner_type, created_at')
        .in('new_status', ['REJECTED', 'SA_REJECTED'])
        .eq('previous_status', 'ACCOUNTS_VERIFIED')
        .gte('created_at', sixMonthStart),

      // Escalation: CP apps pending > 5 days
      supabase.from('cp_applications')
        .select('id, app_id, customer_name, bank_name, expected_payout_amount, status, created_at')
        .in('status', ['PENDING', 'UNDER_REVIEW'])
        .lt('created_at', fiveDaysAgo)
        .order('created_at', { ascending: true })
        .limit(50),
      // Escalation: BA apps pending > 5 days
      supabase.from('partner_payout_applications')
        .select('id, app_id, customer_name, bank_name, expected_commission_amount, partner_type, status, created_at')
        .eq('partner_type', 'BA').eq('status', 'PENDING')
        .lt('created_at', fiveDaysAgo)
        .order('created_at', { ascending: true })
        .limit(50),
      // Escalation: BP apps pending > 5 days
      supabase.from('partner_payout_applications')
        .select('id, app_id, customer_name, bank_name, expected_commission_amount, partner_type, status, created_at')
        .eq('partner_type', 'BP').eq('status', 'PENDING')
        .lt('created_at', fiveDaysAgo)
        .order('created_at', { ascending: true })
        .limit(50),

      // Skill-Based Stats: CP history this month with changed_by
      supabase.from('cp_application_status_history')
        .select('changed_by, new_status, created_at')
        .eq('new_status', 'ACCOUNTS_VERIFIED')
        .gte('created_at', sixMonthStart),
      // Skill-Based Stats: Partner history with partner_type and changed_by
      supabase.from('partner_payout_status_history')
        .select('changed_by, new_status, partner_type, created_at')
        .eq('new_status', 'ACCOUNTS_VERIFIED')
        .gte('created_at', sixMonthStart),

      // Priority Scoring: pending CP apps with amounts and created_at
      supabase.from('cp_applications')
        .select('id, app_id, customer_name, bank_name, expected_payout_amount, status, created_at, partner_tier')
        .in('status', ['PENDING', 'UNDER_REVIEW'])
        .order('created_at', { ascending: true })
        .limit(100),
      // Priority Scoring: pending BA apps
      supabase.from('partner_payout_applications')
        .select('id, app_id, customer_name, bank_name, expected_commission_amount, partner_type, status, created_at, partner_tier')
        .eq('partner_type', 'BA').eq('status', 'PENDING')
        .order('created_at', { ascending: true })
        .limit(100),
      // Priority Scoring: pending BP apps
      supabase.from('partner_payout_applications')
        .select('id, app_id, customer_name, bank_name, expected_commission_amount, partner_type, status, created_at, partner_tier')
        .eq('partner_type', 'BP').eq('status', 'PENDING')
        .order('created_at', { ascending: true })
        .limit(100),
    ])

    // === Build team member performance map ===
    const members = teamMembers.data || []

    // Aggregate per-AE today stats
    const aeToday: Record<string, { picked_up: number; verified: number; rejected: number }> = {}
    for (const m of members) {
      aeToday[m.id] = { picked_up: 0, verified: 0, rejected: 0 }
    }
    for (const entry of [...(cpHistoryToday.data || []), ...(partnerHistoryToday.data || [])]) {
      if (!aeToday[entry.changed_by]) continue
      if (entry.new_status === 'ACCOUNTS_VERIFICATION') aeToday[entry.changed_by].picked_up++
      else if (entry.new_status === 'ACCOUNTS_VERIFIED') aeToday[entry.changed_by].verified++
      else if (entry.new_status === 'REJECTED') aeToday[entry.changed_by].rejected++
    }

    // Aggregate per-AE monthly stats
    const aeMonth: Record<string, { picked_up: number; verified: number; rejected: number }> = {}
    for (const m of members) {
      aeMonth[m.id] = { picked_up: 0, verified: 0, rejected: 0 }
    }
    for (const entry of [...(cpHistoryMonth.data || []), ...(partnerHistoryMonth.data || [])]) {
      if (!aeMonth[entry.changed_by]) continue
      if (entry.new_status === 'ACCOUNTS_VERIFICATION') aeMonth[entry.changed_by].picked_up++
      else if (entry.new_status === 'ACCOUNTS_VERIFIED') aeMonth[entry.changed_by].verified++
      else if (entry.new_status === 'REJECTED') aeMonth[entry.changed_by].rejected++
    }

    // Build team performance array
    const teamPerformance = members.map(m => ({
      id: m.id,
      name: m.full_name,
      email: m.email,
      sub_role: m.sub_role,
      status: m.status,
      last_login_at: m.last_login_at,
      today: aeToday[m.id] || { picked_up: 0, verified: 0, rejected: 0 },
      monthly: aeMonth[m.id] || { picked_up: 0, verified: 0, rejected: 0 },
    }))

    // === Per-AE workload (current in-verification queue) ===
    const aeWorkload: Record<string, number> = {}
    for (const m of members) {
      aeWorkload[m.id] = 0
    }
    for (const item of [...(cpInVerifByAE.data || []), ...(partnerInVerifByAE.data || [])]) {
      if (item.accounts_verified_by && aeWorkload[item.accounts_verified_by] !== undefined) {
        aeWorkload[item.accounts_verified_by]++
      }
    }
    const workloadDistribution = members.map(m => ({
      id: m.id,
      name: m.full_name,
      sub_role: m.sub_role,
      current_queue: aeWorkload[m.id] || 0,
    }))

    // === Merge team activity ===
    const cpActivity = (cpRecentActivity.data || []).map(a => ({ ...a, source: 'CP' as const }))
    const partnerActivity = (partnerRecentActivity.data || []).map(a => ({ ...a, source: a.partner_type as string }))
    const mergedActivity = [...cpActivity, ...partnerActivity]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 15)

    // === Financial totals ===
    const cpPendingAmount = (cpPendingAmounts.data || []).reduce(
      (sum, a) => sum + (a.expected_payout_amount || 0), 0)
    const baPendingAmount = (baPendingAmounts.data || []).reduce(
      (sum, a) => sum + (a.expected_commission_amount || 0), 0)
    const bpPendingAmount = (bpPendingAmounts.data || []).reduce(
      (sum, a) => sum + (a.expected_commission_amount || 0), 0)

    // === Build 7-day trend ===
    const trendData: Record<string, { verified: number; rejected: number }> = {}
    for (let i = 6; i >= 0; i--) {
      const d = getISTDaysAgo(i)
      trendData[d] = { verified: 0, rejected: 0 }
    }
    for (const entry of [...(cpWeeklyActivity.data || []), ...(partnerWeeklyActivity.data || [])]) {
      const dateKey = entry.created_at.split('T')[0]
      if (trendData[dateKey]) {
        if (entry.new_status === 'ACCOUNTS_VERIFIED') trendData[dateKey].verified++
        else if (entry.new_status === 'REJECTED') trendData[dateKey].rejected++
      }
    }
    const weeklyTrend = Object.entries(trendData).map(([date, data]) => ({
      date,
      day: new Date(date).toLocaleDateString('en-IN', { weekday: 'short' }),
      ...data,
    }))

    // === Approval rate calculation ===
    const currentVerified = (cpMonthlyVerified.count || 0) + (baMonthlyVerified.count || 0) + (bpMonthlyVerified.count || 0)
    const currentRejected = (cpMonthlyRejected.count || 0) + (baMonthlyRejected.count || 0) + (bpMonthlyRejected.count || 0)
    const currentTotal = currentVerified + currentRejected
    const approvalRate = currentTotal > 0 ? Math.round((currentVerified / currentTotal) * 100) : 0

    const prevVerified = (cpPrevMonthVerified.count || 0) + (baPrevMonthVerified.count || 0) + (bpPrevMonthVerified.count || 0)
    const prevRejected = (cpPrevMonthRejected.count || 0) + (baPrevMonthRejected.count || 0) + (bpPrevMonthRejected.count || 0)
    const prevTotal = prevVerified + prevRejected
    const prevApprovalRate = prevTotal > 0 ? Math.round((prevVerified / prevTotal) * 100) : 0

    // === Month-over-Month comparison ===
    const momChange = prevVerified > 0
      ? Math.round(((currentVerified - prevVerified) / prevVerified) * 100)
      : currentVerified > 0 ? 100 : 0

    // === Aging heatmap (SLA buckets) ===
    const agingHeatmap = {
      bucket_1_2: {
        // 1-2 days: total pending minus >3 days
        cp: Math.max(0, (cpPending.count || 0) - (cpAgingCount.count || 0)),
        ba: Math.max(0, (baPending.count || 0) - (baAgingCount.count || 0)),
        bp: Math.max(0, (bpPending.count || 0) - (bpAgingCount.count || 0)),
      },
      bucket_3_4: {
        // 3-4 days: >3 days minus >5 days
        cp: Math.max(0, (cpAgingCount.count || 0) - (cpAging5Count.count || 0)),
        ba: Math.max(0, (baAgingCount.count || 0) - (baAging5Count.count || 0)),
        bp: Math.max(0, (bpAgingCount.count || 0) - (bpAging5Count.count || 0)),
      },
      bucket_5_6: {
        // 5-6 days: >5 days minus >7 days
        cp: Math.max(0, (cpAging5Count.count || 0) - (cpAging7Count.count || 0)),
        ba: Math.max(0, (baAging5Count.count || 0) - (baAging7Count.count || 0)),
        bp: Math.max(0, (bpAging5Count.count || 0) - (bpAging7Count.count || 0)),
      },
      bucket_7_plus: {
        // 7+ days: critical
        cp: cpAging7Count.count || 0,
        ba: baAging7Count.count || 0,
        bp: bpAging7Count.count || 0,
      },
    }

    // === Bank-wise analytics ===
    const bankStats: Record<string, { pending: number; verified: number; rejected: number; total_amount: number }> = {}
    for (const app of (cpByBank.data || [])) {
      const bank = app.bank_name || 'Unknown'
      if (!bankStats[bank]) bankStats[bank] = { pending: 0, verified: 0, rejected: 0, total_amount: 0 }
      if (['PENDING', 'UNDER_REVIEW', 'ACCOUNTS_VERIFICATION'].includes(app.status)) {
        bankStats[bank].pending++
        bankStats[bank].total_amount += (app.expected_payout_amount || 0)
      } else if (app.status === 'ACCOUNTS_VERIFIED') bankStats[bank].verified++
      else if (app.status === 'REJECTED') bankStats[bank].rejected++
    }
    for (const app of (baByBank.data || [])) {
      const bank = app.bank_name || 'Unknown'
      if (!bankStats[bank]) bankStats[bank] = { pending: 0, verified: 0, rejected: 0, total_amount: 0 }
      if (['PENDING', 'ACCOUNTS_VERIFICATION'].includes(app.status)) {
        bankStats[bank].pending++
        bankStats[bank].total_amount += (app.expected_commission_amount || 0)
      } else if (app.status === 'ACCOUNTS_VERIFIED') bankStats[bank].verified++
      else if (app.status === 'REJECTED') bankStats[bank].rejected++
    }
    const bankAnalytics = Object.entries(bankStats)
      .map(([bank, stats]) => ({
        bank,
        ...stats,
        total: stats.pending + stats.verified + stats.rejected,
        approval_rate: (stats.verified + stats.rejected) > 0
          ? Math.round((stats.verified / (stats.verified + stats.rejected)) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    // === Average processing time ===
    const processingTimes: number[] = []
    for (const app of (cpProcessingTime.data || [])) {
      if (app.created_at && app.accounts_verified_at) {
        const hours = (new Date(app.accounts_verified_at).getTime() - new Date(app.created_at).getTime()) / (1000 * 60 * 60)
        if (hours > 0 && hours < 720) processingTimes.push(hours) // cap at 30 days
      }
    }
    for (const app of (partnerProcessingTime.data || [])) {
      if (app.created_at && app.accounts_verified_at) {
        const hours = (new Date(app.accounts_verified_at).getTime() - new Date(app.created_at).getTime()) / (1000 * 60 * 60)
        if (hours > 0 && hours < 720) processingTimes.push(hours)
      }
    }
    const avgProcessingHours = processingTimes.length > 0
      ? Math.round(processingTimes.reduce((s, h) => s + h, 0) / processingTimes.length)
      : 0
    const medianProcessingHours = processingTimes.length > 0
      ? Math.round(processingTimes.sort((a, b) => a - b)[Math.floor(processingTimes.length / 2)])
      : 0
    const fastestProcessingHours = processingTimes.length > 0 ? Math.round(Math.min(...processingTimes)) : 0
    const slowestProcessingHours = processingTimes.length > 0 ? Math.round(Math.max(...processingTimes)) : 0

    // === Duplicate detection ===
    const cpApps = cpPotentialDuplicates.data || []
    const duplicateGroups: { customer_name: string; bank_name: string; count: number; app_ids: string[] }[] = []
    const seen = new Map<string, string[]>()
    for (const app of cpApps) {
      const key = `${(app.customer_name || '').toLowerCase().trim()}|${(app.bank_name || '').toLowerCase().trim()}`
      if (!seen.has(key)) seen.set(key, [])
      seen.get(key)!.push(app.app_id || app.id)
    }
    for (const [key, ids] of seen.entries()) {
      if (ids.length > 1) {
        const [customer_name, bank_name] = key.split('|')
        duplicateGroups.push({ customer_name, bank_name, count: ids.length, app_ids: ids })
      }
    }

    // === Overdue SLA details ===
    const overdueApps = [
      ...(cpOverdueDetails.data || []).map(a => ({
        id: a.id, app_id: a.app_id, customer_name: a.customer_name, bank_name: a.bank_name,
        amount: a.expected_payout_amount || 0, type: 'CP' as const, status: a.status, created_at: a.created_at,
        age_hours: Math.round((Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60)),
      })),
      ...(baOverdueDetails.data || []).map(a => ({
        id: a.id, app_id: a.app_id, customer_name: a.customer_name, bank_name: a.bank_name,
        amount: a.expected_commission_amount || 0, type: 'BA' as const, status: a.status, created_at: a.created_at,
        age_hours: Math.round((Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60)),
      })),
      ...(bpOverdueDetails.data || []).map(a => ({
        id: a.id, app_id: a.app_id, customer_name: a.customer_name, bank_name: a.bank_name,
        amount: a.expected_commission_amount || 0, type: 'BP' as const, status: a.status, created_at: a.created_at,
        age_hours: Math.round((Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60)),
      })),
    ].sort((a, b) => b.age_hours - a.age_hours)

    // === Anomaly detection ===
    const anomalies: { type: string; severity: 'warning' | 'critical'; message: string }[] = []

    // Rejection spike: if today's rejections > 3x average daily rejections this week
    const weekRejections = weeklyTrend.reduce((sum, d) => sum + d.rejected, 0)
    const avgDailyRejections = weekRejections / 7
    const todayRejections = (cpRejectedToday.count || 0) + (partnerRejectedToday.count || 0)
    if (todayRejections > 0 && avgDailyRejections > 0 && todayRejections > avgDailyRejections * 3) {
      anomalies.push({
        type: 'rejection_spike',
        severity: 'warning',
        message: `Rejection spike: ${todayRejections} today vs ${avgDailyRejections.toFixed(1)} daily avg`,
      })
    }

    // Critical overdue: any apps pending >7 days
    const criticalOverdue = (cpAging7Count.count || 0) + (baAging7Count.count || 0) + (bpAging7Count.count || 0)
    if (criticalOverdue > 0) {
      anomalies.push({
        type: 'critical_overdue',
        severity: 'critical',
        message: `${criticalOverdue} application${criticalOverdue > 1 ? 's' : ''} pending for 7+ days — requires immediate attention`,
      })
    }

    // AE inactivity: team member with 0 actions today but was online
    for (const m of teamPerformance) {
      if (m.sub_role === 'ACCOUNTS_EXECUTIVE' &&
          m.today.picked_up === 0 && m.today.verified === 0 && m.today.rejected === 0 &&
          m.last_login_at) {
        const hoursSinceLogin = (Date.now() - new Date(m.last_login_at).getTime()) / (1000 * 60 * 60)
        if (hoursSinceLogin < 8) { // logged in today but no actions
          anomalies.push({
            type: 'ae_inactive',
            severity: 'warning',
            message: `${m.name.split(' ')[0]} logged in but has 0 actions today`,
          })
        }
      }
    }

    // Duplicate applications detected
    if (duplicateGroups.length > 0) {
      anomalies.push({
        type: 'duplicates_detected',
        severity: 'warning',
        message: `${duplicateGroups.length} potential duplicate application group${duplicateGroups.length > 1 ? 's' : ''} detected`,
      })
    }

    // High payout amount anomaly: any single pending app > 5L
    const highValueApps = overdueApps.filter(a => a.amount > 500000)
    if (highValueApps.length > 0) {
      anomalies.push({
        type: 'high_value_pending',
        severity: 'warning',
        message: `${highValueApps.length} high-value application${highValueApps.length > 1 ? 's' : ''} (>5L) pending verification`,
      })
    }

    // === NEW: Aging Breakdown (granular 5-bucket per partner type) ===
    const agingBreakdown = {
      cp: {
        '0-1_days': cpAging1Day.count || 0,
        '1-3_days': Math.max(0, ((cpPending.count || 0) - (cpAging1Day.count || 0)) - (cpAgingCount.count || 0)),
        '3-7_days': Math.max(0, (cpAgingCount.count || 0) - (cpAging7Count.count || 0)),
        '7-14_days': Math.max(0, (cpAging7Count.count || 0) - (cpAging14Count.count || 0)),
        '14+_days': cpAging14Count.count || 0,
      },
      ba: {
        '0-1_days': baAging1Day.count || 0,
        '1-3_days': Math.max(0, ((baPending.count || 0) - (baAging1Day.count || 0)) - (baAgingCount.count || 0)),
        '3-7_days': Math.max(0, (baAgingCount.count || 0) - (baAging7Count.count || 0)),
        '7-14_days': Math.max(0, (baAging7Count.count || 0) - (baAging14Count.count || 0)),
        '14+_days': baAging14Count.count || 0,
      },
      bp: {
        '0-1_days': bpAging1Day.count || 0,
        '1-3_days': Math.max(0, ((bpPending.count || 0) - (bpAging1Day.count || 0)) - (bpAgingCount.count || 0)),
        '3-7_days': Math.max(0, (bpAgingCount.count || 0) - (bpAging7Count.count || 0)),
        '7-14_days': Math.max(0, (bpAging7Count.count || 0) - (bpAging14Count.count || 0)),
        '14+_days': bpAging14Count.count || 0,
      },
    }

    // === NEW: Monthly Payout Trend (last 6 months) ===
    const monthlyPayoutTrend: Record<string, { verified_count: number; payout_amount: number }> = {}
    // Initialize 6 months
    for (let i = 5; i >= 0; i--) {
      const ms = getMonthStart(today, i)
      const monthKey = ms.substring(0, 7) // YYYY-MM
      monthlyPayoutTrend[monthKey] = { verified_count: 0, payout_amount: 0 }
    }
    // Aggregate CP verified
    for (const app of (cpMonthlyTrend.data || [])) {
      if (app.accounts_verified_at) {
        const monthKey = app.accounts_verified_at.substring(0, 7)
        if (monthlyPayoutTrend[monthKey]) {
          monthlyPayoutTrend[monthKey].verified_count++
          monthlyPayoutTrend[monthKey].payout_amount += (app.expected_payout_amount || 0)
        }
      }
    }
    // Aggregate partner verified
    for (const app of (partnerMonthlyTrend.data || [])) {
      if (app.accounts_verified_at) {
        const monthKey = app.accounts_verified_at.substring(0, 7)
        if (monthlyPayoutTrend[monthKey]) {
          monthlyPayoutTrend[monthKey].verified_count++
          monthlyPayoutTrend[monthKey].payout_amount += (app.expected_commission_amount || 0)
        }
      }
    }
    const monthlyPayoutTrendArray = Object.entries(monthlyPayoutTrend).map(([month, data]) => ({
      month,
      month_label: new Date(`${month}-01`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
      ...data,
    }))

    // === NEW: Verification Quality Metrics ===
    const cpQualityCount = (cpQualityIssues.data || []).length
    const partnerQualityData = partnerQualityIssues.data || []
    const baQualityCount = partnerQualityData.filter(d => d.partner_type === 'BA').length
    const bpQualityCount = partnerQualityData.filter(d => d.partner_type === 'BP').length
    const totalQualityIssues = cpQualityCount + baQualityCount + bpQualityCount

    const verificationQualityMetrics = {
      cp_reversal_count: cpQualityCount,
      ba_reversal_count: baQualityCount,
      bp_reversal_count: bpQualityCount,
      total_reversals: totalQualityIssues,
      // Quality rate: percentage of verifications that stuck (didn't get reversed)
      // Use 6-month total verified from trend data as denominator
      quality_rate: (() => {
        const totalVerified6m = monthlyPayoutTrendArray.reduce((sum, m) => sum + m.verified_count, 0)
        return totalVerified6m > 0
          ? Math.round(((totalVerified6m - totalQualityIssues) / totalVerified6m) * 100)
          : 100
      })(),
    }

    // === NEW: Workload Distribution (enhanced - in-progress items per team member) ===
    // Already computed above as workloadDistribution, but adding total pending assignments too
    const workloadDistributionEnhanced = workloadDistribution.map(w => ({
      ...w,
      utilization: (() => {
        // Utilization = current_queue items as fraction of reasonable capacity (e.g., 10 items)
        const capacity = 10
        return Math.min(100, Math.round((w.current_queue / capacity) * 100))
      })(),
    }))

    // === NEW: Priority Scoring ===
    const calculatePriorityScore = (
      createdAt: string,
      amount: number,
      partnerTier?: string | null
    ): number => {
      const ageDays = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
      // Age score: 0-40 points (max at 14+ days)
      const ageScore = Math.min(40, Math.round(ageDays * (40 / 14)))
      // Amount score: 0-35 points (max at 10L+)
      const amountScore = Math.min(35, Math.round((amount / 1000000) * 35))
      // Partner tier score: 0-25 points
      const tierScores: Record<string, number> = {
        'PLATINUM': 25, 'GOLD': 20, 'SILVER': 15, 'BRONZE': 10,
      }
      const tierScore = tierScores[(partnerTier || '').toUpperCase()] || 5
      return ageScore + amountScore + tierScore
    }

    const priorityScoredApps = [
      ...(cpPendingForPriority.data || []).map(a => ({
        id: a.id,
        app_id: a.app_id,
        customer_name: a.customer_name,
        bank_name: a.bank_name,
        amount: a.expected_payout_amount || 0,
        type: 'CP' as const,
        status: a.status,
        created_at: a.created_at,
        age_days: Math.round((Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60 * 24)),
        partner_tier: a.partner_tier || null,
        priority_score: calculatePriorityScore(a.created_at, a.expected_payout_amount || 0, a.partner_tier),
      })),
      ...(baPendingForPriority.data || []).map(a => ({
        id: a.id,
        app_id: a.app_id,
        customer_name: a.customer_name,
        bank_name: a.bank_name,
        amount: a.expected_commission_amount || 0,
        type: 'BA' as const,
        status: a.status,
        created_at: a.created_at,
        age_days: Math.round((Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60 * 24)),
        partner_tier: a.partner_tier || null,
        priority_score: calculatePriorityScore(a.created_at, a.expected_commission_amount || 0, a.partner_tier),
      })),
      ...(bpPendingForPriority.data || []).map(a => ({
        id: a.id,
        app_id: a.app_id,
        customer_name: a.customer_name,
        bank_name: a.bank_name,
        amount: a.expected_commission_amount || 0,
        type: 'BP' as const,
        status: a.status,
        created_at: a.created_at,
        age_days: Math.round((Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60 * 24)),
        partner_tier: a.partner_tier || null,
        priority_score: calculatePriorityScore(a.created_at, a.expected_commission_amount || 0, a.partner_tier),
      })),
    ].sort((a, b) => b.priority_score - a.priority_score)

    // === NEW: Department KPIs ===
    // Daily average verifications this month
    const dayOfMonth = parseInt(today.split('-')[2], 10)
    const dailyAvgVerifications = dayOfMonth > 0
      ? Math.round((currentVerified / dayOfMonth) * 10) / 10
      : 0

    // Monthly target: estimate based on team size and working days (22 days, ~8 per AE per day)
    const activeAEs = members.filter(m => m.sub_role === 'ACCOUNTS_EXECUTIVE' && m.status === 'ACTIVE').length
    const monthlyTarget = activeAEs * 22 * 8 // 8 verifications per AE per working day
    const targetProgress = monthlyTarget > 0
      ? Math.round((currentVerified / monthlyTarget) * 100)
      : 0

    // Team utilization rate: AEs with at least 1 action today / total active AEs
    const activeAEsWithActions = teamPerformance.filter(
      m => m.sub_role === 'ACCOUNTS_EXECUTIVE' &&
        (m.today.picked_up > 0 || m.today.verified > 0 || m.today.rejected > 0)
    ).length
    const teamUtilizationRate = activeAEs > 0
      ? Math.round((activeAEsWithActions / activeAEs) * 100)
      : 0

    const departmentKPIs = {
      daily_avg_verifications: dailyAvgVerifications,
      monthly_target: monthlyTarget,
      monthly_actual: currentVerified,
      target_progress_percent: targetProgress,
      team_utilization_rate: teamUtilizationRate,
      active_aes: activeAEs,
      active_aes_with_actions_today: activeAEsWithActions,
      days_elapsed_in_month: dayOfMonth,
    }

    // === NEW: Escalation Data ===
    const escalationItems = [
      ...(cpEscalationItems.data || []).map(a => ({
        id: a.id,
        app_id: a.app_id,
        customer_name: a.customer_name,
        bank_name: a.bank_name,
        amount: a.expected_payout_amount || 0,
        type: 'CP' as const,
        status: a.status,
        created_at: a.created_at,
        age_days: Math.round((Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60 * 24)),
      })),
      ...(baEscalationItems.data || []).map(a => ({
        id: a.id,
        app_id: a.app_id,
        customer_name: a.customer_name,
        bank_name: a.bank_name,
        amount: a.expected_commission_amount || 0,
        type: 'BA' as const,
        status: a.status,
        created_at: a.created_at,
        age_days: Math.round((Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60 * 24)),
      })),
      ...(bpEscalationItems.data || []).map(a => ({
        id: a.id,
        app_id: a.app_id,
        customer_name: a.customer_name,
        bank_name: a.bank_name,
        amount: a.expected_commission_amount || 0,
        type: 'BP' as const,
        status: a.status,
        created_at: a.created_at,
        age_days: Math.round((Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60 * 24)),
      })),
    ].sort((a, b) => b.age_days - a.age_days)

    const escalationData = {
      total_count: escalationItems.length,
      by_type: {
        cp: (cpEscalationItems.data || []).length,
        ba: (baEscalationItems.data || []).length,
        bp: (bpEscalationItems.data || []).length,
      },
      items: escalationItems,
    }

    // === NEW: Skill-Based Stats ===
    const skillStats: Record<string, { cp: number; ba: number; bp: number; total: number }> = {}
    for (const m of members) {
      skillStats[m.id] = { cp: 0, ba: 0, bp: 0, total: 0 }
    }
    // CP verifications per AE
    for (const entry of (cpSkillHistory.data || [])) {
      if (entry.changed_by && skillStats[entry.changed_by]) {
        skillStats[entry.changed_by].cp++
        skillStats[entry.changed_by].total++
      }
    }
    // Partner verifications per AE by partner_type
    for (const entry of (partnerSkillHistory.data || [])) {
      if (entry.changed_by && skillStats[entry.changed_by]) {
        if (entry.partner_type === 'BA') {
          skillStats[entry.changed_by].ba++
        } else if (entry.partner_type === 'BP') {
          skillStats[entry.changed_by].bp++
        }
        skillStats[entry.changed_by].total++
      }
    }
    const skillBasedStats = members.map(m => {
      const stats = skillStats[m.id] || { cp: 0, ba: 0, bp: 0, total: 0 }
      return {
        id: m.id,
        name: m.full_name,
        sub_role: m.sub_role,
        cp_verifications: stats.cp,
        ba_verifications: stats.ba,
        bp_verifications: stats.bp,
        total_verifications: stats.total,
        primary_specialization: stats.total > 0
          ? (stats.cp >= stats.ba && stats.cp >= stats.bp ? 'CP'
            : stats.ba >= stats.bp ? 'BA' : 'BP')
          : 'NONE',
        cp_percentage: stats.total > 0 ? Math.round((stats.cp / stats.total) * 100) : 0,
        ba_percentage: stats.total > 0 ? Math.round((stats.ba / stats.total) * 100) : 0,
        bp_percentage: stats.total > 0 ? Math.round((stats.bp / stats.total) * 100) : 0,
      }
    })

    // === Build response ===
    const stats = {
      cp: {
        pending: cpPending.count || 0,
        in_verification: cpInVerification.count || 0,
        verified_today: cpVerifiedToday.count || 0,
        sa_approved: cpSAApproved.count || 0,
        finance_processing: cpFinanceProcessing.count || 0,
      },
      ba: {
        pending: baPending.count || 0,
        in_verification: baInVerification.count || 0,
        verified_today: baVerifiedToday.count || 0,
        sa_approved: baSAApproved.count || 0,
        finance_processing: baFinanceProcessing.count || 0,
      },
      bp: {
        pending: bpPending.count || 0,
        in_verification: bpInVerification.count || 0,
        verified_today: bpVerifiedToday.count || 0,
        sa_approved: bpSAApproved.count || 0,
        finance_processing: bpFinanceProcessing.count || 0,
      },
      pending_total: (cpPending.count || 0) + (baPending.count || 0) + (bpPending.count || 0),
      in_progress_total: (cpInVerification.count || 0) + (baInVerification.count || 0) + (bpInVerification.count || 0),
      verified_today_total: (cpVerifiedToday.count || 0) + (baVerifiedToday.count || 0) + (bpVerifiedToday.count || 0),
      monthly: {
        cp_verified: cpMonthlyVerified.count || 0,
        ba_verified: baMonthlyVerified.count || 0,
        bp_verified: bpMonthlyVerified.count || 0,
        total_verified: currentVerified,
      },
      sa_approved_total: (cpSAApproved.count || 0) + (baSAApproved.count || 0) + (bpSAApproved.count || 0),
      finance_processing_total: (cpFinanceProcessing.count || 0) + (baFinanceProcessing.count || 0) + (bpFinanceProcessing.count || 0),
    }

    const financial = {
      cp_pending_amount: cpPendingAmount,
      ba_pending_amount: baPendingAmount,
      bp_pending_amount: bpPendingAmount,
      total_pending_amount: cpPendingAmount + baPendingAmount + bpPendingAmount,
    }

    const aging = {
      cp_overdue: cpAgingCount.count || 0,
      ba_overdue: baAgingCount.count || 0,
      bp_overdue: bpAgingCount.count || 0,
      total_overdue: (cpAgingCount.count || 0) + (baAgingCount.count || 0) + (bpAgingCount.count || 0),
    }

    const rejectedTodayCount = (cpRejectedToday.count || 0) + (partnerRejectedToday.count || 0)
    const onHoldTotal = (cpOnHold.count || 0) + (baOnHold.count || 0) + (bpOnHold.count || 0)

    return NextResponse.json({
      success: true,
      data: {
        userName: userData.full_name,
        stats,
        financial,
        aging,
        agingHeatmap,
        agingBreakdown,
        rejectedToday: rejectedTodayCount,
        onHoldTotal,
        weeklyTrend,
        monthlyPayoutTrend: monthlyPayoutTrendArray,
        recentActivity: mergedActivity,
        teamPerformance,
        teamSize: members.length,
        workloadDistribution: workloadDistributionEnhanced,
        approvalMetrics: {
          current_rate: approvalRate,
          prev_rate: prevApprovalRate,
          current_verified: currentVerified,
          current_rejected: currentRejected,
          prev_verified: prevVerified,
          prev_rejected: prevRejected,
          mom_change: momChange,
        },
        processingTime: {
          avg_hours: avgProcessingHours,
          median_hours: medianProcessingHours,
          fastest_hours: fastestProcessingHours,
          slowest_hours: slowestProcessingHours,
          sample_size: processingTimes.length,
        },
        bankAnalytics,
        overdueApps,
        duplicateGroups,
        anomalies,
        verificationQualityMetrics,
        priorityScoredApps,
        departmentKPIs,
        escalationData,
        skillBasedStats,
      },
    })
  } catch (error) {
    logger.error('Error fetching accounts manager dashboard:', { error })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
