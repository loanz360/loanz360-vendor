import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export const dynamic = 'force-dynamic'

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

/** Get the Monday of the current IST week */
function getISTWeekStart(): string {
  const today = getISTDate()
  const date = new Date(today)
  const dayOfWeek = date.getDay() // 0=Sun, 1=Mon, ...
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // days since Monday
  date.setDate(date.getDate() - diff)
  return date.toISOString().split('T')[0]
}

const SLA_HOURS = 48

/**
 * GET /api/employees/team/accounts/performance
 * Returns team performance metrics for accounts department
 * - Per-member verified/rejected counts (today, week, month)
 * - Processing times, accuracy rates, SLA compliance
 * - Department-wide aggregates
 * - 7-day daily trend
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

    const { data: userData } = await supabase
      .from('users')
      .select('id, role, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (!userData) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    // Only ACCOUNTS_MANAGER or SUPER_ADMIN can view team performance
    if (userData.role !== 'SUPER_ADMIN' &&
        !(userData.role === 'EMPLOYEE' && userData.sub_role === 'ACCOUNTS_MANAGER')) {
      return NextResponse.json({ success: false, error: 'Access denied. Only Accounts Manager can view team performance.' }, { status: 403 })
    }

    const today = getISTDate()
    const todayStart = getISTStartOfDay(today)
    const weekStart = getISTStartOfDay(getISTWeekStart())
    const monthStart = getISTStartOfDay(`${today.substring(0, 7)}-01`)
    const sevenDaysAgo = getISTStartOfDay(getISTDaysAgo(7))

    // === Run all queries in parallel ===
    const [
      // Team members
      teamMembers,
      // Per-member today activity (CP + Partner status history)
      cpHistoryToday,
      partnerHistoryToday,
      // Per-member this week activity
      cpHistoryWeek,
      partnerHistoryWeek,
      // Per-member this month activity
      cpHistoryMonth,
      partnerHistoryMonth,
      // Current in-progress assignments (CP)
      cpInProgress,
      // Current in-progress assignments (Partner)
      partnerInProgress,
      // Processing time: verified this month (CP)
      cpProcessingTime,
      // Processing time: verified this month (Partner)
      partnerProcessingTime,
      // Department: total pending
      cpPending,
      partnerPending,
      // Department: total in progress
      cpInVerification,
      partnerInVerification,
      // Department: verified today
      cpVerifiedToday,
      partnerVerifiedToday,
      // Department: verified this month
      cpVerifiedMonth,
      partnerVerifiedMonth,
      // Department: overdue (pending > SLA_HOURS)
      cpOverdue,
      partnerOverdue,
      // 7-day trend data
      cpWeeklyActivity,
      partnerWeeklyActivity,
    ] = await Promise.all([
      // Team members
      supabase.from('users')
        .select('id, full_name, sub_role, status')
        .eq('role', 'EMPLOYEE')
        .in('sub_role', ['ACCOUNTS_EXECUTIVE', 'ACCOUNTS_MANAGER'])
        .order('full_name', { ascending: true }),

      // Per-member today activity (CP)
      supabase.from('cp_application_status_history')
        .select('changed_by, new_status')
        .in('new_status', ['ACCOUNTS_VERIFIED', 'REJECTED'])
        .gte('created_at', todayStart),
      // Per-member today activity (Partner)
      supabase.from('partner_payout_status_history')
        .select('changed_by, new_status')
        .in('new_status', ['ACCOUNTS_VERIFIED', 'REJECTED'])
        .gte('created_at', todayStart),

      // Per-member this week activity (CP)
      supabase.from('cp_application_status_history')
        .select('changed_by, new_status')
        .in('new_status', ['ACCOUNTS_VERIFIED', 'REJECTED'])
        .gte('created_at', weekStart),
      // Per-member this week activity (Partner)
      supabase.from('partner_payout_status_history')
        .select('changed_by, new_status')
        .in('new_status', ['ACCOUNTS_VERIFIED', 'REJECTED'])
        .gte('created_at', weekStart),

      // Per-member this month activity (CP)
      supabase.from('cp_application_status_history')
        .select('changed_by, new_status')
        .in('new_status', ['ACCOUNTS_VERIFIED', 'REJECTED'])
        .gte('created_at', monthStart),
      // Per-member this month activity (Partner)
      supabase.from('partner_payout_status_history')
        .select('changed_by, new_status')
        .in('new_status', ['ACCOUNTS_VERIFIED', 'REJECTED'])
        .gte('created_at', monthStart),

      // Current in-progress (CP)
      supabase.from('cp_applications')
        .select('accounts_verified_by')
        .eq('status', 'ACCOUNTS_VERIFICATION'),
      // Current in-progress (Partner)
      supabase.from('partner_payout_applications')
        .select('accounts_verified_by')
        .eq('status', 'ACCOUNTS_VERIFICATION'),

      // Processing time: CP verified this month
      supabase.from('cp_applications')
        .select('created_at, accounts_verified_at, accounts_verified_by')
        .eq('status', 'ACCOUNTS_VERIFIED')
        .gte('accounts_verified_at', monthStart)
        .limit(500),
      // Processing time: Partner verified this month
      supabase.from('partner_payout_applications')
        .select('created_at, accounts_verified_at, accounts_verified_by')
        .eq('status', 'ACCOUNTS_VERIFIED')
        .gte('accounts_verified_at', monthStart)
        .limit(500),

      // Department: total pending
      supabase.from('cp_applications').select('id', { count: 'exact', head: true })
        .in('status', ['PENDING', 'UNDER_REVIEW']),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('status', 'PENDING'),

      // Department: total in progress
      supabase.from('cp_applications').select('id', { count: 'exact', head: true })
        .eq('status', 'ACCOUNTS_VERIFICATION'),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('status', 'ACCOUNTS_VERIFICATION'),

      // Department: verified today
      supabase.from('cp_applications').select('id', { count: 'exact', head: true })
        .eq('status', 'ACCOUNTS_VERIFIED').gte('accounts_verified_at', todayStart),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('status', 'ACCOUNTS_VERIFIED').gte('accounts_verified_at', todayStart),

      // Department: verified this month
      supabase.from('cp_applications').select('id', { count: 'exact', head: true })
        .eq('status', 'ACCOUNTS_VERIFIED').gte('accounts_verified_at', monthStart),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('status', 'ACCOUNTS_VERIFIED').gte('accounts_verified_at', monthStart),

      // Department: overdue (pending > 48 hours)
      supabase.from('cp_applications').select('id', { count: 'exact', head: true })
        .in('status', ['PENDING', 'UNDER_REVIEW'])
        .lt('created_at', getISTStartOfDay(getISTDaysAgo(2))),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('status', 'PENDING')
        .lt('created_at', getISTStartOfDay(getISTDaysAgo(2))),

      // 7-day trend: CP
      supabase.from('cp_application_status_history')
        .select('new_status, created_at')
        .in('new_status', ['ACCOUNTS_VERIFIED', 'REJECTED'])
        .gte('created_at', sevenDaysAgo),
      // 7-day trend: Partner
      supabase.from('partner_payout_status_history')
        .select('new_status, created_at')
        .in('new_status', ['ACCOUNTS_VERIFIED', 'REJECTED'])
        .gte('created_at', sevenDaysAgo),
    ])

    // === Build per-member metrics ===
    const members = teamMembers.data || []

    // Initialize per-member accumulators
    const memberStats: Record<string, {
      verified_today: number
      rejected_today: number
      verified_this_week: number
      rejected_this_week: number
      verified_this_month: number
      rejected_this_month: number
      in_progress: number
      processing_hours: number[]
    }> = {}

    for (const m of members) {
      memberStats[m.id] = {
        verified_today: 0,
        rejected_today: 0,
        verified_this_week: 0,
        rejected_this_week: 0,
        verified_this_month: 0,
        rejected_this_month: 0,
        in_progress: 0,
        processing_hours: [],
      }
    }

    // Today activity
    for (const entry of [...(cpHistoryToday.data || []), ...(partnerHistoryToday.data || [])]) {
      if (!memberStats[entry.changed_by]) continue
      if (entry.new_status === 'ACCOUNTS_VERIFIED') memberStats[entry.changed_by].verified_today++
      else if (entry.new_status === 'REJECTED') memberStats[entry.changed_by].rejected_today++
    }

    // Week activity
    for (const entry of [...(cpHistoryWeek.data || []), ...(partnerHistoryWeek.data || [])]) {
      if (!memberStats[entry.changed_by]) continue
      if (entry.new_status === 'ACCOUNTS_VERIFIED') memberStats[entry.changed_by].verified_this_week++
      else if (entry.new_status === 'REJECTED') memberStats[entry.changed_by].rejected_this_week++
    }

    // Month activity
    for (const entry of [...(cpHistoryMonth.data || []), ...(partnerHistoryMonth.data || [])]) {
      if (!memberStats[entry.changed_by]) continue
      if (entry.new_status === 'ACCOUNTS_VERIFIED') memberStats[entry.changed_by].verified_this_month++
      else if (entry.new_status === 'REJECTED') memberStats[entry.changed_by].rejected_this_month++
    }

    // In-progress count per member
    for (const item of [...(cpInProgress.data || []), ...(partnerInProgress.data || [])]) {
      if (item.accounts_verified_by && memberStats[item.accounts_verified_by]) {
        memberStats[item.accounts_verified_by].in_progress++
      }
    }

    // Processing times per member
    for (const app of [...(cpProcessingTime.data || []), ...(partnerProcessingTime.data || [])]) {
      if (app.created_at && app.accounts_verified_at && app.accounts_verified_by && memberStats[app.accounts_verified_by]) {
        const hours = (new Date(app.accounts_verified_at).getTime() - new Date(app.created_at).getTime()) / (1000 * 60 * 60)
        if (hours > 0 && hours < 720) { // cap at 30 days
          memberStats[app.accounts_verified_by].processing_hours.push(hours)
        }
      }
    }

    // Build response members array
    const membersResponse = members.map(m => {
      const stats = memberStats[m.id]
      const totalDecisions = stats.verified_this_month + stats.rejected_this_month
      const accuracyRate = totalDecisions > 0
        ? Math.round((stats.verified_this_month / totalDecisions) * 1000) / 10
        : 0
      const avgProcessingHours = stats.processing_hours.length > 0
        ? Math.round((stats.processing_hours.reduce((s, h) => s + h, 0) / stats.processing_hours.length) * 10) / 10
        : 0
      const withinSla = stats.processing_hours.filter(h => h <= SLA_HOURS).length
      const slaCompliance = stats.processing_hours.length > 0
        ? Math.round((withinSla / stats.processing_hours.length) * 1000) / 10
        : 0

      return {
        id: m.id,
        full_name: m.full_name,
        sub_role: m.sub_role,
        status: m.status,
        metrics: {
          verified_today: stats.verified_today,
          verified_this_week: stats.verified_this_week,
          verified_this_month: stats.verified_this_month,
          rejected_this_month: stats.rejected_this_month,
          in_progress: stats.in_progress,
          avg_processing_hours: avgProcessingHours,
          accuracy_rate: accuracyRate,
          sla_compliance: slaCompliance,
        },
      }
    })

    // === Department-wide aggregates ===
    const allProcessingHours: number[] = []
    for (const app of [...(cpProcessingTime.data || []), ...(partnerProcessingTime.data || [])]) {
      if (app.created_at && app.accounts_verified_at) {
        const hours = (new Date(app.accounts_verified_at).getTime() - new Date(app.created_at).getTime()) / (1000 * 60 * 60)
        if (hours > 0 && hours < 720) allProcessingHours.push(hours)
      }
    }
    const deptAvgProcessingHours = allProcessingHours.length > 0
      ? Math.round((allProcessingHours.reduce((s, h) => s + h, 0) / allProcessingHours.length) * 10) / 10
      : 0
    const deptWithinSla = allProcessingHours.filter(h => h <= SLA_HOURS).length
    const deptSlaCompliance = allProcessingHours.length > 0
      ? Math.round((deptWithinSla / allProcessingHours.length) * 1000) / 10
      : 0

    const department = {
      total_verified_today: (cpVerifiedToday.count || 0) + (partnerVerifiedToday.count || 0),
      total_verified_month: (cpVerifiedMonth.count || 0) + (partnerVerifiedMonth.count || 0),
      total_pending: (cpPending.count || 0) + (partnerPending.count || 0),
      total_in_progress: (cpInVerification.count || 0) + (partnerInVerification.count || 0),
      avg_processing_hours: deptAvgProcessingHours,
      sla_compliance_rate: deptSlaCompliance,
      overdue_count: (cpOverdue.count || 0) + (partnerOverdue.count || 0),
    }

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
    const daily_trend = Object.entries(trendData).map(([date, data]) => ({
      date,
      day: new Date(date).toLocaleDateString('en-IN', { weekday: 'short' }),
      ...data,
    }))

    return NextResponse.json({
      success: true,
      data: {
        members: membersResponse,
        department,
        daily_trend,
      },
    })
  } catch (error) {
    logger.error('Error in accounts team performance API:', { error })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
