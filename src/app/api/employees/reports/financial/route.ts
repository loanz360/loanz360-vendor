import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export const dynamic = 'force-dynamic'

/**
 * GET /api/employees/reports/financial
 * Returns financial report data for accounts team
 * Supports monthly, partner-wise, and bank-wise reports
 * Includes CP payouts + BA/BP commissions across all views
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const reportType = searchParams.get('type') || 'monthly'

    // Auth
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

    const allowedRoles = ['SUPER_ADMIN']
    const allowedSubRoles = ['ACCOUNTS_EXECUTIVE', 'ACCOUNTS_MANAGER', 'FINANCE_MANAGER', 'FINANCE_EXECUTIVE']

    if (!allowedRoles.includes(userData.role) &&
        !(userData.role === 'EMPLOYEE' && allowedSubRoles.includes(userData.sub_role))) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    // Fetch all data needed for summary cards + reports
    const [cpAll, baAll, bpAll] = await Promise.all([
      supabase.from('cp_applications').select('expected_payout_amount, status, bank_name, loan_amount_disbursed, created_at, accounts_verified_at, cp_user:users!cp_applications_cp_user_id_fkey(full_name)'),
      supabase.from('leads').select('commission_amount, commission_status, sanctioned_bank, disbursed_amount, source_partner_name, disbursed_at, created_at').eq('source_type', 'ULAP_BA').eq('commission_eligible', true).eq('lead_status', 'DISBURSED'),
      supabase.from('leads').select('commission_amount, commission_status, sanctioned_bank, disbursed_amount, source_partner_name, disbursed_at, created_at').eq('source_type', 'ULAP_BP').eq('commission_eligible', true).eq('lead_status', 'DISBURSED'),
    ])

    const cpData = cpAll.data || []
    const baData = baAll.data || []
    const bpData = bpAll.data || []

    const summaryCards = {
      total_cp_payout: cpData.reduce((s, r) => s + (r.expected_payout_amount || 0), 0),
      total_ba_commission: baData.reduce((s, r) => s + (r.commission_amount || 0), 0),
      total_bp_commission: bpData.reduce((s, r) => s + (r.commission_amount || 0), 0),
      cp_verified_count: cpData.filter(r => r.status === 'ACCOUNTS_VERIFIED').length,
      ba_paid_count: baData.filter(r => r.commission_status === 'PAID').length,
      bp_paid_count: bpData.filter(r => r.commission_status === 'PAID').length,
      total_disbursed: cpData.reduce((s, r) => s + (r.loan_amount_disbursed || 0), 0)
        + baData.reduce((s, r) => s + (r.disbursed_amount || 0), 0)
        + bpData.reduce((s, r) => s + (r.disbursed_amount || 0), 0),
    }

    // --- PARTNER-WISE REPORT (BUG-09 fix: includes BA/BP) ---
    if (reportType === 'partner') {
      const partnerMap: Record<string, { name: string; type: string; total: number; pending: number; approved: number; count: number }> = {}

      cpData.forEach((app: any) => {
        const name = app.cp_user?.full_name || 'Unknown'
        const key = `CP:${name}`
        if (!partnerMap[key]) partnerMap[key] = { name, type: 'CP', total: 0, pending: 0, approved: 0, count: 0 }
        partnerMap[key].total += app.expected_payout_amount || 0
        partnerMap[key].count++
        if (['PENDING', 'UNDER_REVIEW'].includes(app.status)) partnerMap[key].pending += app.expected_payout_amount || 0
        if (['ACCOUNTS_VERIFIED', 'SA_APPROVED', 'PAYOUT_CREDITED'].includes(app.status)) partnerMap[key].approved += app.expected_payout_amount || 0
      })

      baData.forEach((lead: any) => {
        const name = lead.source_partner_name || 'Unknown'
        const key = `BA:${name}`
        if (!partnerMap[key]) partnerMap[key] = { name, type: 'BA', total: 0, pending: 0, approved: 0, count: 0 }
        partnerMap[key].total += lead.commission_amount || 0
        partnerMap[key].count++
        if (lead.commission_status === 'PENDING') partnerMap[key].pending += lead.commission_amount || 0
        if (['APPROVED', 'PAID'].includes(lead.commission_status)) partnerMap[key].approved += lead.commission_amount || 0
      })

      bpData.forEach((lead: any) => {
        const name = lead.source_partner_name || 'Unknown'
        const key = `BP:${name}`
        if (!partnerMap[key]) partnerMap[key] = { name, type: 'BP', total: 0, pending: 0, approved: 0, count: 0 }
        partnerMap[key].total += lead.commission_amount || 0
        partnerMap[key].count++
        if (lead.commission_status === 'PENDING') partnerMap[key].pending += lead.commission_amount || 0
        if (['APPROVED', 'PAID'].includes(lead.commission_status)) partnerMap[key].approved += lead.commission_amount || 0
      })

      return NextResponse.json({
        success: true,
        summaryCards,
        report: Object.values(partnerMap).sort((a, b) => b.total - a.total),
      })
    }

    // --- BANK-WISE REPORT (BUG-09 fix: includes BA/BP) ---
    if (reportType === 'bank') {
      const bankMap: Record<string, { bank: string; disbursed: number; payout: number; count: number }> = {}

      cpData.forEach((app: any) => {
        const bank = app.bank_name || 'Unknown'
        if (!bankMap[bank]) bankMap[bank] = { bank, disbursed: 0, payout: 0, count: 0 }
        bankMap[bank].disbursed += app.loan_amount_disbursed || 0
        bankMap[bank].payout += app.expected_payout_amount || 0
        bankMap[bank].count++
      })

      baData.forEach((lead: any) => {
        const bank = lead.sanctioned_bank || 'Unknown'
        if (!bankMap[bank]) bankMap[bank] = { bank, disbursed: 0, payout: 0, count: 0 }
        bankMap[bank].disbursed += lead.disbursed_amount || 0
        bankMap[bank].payout += lead.commission_amount || 0
        bankMap[bank].count++
      })

      bpData.forEach((lead: any) => {
        const bank = lead.sanctioned_bank || 'Unknown'
        if (!bankMap[bank]) bankMap[bank] = { bank, disbursed: 0, payout: 0, count: 0 }
        bankMap[bank].disbursed += lead.disbursed_amount || 0
        bankMap[bank].payout += lead.commission_amount || 0
        bankMap[bank].count++
      })

      return NextResponse.json({
        success: true,
        summaryCards,
        report: Object.values(bankMap).sort((a, b) => b.disbursed - a.disbursed),
      })
    }

    // --- MONTHLY REPORT (BUG-04 fix: actual per-month data) ---
    const months: { month: string; monthKey: string; cp: number; ba: number; bp: number; cp_amount: number; ba_amount: number; bp_amount: number; total_amount: number }[] = []

    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const monthLabel = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })

      // CP: count verified/approved apps whose accounts_verified_at falls in this month
      const cpInMonth = cpData.filter(r => {
        const dateStr = r.accounts_verified_at || r.created_at
        return dateStr && dateStr.startsWith(monthKey) &&
          ['ACCOUNTS_VERIFIED', 'SA_APPROVED', 'PAYOUT_CREDITED'].includes(r.status)
      })
      const cpCount = cpInMonth.length
      const cpAmount = cpInMonth.reduce((s, r) => s + (r.expected_payout_amount || 0), 0)

      // BA: count paid/approved commissions disbursed in this month
      const baInMonth = baData.filter(r => {
        const dateStr = r.disbursed_at || r.created_at
        return dateStr && dateStr.startsWith(monthKey)
      })
      const baCount = baInMonth.length
      const baAmount = baInMonth.reduce((s, r) => s + (r.commission_amount || 0), 0)

      // BP: same logic
      const bpInMonth = bpData.filter(r => {
        const dateStr = r.disbursed_at || r.created_at
        return dateStr && dateStr.startsWith(monthKey)
      })
      const bpCount = bpInMonth.length
      const bpAmount = bpInMonth.reduce((s, r) => s + (r.commission_amount || 0), 0)

      months.push({
        month: monthLabel,
        monthKey,
        cp: cpCount,
        ba: baCount,
        bp: bpCount,
        cp_amount: cpAmount,
        ba_amount: baAmount,
        bp_amount: bpAmount,
        total_amount: cpAmount + baAmount + bpAmount,
      })
    }

    return NextResponse.json({
      success: true,
      summaryCards,
      report: months,
    })
  } catch (error) {
    logger.error('Error in financial reports API:', { error })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
