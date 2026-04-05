import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSERole } from '@/lib/auth/verify-dse-role'
import { isValidUUID, calculateCommission } from '@/lib/validations/dse-validation'

export const dynamic = 'force-dynamic'

interface DealRecord {
  id: string
  customer_name: string
  loan_amount: number
  product_type: string
  disbursed_at: string
  created_at: string
}

function getMonthRange(date: Date): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  }
}

function getYearStart(date: Date): string {
  return new Date(date.getFullYear(), 0, 1).toISOString()
}

function calculateMonthOverview(deals: DealRecord[], totalConversions: number) {
  const breakdown = deals.map((deal) => {
    const result = calculateCommission({
      loan_amount: deal.loan_amount,
      product_type: deal.product_type,
      monthly_conversions: totalConversions,
    })

    return {
      deal_id: deal.id,
      customer_name: deal.customer_name,
      loan_amount: deal.loan_amount,
      product_type: deal.product_type,
      commission: result.commission,
      rate: result.rate,
    }
  })

  const totalDisbursedValue = deals.reduce((sum, d) => sum + (d.loan_amount || 0), 0)
  const totalCommissionEarned = breakdown.reduce((sum, b) => sum + b.commission, 0)

  // Get tier info from the first calculation (tier is based on monthly_conversions)
  const tierInfo = calculateCommission({
    loan_amount: 0,
    product_type: 'Home Loan',
    monthly_conversions: totalConversions,
  })

  return {
    total_conversions: totalConversions,
    total_disbursed_value: totalDisbursedValue,
    total_commission_earned: totalCommissionEarned,
    current_tier: tierInfo.tier as 'Bronze' | 'Silver' | 'Gold',
    next_tier_in: tierInfo.next_tier_in,
    commission_breakdown: breakdown,
  }
}

// GET - Calculate DSE's commission overview
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const roleCheck = await verifyDSERole(supabase, user.id)
    if (!roleCheck.isValid) return roleCheck.response

    const now = new Date()
    const currentMonth = getMonthRange(now)
    const previousMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const previousMonth = getMonthRange(previousMonthDate)
    const yearStart = getYearStart(now)

    // Fetch current month, previous month, and YTD deals in parallel
    const [
      { data: currentDeals, error: currentError },
      { data: previousDeals, error: previousError },
      { data: ytdDeals, error: ytdError },
    ] = await Promise.all([
      supabase
        .from('crm_deals')
        .select('id, customer_name, loan_amount, product_type, disbursed_at, created_at')
        .eq('dse_user_id', user.id)
        .eq('status', 'disbursed')
        .gte('disbursed_at', currentMonth.start)
        .lte('disbursed_at', currentMonth.end)
        .order('disbursed_at', { ascending: false }),
      supabase
        .from('crm_deals')
        .select('id, customer_name, loan_amount, product_type, disbursed_at, created_at')
        .eq('dse_user_id', user.id)
        .eq('status', 'disbursed')
        .gte('disbursed_at', previousMonth.start)
        .lte('disbursed_at', previousMonth.end)
        .order('disbursed_at', { ascending: false }),
      supabase
        .from('crm_deals')
        .select('id, loan_amount, product_type')
        .eq('dse_user_id', user.id)
        .eq('status', 'disbursed')
        .gte('disbursed_at', yearStart)
        .lte('disbursed_at', now.toISOString()),
    ])

    if (currentError || previousError || ytdError) {
      apiLogger.error('Error fetching commission deals', {
        currentError,
        previousError,
        ytdError,
      })
      return NextResponse.json(
        { success: false, error: 'Failed to fetch deal data' },
        { status: 500 }
      )
    }

    const currentDealsList = (currentDeals || []) as DealRecord[]
    const previousDealsList = (previousDeals || []) as DealRecord[]
    const ytdDealsList = (ytdDeals || []) as Array<{ id: string; loan_amount: number; product_type: string }>

    // Calculate overviews
    const currentMonthOverview = calculateMonthOverview(currentDealsList, currentDealsList.length)
    const previousMonthOverview = calculateMonthOverview(previousDealsList, previousDealsList.length)

    // Calculate YTD total commission
    const ytdTotal = ytdDealsList.reduce((sum, deal) => {
      const result = calculateCommission({
        loan_amount: deal.loan_amount,
        product_type: deal.product_type,
        monthly_conversions: currentDealsList.length, // Use current month for tier
      })
      return sum + result.commission
    }, 0)

    return NextResponse.json({
      success: true,
      data: {
        current_month: currentMonthOverview,
        previous_month: previousMonthOverview,
        ytd_total: ytdTotal,
      },
    })
  } catch (error: unknown) {
    apiLogger.error('Error in commission GET', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
