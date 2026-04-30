/**
 * Bank Lending Rates API (read-only for customers)
 * GET /api/customers/bank-rates
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'


export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const loanType = searchParams.get('loan_type')
    const bank = searchParams.get('bank')
    const includeHistory = searchParams.get('history') === 'true'

    // Fetch active rates
    let ratesQuery = supabase
      .from('bank_lending_rates')
      .select('*')
      .eq('is_active', true)
      .order('min_rate', { ascending: true })

    if (loanType) ratesQuery = ratesQuery.eq('loan_type', loanType)
    if (bank) ratesQuery = ratesQuery.ilike('bank_name', `%${bank}%`)

    const { data: rates, error: ratesError } = await ratesQuery

    if (ratesError) {
      return NextResponse.json({ success: false, error: ratesError.message }, { status: 500 })
    }

    let history = null
    if (includeHistory) {
      let historyQuery = supabase
        .from('bank_rate_history')
        .select('*')
        .order('recorded_month', { ascending: true })
        .limit(24)

      if (loanType) historyQuery = historyQuery.eq('loan_type', loanType)

      const { data: historyData } = await historyQuery
      history = historyData
    }

    // Aggregate stats
    const loanTypes = [...new Set((rates || []).map((r) => r.loan_type))]
    const stats = loanTypes.map((lt) => {
      const typeRates = (rates || []).filter((r) => r.loan_type === lt)
      const minRate = Math.min(...typeRates.map((r) => r.min_rate))
      const maxRate = Math.max(...typeRates.map((r) => r.max_rate))
      const avgRate = typeRates.reduce((sum, r) => sum + (r.min_rate + r.max_rate) / 2, 0) / typeRates.length
      return { loan_type: lt, min_rate: minRate, max_rate: maxRate, avg_rate: Math.round(avgRate * 100) / 100, lender_count: typeRates.length }
    })

    return NextResponse.json({
      success: true,
      data: { rates: rates || [], stats, history },
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
