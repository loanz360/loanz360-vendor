import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export const dynamic = 'force-dynamic'

/** Get IST date string (YYYY-MM-DD) for "today" calculations */
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

/**
 * GET /api/employees/accounts-executive/dashboard
 * Returns comprehensive dashboard data for Accounts Executive
 * Includes: stats, financial summary, aging analysis, 7-day trend, recent activity,
 *           downstream status tracking (SA_APPROVED, FINANCE_PROCESSING)
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

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

    const allowedRoles = ['SUPER_ADMIN']
    const allowedSubRoles = ['ACCOUNTS_EXECUTIVE', 'ACCOUNTS_MANAGER']

    if (!allowedRoles.includes(userData.role) &&
        !(userData.role === 'EMPLOYEE' && allowedSubRoles.includes(userData.sub_role))) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const isManager = userData.sub_role === 'ACCOUNTS_MANAGER' || userData.role === 'SUPER_ADMIN'
    const includeParams = (searchParams.get('include') || '').split(',').map(s => s.trim())
    const includeTeam = includeParams.includes('team')
    const includeSLA = includeParams.includes('sla')
    const includeCompliance = includeParams.includes('compliance')
    const includePostVerify = includeParams.includes('postVerify')

    const today = getISTDate()
    const todayStart = getISTStartOfDay(today)
    const monthStart = `${today.substring(0, 7)}-01`
    const monthStartIST = getISTStartOfDay(monthStart)
    const threeDaysAgo = getISTStartOfDay(getISTDaysAgo(3))
    const sevenDaysAgo = getISTStartOfDay(getISTDaysAgo(7))

    // Run all queries in parallel
    const [
      cpPending, cpInVerification, cpVerifiedToday,
      baPending, baInVerification, baVerifiedToday,
      bpPending, bpInVerification, bpVerifiedToday,
      cpMonthlyVerified, baMonthlyVerified, bpMonthlyVerified,
      cpRecentActivity, partnerRecentActivity,
      cpPendingAmounts, baPendingAmounts, bpPendingAmounts,
      cpAgingCount, baAgingCount, bpAgingCount,
      cpRejectedToday, partnerRejectedToday,
      cpOnHold, baOnHold, bpOnHold,
      cpWeeklyActivity, partnerWeeklyActivity,
      myRecentCPActivity, myRecentPartnerActivity,
      cpSAApproved, baSAApproved, bpSAApproved,
      cpFinanceProcessing, baFinanceProcessing, bpFinanceProcessing,
    ] = await Promise.all([
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

      supabase.from('cp_applications').select('id', { count: 'exact', head: true })
        .eq('status', 'ACCOUNTS_VERIFIED').gte('accounts_verified_at', monthStartIST),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BA').eq('status', 'ACCOUNTS_VERIFIED').gte('accounts_verified_at', monthStartIST),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BP').eq('status', 'ACCOUNTS_VERIFIED').gte('accounts_verified_at', monthStartIST),

      supabase.from('cp_application_status_history')
        .select('id, application_id, previous_status, new_status, changed_by_name, changed_by_role, notes, created_at')
        .order('created_at', { ascending: false }).limit(5),
      supabase.from('partner_payout_status_history')
        .select('id, application_id, app_id, partner_type, previous_status, new_status, changed_by_name, changed_by_role, notes, created_at')
        .order('created_at', { ascending: false }).limit(5),

      supabase.from('cp_applications').select('expected_payout_amount')
        .in('status', ['PENDING', 'UNDER_REVIEW', 'ACCOUNTS_VERIFICATION']),
      supabase.from('partner_payout_applications').select('expected_commission_amount')
        .eq('partner_type', 'BA').in('status', ['PENDING', 'ACCOUNTS_VERIFICATION']),
      supabase.from('partner_payout_applications').select('expected_commission_amount')
        .eq('partner_type', 'BP').in('status', ['PENDING', 'ACCOUNTS_VERIFICATION']),

      supabase.from('cp_applications').select('id', { count: 'exact', head: true })
        .in('status', ['PENDING', 'UNDER_REVIEW']).lt('created_at', threeDaysAgo),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BA').eq('status', 'PENDING').lt('created_at', threeDaysAgo),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BP').eq('status', 'PENDING').lt('created_at', threeDaysAgo),

      supabase.from('cp_applications').select('id', { count: 'exact', head: true })
        .eq('status', 'REJECTED').gte('reviewed_at', todayStart),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('status', 'REJECTED').gte('updated_at', todayStart),

      supabase.from('cp_applications').select('id', { count: 'exact', head: true })
        .eq('status', 'ON_HOLD'),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BA').eq('status', 'ON_HOLD'),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BP').eq('status', 'ON_HOLD'),

      supabase.from('cp_application_status_history')
        .select('new_status, created_at')
        .in('new_status', ['ACCOUNTS_VERIFIED', 'REJECTED'])
        .gte('created_at', sevenDaysAgo),
      supabase.from('partner_payout_status_history')
        .select('new_status, created_at')
        .in('new_status', ['ACCOUNTS_VERIFIED', 'REJECTED'])
        .gte('created_at', sevenDaysAgo),

      supabase.from('cp_application_status_history')
        .select('id, application_id, previous_status, new_status, changed_by_name, notes, created_at')
        .eq('changed_by', user.id)
        .order('created_at', { ascending: false }).limit(10),
      supabase.from('partner_payout_status_history')
        .select('id, application_id, app_id, partner_type, previous_status, new_status, changed_by_name, notes, created_at')
        .eq('changed_by', user.id)
        .order('created_at', { ascending: false }).limit(10),

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
    ])

    // Merge team activity
    const cpActivity = (cpRecentActivity.data || []).map(a => ({ ...a, source: 'CP' as const }))
    const partnerActivity = (partnerRecentActivity.data || []).map(a => ({ ...a, source: a.partner_type as string }))
    const mergedActivity = [...cpActivity, ...partnerActivity]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)

    // Merge my activity
    const myCPActivity = (myRecentCPActivity.data || []).map(a => ({ ...a, source: 'CP' as const }))
    const myPartnerAct = (myRecentPartnerActivity.data || []).map(a => ({ ...a, source: a.partner_type as string }))
    const myActivity = [...myCPActivity, ...myPartnerAct]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)

    // Calculate financial totals
    const cpPendingAmount = (cpPendingAmounts.data || []).reduce(
      (sum, a) => sum + (a.expected_payout_amount || 0), 0)
    const baPendingAmount = (baPendingAmounts.data || []).reduce(
      (sum, a) => sum + (a.expected_commission_amount || 0), 0)
    const bpPendingAmount = (bpPendingAmounts.data || []).reduce(
      (sum, a) => sum + (a.expected_commission_amount || 0), 0)

    // Build 7-day trend
    const trendData: Record<string, { verified: number; rejected: number }> = {}
    for (let i = 6; i >= 0; i--) {
      const d = getISTDaysAgo(i)
      trendData[d] = { verified: 0, rejected: 0 }
    }
    const allWeeklyData = [
      ...(cpWeeklyActivity.data || []),
      ...(partnerWeeklyActivity.data || []),
    ]
    for (const entry of allWeeklyData) {
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

    // Today's productivity from my activity
    const todayMyVerified = myActivity.filter(a =>
      a.new_status === 'ACCOUNTS_VERIFIED' && a.created_at >= todayStart
    ).length
    const todayMyPickedUp = myActivity.filter(a =>
      a.new_status === 'ACCOUNTS_VERIFICATION' && a.created_at >= todayStart
    ).length
    const todayMyRejected = myActivity.filter(a =>
      a.new_status === 'REJECTED' && a.created_at >= todayStart
    ).length

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
      monthly: {
        cp_verified: cpMonthlyVerified.count || 0,
        ba_verified: baMonthlyVerified.count || 0,
        bp_verified: bpMonthlyVerified.count || 0,
        total_verified: (cpMonthlyVerified.count || 0) + (baMonthlyVerified.count || 0) + (bpMonthlyVerified.count || 0),
      },
      verified_today_total: (cpVerifiedToday.count || 0) + (baVerifiedToday.count || 0) + (bpVerifiedToday.count || 0),
      in_progress_total: (cpInVerification.count || 0) + (baInVerification.count || 0) + (bpInVerification.count || 0),
      pending_total: (cpPending.count || 0) + (baPending.count || 0) + (bpPending.count || 0),
      total_in_verification: (cpInVerification.count || 0) + (baInVerification.count || 0) + (bpInVerification.count || 0),
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

    const rejectedToday = (cpRejectedToday.count || 0) + (partnerRejectedToday.count || 0)
    const onHoldTotal = (cpOnHold.count || 0) + (baOnHold.count || 0) + (bpOnHold.count || 0)

    const todayProductivity = {
      verified: todayMyVerified,
      picked_up: todayMyPickedUp,
      rejected: todayMyRejected,
      total_actions: todayMyVerified + todayMyPickedUp + todayMyRejected,
    }

    // === Optional: Team Stats (for Manager) ===
    let teamStats: { user_id: string; name: string; verified: number; rejected: number; in_progress: number }[] | undefined
    if (includeTeam && isManager) {
      const { data: teamMembers } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('role', 'EMPLOYEE')
        .in('sub_role', ['ACCOUNTS_EXECUTIVE', 'ACCOUNTS_MANAGER'])

      if (teamMembers && teamMembers.length > 0) {
        const memberIds = teamMembers.map(m => m.id)
        const [cpTeamHistory, partnerTeamHistory] = await Promise.all([
          supabase.from('cp_application_status_history')
            .select('changed_by, new_status')
            .in('changed_by', memberIds)
            .gte('created_at', monthStartIST),
          supabase.from('partner_payout_status_history')
            .select('changed_by, new_status')
            .in('changed_by', memberIds)
            .gte('created_at', monthStartIST),
        ])

        const allHistory = [...(cpTeamHistory.data || []), ...(partnerTeamHistory.data || [])]
        const memberMap = Object.fromEntries(teamMembers.map(m => [m.id, m.full_name]))

        teamStats = teamMembers.map(m => {
          const memberActions = allHistory.filter(h => h.changed_by === m.id)
          return {
            user_id: m.id,
            name: memberMap[m.id] || 'Unknown',
            verified: memberActions.filter(a => a.new_status === 'ACCOUNTS_VERIFIED').length,
            rejected: memberActions.filter(a => a.new_status === 'REJECTED').length,
            in_progress: memberActions.filter(a => a.new_status === 'ACCOUNTS_VERIFICATION').length,
          }
        })
      }
    }

    // === Optional: SLA Data ===
    let sla: { total_processed: number; within_sla: number; sla_percentage: number; avg_processing_hours: number } | undefined
    if (includeSLA) {
      const { data: recentVerified } = await supabase
        .from('cp_application_status_history')
        .select('application_id, created_at')
        .eq('new_status', 'ACCOUNTS_VERIFIED')
        .gte('created_at', monthStartIST)

      const { data: recentPickups } = await supabase
        .from('cp_application_status_history')
        .select('application_id, created_at')
        .eq('new_status', 'ACCOUNTS_VERIFICATION')
        .gte('created_at', monthStartIST)

      const pickupMap = new Map((recentPickups || []).map(p => [p.application_id, p.created_at]))
      let totalProcessed = 0
      let withinSLA = 0
      let totalHours = 0

      for (const v of (recentVerified || [])) {
        const pickupTime = pickupMap.get(v.application_id)
        if (pickupTime) {
          totalProcessed++
          const hours = (new Date(v.created_at).getTime() - new Date(pickupTime).getTime()) / (1000 * 60 * 60)
          totalHours += hours
          if (hours <= 48) withinSLA++
        }
      }

      sla = {
        total_processed: totalProcessed,
        within_sla: withinSLA,
        sla_percentage: totalProcessed > 0 ? Math.round((withinSLA / totalProcessed) * 100) : 100,
        avg_processing_hours: totalProcessed > 0 ? Math.round(totalHours / totalProcessed) : 0,
      }
    }

    // === Optional: Compliance Data ===
    let compliance: { documents_verified: number; documents_flagged: number; compliance_rate: number; pending_review: number } | undefined
    if (includeCompliance) {
      const [verifiedDocs, flaggedApps, pendingReviewApps] = await Promise.all([
        supabase.from('cp_applications').select('id', { count: 'exact', head: true })
          .eq('status', 'ACCOUNTS_VERIFIED')
          .gte('accounts_verified_at', monthStartIST),
        supabase.from('cp_applications').select('id', { count: 'exact', head: true })
          .eq('status', 'REJECTED')
          .gte('reviewed_at', monthStartIST),
        supabase.from('cp_applications').select('id', { count: 'exact', head: true })
          .in('status', ['PENDING', 'UNDER_REVIEW', 'ACCOUNTS_VERIFICATION']),
      ])

      const verified = verifiedDocs.count || 0
      const flagged = flaggedApps.count || 0
      const total = verified + flagged
      compliance = {
        documents_verified: verified,
        documents_flagged: flagged,
        compliance_rate: total > 0 ? Math.round((verified / total) * 100) : 100,
        pending_review: pendingReviewApps.count || 0,
      }
    }

    // === Optional: Post-Verify Tracking ===
    let postVerify: { application_id: string; app_id?: string; partner_type: string; current_status: string; verified_at: string; customer_name?: string; loan_amount?: number }[] | undefined
    if (includePostVerify) {
      const [cpPostVerify, partnerPostVerify] = await Promise.all([
        supabase.from('cp_applications')
          .select('id, app_id, customer_name, loan_amount_disbursed, status, accounts_verified_at')
          .in('status', ['SA_APPROVED', 'FINANCE_PROCESSING', 'PAYOUT_CREDITED'])
          .order('accounts_verified_at', { ascending: false })
          .limit(10),
        supabase.from('partner_payout_applications')
          .select('id, app_id, partner_type, customer_name, disbursed_amount, status, accounts_verified_at')
          .in('status', ['SA_APPROVED', 'FINANCE_PROCESSING', 'PAYOUT_CREDITED'])
          .order('accounts_verified_at', { ascending: false })
          .limit(10),
      ])

      postVerify = [
        ...(cpPostVerify.data || []).map(a => ({
          application_id: a.id,
          app_id: a.app_id,
          partner_type: 'CP',
          current_status: a.status,
          verified_at: a.accounts_verified_at || '',
          customer_name: a.customer_name,
          loan_amount: a.loan_amount_disbursed,
        })),
        ...(partnerPostVerify.data || []).map(a => ({
          application_id: a.id,
          app_id: a.app_id,
          partner_type: a.partner_type,
          current_status: a.status,
          verified_at: a.accounts_verified_at || '',
          customer_name: a.customer_name,
          loan_amount: a.disbursed_amount,
        })),
      ].sort((a, b) => new Date(b.verified_at).getTime() - new Date(a.verified_at).getTime()).slice(0, 15)
    }

    return NextResponse.json({
      success: true,
      data: {
        stats,
        financial,
        aging,
        rejectedToday,
        onHoldTotal,
        weeklyTrend,
        todayProductivity,
        recentActivity: mergedActivity,
        myActivity,
        userName: userData.full_name,
        ...(teamStats && { teamStats }),
        ...(sla && { sla }),
        ...(compliance && { compliance }),
        ...(postVerify && { postVerify }),
      },
    })
  } catch (error) {
    logger.error('Error fetching accounts dashboard:', { error })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
