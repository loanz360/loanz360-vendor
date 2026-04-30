import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


/**
 * GET /api/employees/finance-manager/payout-oversight
 * Finance Manager overview of all payout operations
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
      .select('id, role, sub_role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (!userData) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const isFinanceManager = userData.role === 'EMPLOYEE' && userData.sub_role === 'FINANCE_MANAGER'
    const isSuperAdmin = userData.role === 'SUPER_ADMIN'

    if (!isFinanceManager && !isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Access denied. Only Finance Managers can access this resource.' }, { status: 403 })
    }

    const today = new Date().toISOString().split('T')[0]
    const monthStart = `${today.substring(0, 7)}-01`

    // Parallel queries for CP and Partner payouts
    const [
      // CP stats
      cpPendingRes,
      cpProcessingRes,
      cpCreditedTodayRes,
      cpCreditedMonthRes,
      cpOnHoldRes,
      // Partner stats
      partnerPendingRes,
      partnerProcessingRes,
      partnerCreditedTodayRes,
      partnerCreditedMonthRes,
      partnerOnHoldRes,
      // Recent activity
      recentCPActivity,
      recentPartnerActivity,
      // Team members
      teamMembersRes,
    ] = await Promise.all([
      // CP
      supabase.from('cp_applications').select('id', { count: 'exact', head: true }).eq('status', 'SA_APPROVED'),
      supabase.from('cp_applications').select('id', { count: 'exact', head: true }).eq('status', 'FINANCE_PROCESSING'),
      supabase.from('cp_applications').select('id', { count: 'exact', head: true }).eq('status', 'PAYOUT_CREDITED').gte('finance_processed_at', `${today}T00:00:00`),
      supabase.from('cp_applications').select('id', { count: 'exact', head: true }).eq('status', 'PAYOUT_CREDITED').gte('finance_processed_at', `${monthStart}T00:00:00`),
      supabase.from('cp_applications').select('id', { count: 'exact', head: true }).eq('status', 'ON_HOLD'),
      // Partner
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true }).eq('status', 'SA_APPROVED'),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true }).eq('status', 'FINANCE_PROCESSING'),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true }).eq('status', 'PAYOUT_CREDITED').gte('finance_processed_at', `${today}T00:00:00`),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true }).eq('status', 'PAYOUT_CREDITED').gte('finance_processed_at', `${monthStart}T00:00:00`),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true }).eq('status', 'ON_HOLD'),
      // Recent CP activity
      supabase.from('cp_application_status_history')
        .select('id, application_id, app_id, new_status, previous_status, changed_by_name, changed_by_role, notes, created_at')
        .in('changed_by_role', ['FINANCE_EXECUTIVE', 'FINANCE_MANAGER'])
        .order('created_at', { ascending: false })
        .limit(10),
      // Recent Partner activity
      supabase.from('partner_payout_status_history')
        .select('id, application_id, app_id, partner_type, new_status, previous_status, changed_by_name, changed_by_role, notes, created_at')
        .in('changed_by_role', ['FINANCE_EXECUTIVE', 'FINANCE_MANAGER'])
        .order('created_at', { ascending: false })
        .limit(10),
      // Finance team members
      supabase.from('users')
        .select('id, full_name, sub_role')
        .eq('role', 'EMPLOYEE')
        .in('sub_role', ['FINANCE_EXECUTIVE', 'FINANCE_MANAGER']),
    ])

    // Get amounts for pending payouts
    const [cpPendingAmounts, partnerPendingAmounts] = await Promise.all([
      supabase.from('cp_applications')
        .select('commission_amount')
        .in('status', ['SA_APPROVED', 'FINANCE_PROCESSING']),
      supabase.from('partner_payout_applications')
        .select('expected_commission_amount')
        .in('status', ['SA_APPROVED', 'FINANCE_PROCESSING']),
    ])

    const totalCPPendingAmount = cpPendingAmounts.data?.reduce(
      (sum, a) => sum + (a.commission_amount || 0), 0
    ) || 0

    const totalPartnerPendingAmount = partnerPendingAmounts.data?.reduce(
      (sum, a) => sum + (a.expected_commission_amount || 0), 0
    ) || 0

    // Merge and sort recent activity
    const cpActivity = (recentCPActivity.data || []).map(a => ({
      ...a,
      source: 'CP' as const,
      partner_type: 'CP',
    }))
    const partnerActivity = (recentPartnerActivity.data || []).map(a => ({
      ...a,
      source: 'PARTNER' as const,
    }))
    const allActivity = [...cpActivity, ...partnerActivity]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 15)

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          cp: {
            pending: cpPendingRes.count || 0,
            processing: cpProcessingRes.count || 0,
            credited_today: cpCreditedTodayRes.count || 0,
            credited_month: cpCreditedMonthRes.count || 0,
            on_hold: cpOnHoldRes.count || 0,
            pending_amount: totalCPPendingAmount,
          },
          partner: {
            pending: partnerPendingRes.count || 0,
            processing: partnerProcessingRes.count || 0,
            credited_today: partnerCreditedTodayRes.count || 0,
            credited_month: partnerCreditedMonthRes.count || 0,
            on_hold: partnerOnHoldRes.count || 0,
            pending_amount: totalPartnerPendingAmount,
          },
          totals: {
            pending: (cpPendingRes.count || 0) + (partnerPendingRes.count || 0),
            processing: (cpProcessingRes.count || 0) + (partnerProcessingRes.count || 0),
            credited_today: (cpCreditedTodayRes.count || 0) + (partnerCreditedTodayRes.count || 0),
            credited_month: (cpCreditedMonthRes.count || 0) + (partnerCreditedMonthRes.count || 0),
            on_hold: (cpOnHoldRes.count || 0) + (partnerOnHoldRes.count || 0),
            pending_amount: totalCPPendingAmount + totalPartnerPendingAmount,
          },
        },
        recent_activity: allActivity,
        team_members: teamMembersRes.data || [],
      },
    })
  } catch (error) {
    logger.error('Error in finance manager payout oversight:', { error })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
