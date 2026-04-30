import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import type { DSEBankPerformance, BankRoutingSuggestion } from '@/lib/types/dse-enhanced-performance.types'


/**
 * GET /api/performance/dse/bank-performance
 * Returns bank partner performance matrix for the authenticated DSE.
 * Shows approval rates, TAT, rejection reasons per bank.
 * Also provides smart bank routing suggestions for new leads.
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))

    // Authenticate
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSE role
    const adminClient = createSupabaseAdmin()
    const { data: profile } = await adminClient
      .from('users')
      .select('sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || !['DIRECT_SALES_EXECUTIVE', 'DIRECT_SALES_MANAGER'].includes(profile.sub_role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Validate params
    if (month < 1 || month > 12 || year < 2020 || year > 2100) {
      return NextResponse.json({ error: 'Invalid month or year' }, { status: 400 })
    }

    // Fetch bank performance data
    const { data: bankData, error: bankError } = await adminClient
      .from('dse_bank_performance')
      .select('*')
      .eq('dse_user_id', user.id)
      .eq('month', month)
      .eq('year', year)
      .order('total_disbursed_amount', { ascending: false })

    if (bankError) {
      apiLogger.error('Error fetching bank performance', bankError)
      return NextResponse.json({ error: 'Failed to fetch bank performance data' }, { status: 500 })
    }

    const banks: DSEBankPerformance[] = bankData || []

    // Calculate totals
    const totals = {
      total_submitted: banks.reduce((sum, b) => sum + (b.cases_submitted || 0), 0),
      total_approved: banks.reduce((sum, b) => sum + (b.cases_approved || 0), 0),
      total_rejected: banks.reduce((sum, b) => sum + (b.cases_rejected || 0), 0),
      total_pending: banks.reduce((sum, b) => sum + (b.cases_pending || 0), 0),
      total_disbursed: banks.reduce((sum, b) => sum + (b.total_disbursed_amount || 0), 0),
      overall_approval_rate: 0,
      average_tat_days: 0,
    }

    totals.overall_approval_rate = totals.total_submitted > 0
      ? (totals.total_approved / totals.total_submitted) * 100
      : 0

    const bankWithTAT = banks.filter((b) => b.average_tat_days > 0)
    totals.average_tat_days = bankWithTAT.length > 0
      ? bankWithTAT.reduce((sum, b) => sum + b.average_tat_days, 0) / bankWithTAT.length
      : 0

    // Generate bank routing suggestions based on historical performance
    const routingSuggestions: BankRoutingSuggestion[] = banks
      .filter((b) => b.cases_submitted >= 3) // Only suggest banks with enough history
      .sort((a, b) => b.approval_rate - a.approval_rate)
      .map((b) => {
        let reason = ''
        if (b.approval_rate >= 80) {
          reason = `${b.approval_rate.toFixed(0)}% approval rate with ${b.average_tat_days.toFixed(0)}-day avg TAT`
        } else if (b.approval_rate >= 60) {
          reason = `Moderate approval rate. Best for ${b.average_ticket_size > 2000000 ? 'high-ticket' : 'standard'} applications`
        } else {
          reason = `Low approval rate (${b.approval_rate.toFixed(0)}%). Check rejection patterns before submitting`
        }

        return {
          bank_name: b.bank_name,
          approval_probability: b.approval_rate,
          estimated_tat_days: b.average_tat_days,
          reason,
          historical_approval_rate: b.approval_rate,
        }
      })

    // Top rejection reasons across all banks
    const allRejections: Record<string, number> = {}
    banks.forEach((b) => {
      const reasons = b.rejection_reasons || []
      reasons.forEach((r: Record<string, unknown>) => {
        const reason = typeof r === 'string' ? r : r.reason || 'Unknown'
        allRejections[reason] = (allRejections[reason] || 0) + (typeof r === 'object' ? r.count || 1 : 1)
      })
    })

    const topRejectionReasons = Object.entries(allRejections)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: totals.total_rejected > 0 ? (count / totals.total_rejected) * 100 : 0,
      }))

    return NextResponse.json({
      banks,
      totals,
      routing_suggestions: routingSuggestions,
      top_rejection_reasons: topRejectionReasons,
      period: { month, year },
    })
  } catch (error) {
    apiLogger.error('Error in bank performance API', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
