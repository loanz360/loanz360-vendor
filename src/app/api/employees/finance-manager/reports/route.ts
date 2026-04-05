import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export const dynamic = 'force-dynamic'

/**
 * GET /api/employees/finance-manager/reports
 * Financial reports for payout data
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month' // 'week', 'month', 'quarter'
    const type = searchParams.get('type') || 'all' // 'cp', 'partner', 'all'

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

    const isFinanceTeam = userData.role === 'EMPLOYEE' && ['FINANCE_EXECUTIVE', 'FINANCE_MANAGER'].includes(userData.sub_role)
    const isSuperAdmin = userData.role === 'SUPER_ADMIN'

    if (!isFinanceTeam && !isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    // Calculate date ranges
    const now = new Date()
    let dateFrom: string
    if (period === 'week') {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      dateFrom = d.toISOString()
    } else if (period === 'quarter') {
      const d = new Date(now)
      d.setMonth(d.getMonth() - 3)
      dateFrom = d.toISOString()
    } else {
      // month
      const d = new Date(now)
      d.setMonth(d.getMonth() - 1)
      dateFrom = d.toISOString()
    }

    const results: any = { cp: null, partner: null }

    if (type === 'cp' || type === 'all') {
      const { data: cpCredited } = await supabase
        .from('cp_applications')
        .select('id, app_id, application_number, customer_name, bank_name, loan_type, loan_amount_disbursed, expected_payout_percentage, expected_payout_amount, payment_amount, payment_date, payment_transaction_id, finance_processed_at')
        .eq('status', 'PAYOUT_CREDITED')
        .gte('finance_processed_at', dateFrom)
        .order('finance_processed_at', { ascending: false })

      const totalCredited = cpCredited?.reduce((sum, a) => sum + (a.payment_amount || a.expected_payout_amount || 0), 0) || 0
      const totalDisbursed = cpCredited?.reduce((sum, a) => sum + (a.loan_amount_disbursed || 0), 0) || 0

      results.cp = {
        records: cpCredited || [],
        total_count: cpCredited?.length || 0,
        total_credited: totalCredited,
        total_disbursed: totalDisbursed,
        avg_commission_pct: cpCredited?.length
          ? cpCredited.reduce((sum, a) => sum + (a.expected_payout_percentage || 0), 0) / cpCredited.length
          : 0,
      }
    }

    if (type === 'partner' || type === 'all') {
      const { data: partnerCredited } = await supabase
        .from('partner_payout_applications')
        .select('id, app_id, partner_type, partner_code, customer_name, bank_name, loan_type, disbursed_amount, commission_percentage, expected_commission_amount, payment_amount, payment_date, payment_transaction_id, finance_processed_at, is_team_override')
        .eq('status', 'PAYOUT_CREDITED')
        .gte('finance_processed_at', dateFrom)
        .order('finance_processed_at', { ascending: false })

      const totalCredited = partnerCredited?.reduce((sum, a) => sum + (a.payment_amount || a.expected_commission_amount || 0), 0) || 0
      const totalDisbursed = partnerCredited?.reduce((sum, a) => sum + (a.disbursed_amount || 0), 0) || 0

      // Group by partner type
      const baRecords = partnerCredited?.filter(r => r.partner_type === 'BA' && !r.is_team_override) || []
      const bpDirectRecords = partnerCredited?.filter(r => r.partner_type === 'BP' && !r.is_team_override) || []
      const bpOverrideRecords = partnerCredited?.filter(r => r.is_team_override) || []

      results.partner = {
        records: partnerCredited || [],
        total_count: partnerCredited?.length || 0,
        total_credited: totalCredited,
        total_disbursed: totalDisbursed,
        breakdown: {
          ba: { count: baRecords.length, amount: baRecords.reduce((s, r) => s + (r.payment_amount || r.expected_commission_amount || 0), 0) },
          bp_direct: { count: bpDirectRecords.length, amount: bpDirectRecords.reduce((s, r) => s + (r.payment_amount || r.expected_commission_amount || 0), 0) },
          bp_override: { count: bpOverrideRecords.length, amount: bpOverrideRecords.reduce((s, r) => s + (r.payment_amount || r.expected_commission_amount || 0), 0) },
        },
      }
    }

    // Grand totals
    const grandTotal = (results.cp?.total_credited || 0) + (results.partner?.total_credited || 0)
    const grandCount = (results.cp?.total_count || 0) + (results.partner?.total_count || 0)

    return NextResponse.json({
      success: true,
      data: {
        period,
        date_from: dateFrom,
        date_to: now.toISOString(),
        cp: results.cp,
        partner: results.partner,
        grand_total: grandTotal,
        grand_count: grandCount,
      },
    })
  } catch (error) {
    logger.error('Error in finance manager reports:', { error })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
