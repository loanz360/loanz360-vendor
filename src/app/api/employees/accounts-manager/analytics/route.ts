import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export const dynamic = 'force-dynamic'

function getISTStartOfDay(dateStr: string): string {
  return `${dateStr}T00:00:00+05:30`
}

/**
 * GET /api/employees/accounts-manager/analytics
 * Financial analytics, anomaly detection, bank reconciliation summary
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

    const isAllowed = userData.role === 'SUPER_ADMIN' ||
      (userData.role === 'EMPLOYEE' && ['ACCOUNTS_EXECUTIVE', 'ACCOUNTS_MANAGER'].includes(userData.sub_role))
    if (!isAllowed) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'financial'
    const today = new Date().toISOString().split('T')[0]
    const monthStart = `${today.substring(0, 7)}-01`
    const monthStartIST = getISTStartOfDay(monthStart)

    if (type === 'financial') {
      // Monthly financial breakdown by partner type and bank
      const [cpApps, partnerApps] = await Promise.all([
        supabase.from('cp_applications')
          .select('bank_name, loan_amount_disbursed, expected_payout_amount, status')
          .gte('created_at', monthStartIST),
        supabase.from('partner_payout_applications')
          .select('partner_type, bank_name, disbursed_amount, expected_commission_amount, status')
          .gte('created_at', monthStartIST),
      ])

      // Bank-wise breakdown
      const bankMap: Record<string, { disbursed: number; commission: number; count: number }> = {}
      for (const app of (cpApps.data || [])) {
        const bank = app.bank_name || 'Unknown'
        if (!bankMap[bank]) bankMap[bank] = { disbursed: 0, commission: 0, count: 0 }
        bankMap[bank].disbursed += app.loan_amount_disbursed || 0
        bankMap[bank].commission += app.expected_payout_amount || 0
        bankMap[bank].count++
      }
      for (const app of (partnerApps.data || [])) {
        const bank = app.bank_name || 'Unknown'
        if (!bankMap[bank]) bankMap[bank] = { disbursed: 0, commission: 0, count: 0 }
        bankMap[bank].disbursed += app.disbursed_amount || 0
        bankMap[bank].commission += app.expected_commission_amount || 0
        bankMap[bank].count++
      }

      const bankBreakdown = Object.entries(bankMap)
        .map(([bank, data]) => ({ bank, ...data }))
        .sort((a, b) => b.commission - a.commission)

      // Partner type summary
      const partnerSummary = {
        CP: { count: (cpApps.data || []).length, total_disbursed: 0, total_commission: 0 },
        BA: { count: 0, total_disbursed: 0, total_commission: 0 },
        BP: { count: 0, total_disbursed: 0, total_commission: 0 },
      }
      for (const app of (cpApps.data || [])) {
        partnerSummary.CP.total_disbursed += app.loan_amount_disbursed || 0
        partnerSummary.CP.total_commission += app.expected_payout_amount || 0
      }
      for (const app of (partnerApps.data || [])) {
        const pt = app.partner_type as 'BA' | 'BP'
        if (partnerSummary[pt]) {
          partnerSummary[pt].count++
          partnerSummary[pt].total_disbursed += app.disbursed_amount || 0
          partnerSummary[pt].total_commission += app.expected_commission_amount || 0
        }
      }

      return NextResponse.json({
        success: true,
        data: { bankBreakdown, partnerSummary, period: monthStart },
      })
    }

    if (type === 'anomalies') {
      // Detect potential anomalies
      const anomalies: { type: string; severity: string; description: string; application_id?: string; app_id?: string }[] = []

      // 1. High commission percentage (>5%)
      const { data: highCommission } = await supabase
        .from('partner_payout_applications')
        .select('id, app_id, partner_type, commission_percentage, partner_name, expected_commission_amount')
        .gt('commission_percentage', 5)
        .in('status', ['PENDING', 'ACCOUNTS_VERIFICATION'])
        .limit(20)

      for (const app of (highCommission || [])) {
        anomalies.push({
          type: 'HIGH_COMMISSION',
          severity: app.commission_percentage > 8 ? 'critical' : 'warning',
          description: `${app.partner_type} ${app.app_id}: ${app.commission_percentage}% commission (${app.partner_name})`,
          application_id: app.id,
          app_id: app.app_id,
        })
      }

      // 2. Bank sheet unmatched but high amount
      const { data: unmatchedHigh } = await supabase
        .from('partner_payout_applications')
        .select('id, app_id, partner_type, disbursed_amount, partner_name')
        .eq('bank_sheet_matched', false)
        .gt('disbursed_amount', 1000000)
        .in('status', ['PENDING', 'ACCOUNTS_VERIFICATION'])
        .limit(20)

      for (const app of (unmatchedHigh || [])) {
        anomalies.push({
          type: 'UNMATCHED_HIGH_VALUE',
          severity: 'critical',
          description: `${app.partner_type} ${app.app_id}: ₹${(app.disbursed_amount / 100000).toFixed(1)}L unmatched (${app.partner_name})`,
          application_id: app.id,
          app_id: app.app_id,
        })
      }

      // 3. Duplicate customer+bank combinations
      const { data: cpDupes } = await supabase
        .from('cp_applications')
        .select('customer_name, bank_name')
        .in('status', ['PENDING', 'UNDER_REVIEW', 'ACCOUNTS_VERIFICATION'])

      const dupeMap: Record<string, number> = {}
      for (const app of (cpDupes || [])) {
        const key = `${(app.customer_name || '').toLowerCase()}_${(app.bank_name || '').toLowerCase()}`
        dupeMap[key] = (dupeMap[key] || 0) + 1
      }
      for (const [key, count] of Object.entries(dupeMap)) {
        if (count > 1) {
          anomalies.push({
            type: 'DUPLICATE_SUSPECTED',
            severity: 'warning',
            description: `${count} pending CP applications for same customer+bank: ${key.replace('_', ' / ')}`,
          })
        }
      }

      return NextResponse.json({
        success: true,
        data: { anomalies, total: anomalies.length },
      })
    }

    if (type === 'reconciliation') {
      // Bank reconciliation summary
      const [matched, unmatched, totalApps] = await Promise.all([
        supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
          .eq('bank_sheet_matched', true)
          .in('status', ['ACCOUNTS_VERIFIED', 'SA_APPROVED', 'FINANCE_PROCESSING', 'PAYOUT_CREDITED']),
        supabase.from('partner_payout_applications').select('id, app_id, partner_type, partner_name, disbursed_amount, expected_commission_amount, created_at')
          .eq('bank_sheet_matched', false)
          .in('status', ['PENDING', 'ACCOUNTS_VERIFICATION'])
          .order('disbursed_amount', { ascending: false })
          .limit(50),
        supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
          .in('status', ['PENDING', 'ACCOUNTS_VERIFICATION', 'ACCOUNTS_VERIFIED', 'SA_APPROVED', 'FINANCE_PROCESSING', 'PAYOUT_CREDITED']),
      ])

      const matchedCount = matched.count || 0
      const totalCount = totalApps.count || 0
      const unmatchedList = unmatched.data || []
      const totalUnmatchedAmount = unmatchedList.reduce((s, a) => s + (a.disbursed_amount || 0), 0)

      return NextResponse.json({
        success: true,
        data: {
          matched_count: matchedCount,
          unmatched_count: unmatchedList.length,
          total_count: totalCount,
          match_rate: totalCount > 0 ? Math.round((matchedCount / totalCount) * 100) : 0,
          total_unmatched_amount: totalUnmatchedAmount,
          unmatched_applications: unmatchedList,
        },
      })
    }

    return NextResponse.json({ success: false, error: 'Invalid type parameter' }, { status: 400 })
  } catch (error) {
    logger.error('Error in analytics API:', { error })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
