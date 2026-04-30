import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import type { DSECommissionCalculation, CommissionBreakdown } from '@/lib/types/dse-enhanced-performance.types'


/**
 * GET /api/performance/dse/commission
 * Returns the current month's commission calculation with full breakdown.
 * Includes base salary, variable pay, product incentives, cross-sell bonuses,
 * clawbacks, super achiever bonus, and TDS.
 */
export async function GET(request: NextRequest) {
  try {
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

    if (!profile || profile.sub_role !== 'DIRECT_SALES_EXECUTIVE') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Validate params
    if (month < 1 || month > 12 || year < 2020 || year > 2100) {
      return NextResponse.json({ error: 'Invalid month or year' }, { status: 400 })
    }

    // Fetch existing commission calculation
    const { data: commission, error: commError } = await adminClient
      .from('dse_commission_calculations')
      .select('*')
      .eq('dse_user_id', user.id)
      .eq('month', month)
      .eq('year', year)
      .maybeSingle()

    if (commError) {
      apiLogger.error('Error fetching commission data', commError)
      return NextResponse.json({ error: 'Failed to fetch commission data' }, { status: 500 })
    }

    if (commission) {
      // Return existing calculation
      return NextResponse.json({
        commission,
        status: commission.status,
        payout_timeline: getPayoutTimeline(commission.status, month, year),
      })
    }

    // No calculation exists yet - generate a live estimate
    const estimate = await generateCommissionEstimate(adminClient, user.id, month, year)

    return NextResponse.json({
      commission: estimate,
      status: 'estimated',
      payout_timeline: getPayoutTimeline('calculated', month, year),
      note: 'This is a real-time estimate. Final calculation will be done by the 5th of next month.',
    })
  } catch (error) {
    apiLogger.error('Error in commission API', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Generate a real-time commission estimate based on current performance data.
 */
async function generateCommissionEstimate(
  adminClient: unknown,
  userId: string,
  month: number,
  year: number
): Promise<Partial<DSECommissionCalculation>> {
  // Fetch monthly summary
  let summary: unknown = null
  const { data: s1 } = await adminClient
    .from('dse_monthly_summary')
    .select('*')
    .eq('user_id', userId)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle()

  if (s1) {
    summary = s1
  } else {
    const { data: s2 } = await adminClient
      .from('dse_monthly_summary')
      .select('*')
      .eq('dse_user_id', userId)
      .eq('month', month)
      .eq('year', year)
      .maybeSingle()
    summary = s2
  }

  // Fetch targets
  const { data: targets } = await adminClient
    .from('dse_targets')
    .select('*')
    .eq('user_id', userId)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle()

  // Fetch commission slabs
  const { data: slabs } = await adminClient
    .from('commission_slabs')
    .select('*')
    .eq('role', 'DIRECT_SALES_EXECUTIVE')
    .eq('is_active', true)
    .order('slab_order', { ascending: true })

  // Fetch product performance for product incentives
  const { data: products } = await adminClient
    .from('dse_product_performance')
    .select('*')
    .eq('dse_user_id', userId)
    .eq('month', month)
    .eq('year', year)

  // Calculate achievement percentage
  const revenue = summary?.total_revenue || summary?.total_converted_revenue || 0
  const revenueTarget = targets?.revenue_target || 800000
  const achievementPct = revenueTarget > 0 ? (revenue / revenueTarget) * 100 : 0

  // Default base salary (would come from employee profile in production)
  const baseSalary = 25000

  // Calculate variable pay based on slabs
  let variablePay = 0
  const variableDetails: unknown[] = []

  if (slabs && slabs.length > 0) {
    for (const slab of slabs) {
      if (achievementPct >= slab.min_achievement_pct) {
        const slabAchievement = slab.max_achievement_pct
          ? Math.min(achievementPct, slab.max_achievement_pct)
          : achievementPct
        const amount = slab.fixed_amount + (baseSalary * slab.commission_rate * (slab.is_incremental ? (slabAchievement - slab.min_achievement_pct) / 100 : 1))
        variablePay += amount
        variableDetails.push({
          slab_name: slab.slab_name,
          achievement_pct: slabAchievement,
          multiplier: slab.commission_rate,
          amount: Number(amount.toFixed(2)),
        })
      }
    }
  } else {
    // Default calculation if no slabs configured
    if (achievementPct >= 80) {
      variablePay = baseSalary * 0.5 * (achievementPct / 100)
      variableDetails.push({
        slab_name: 'Default Variable',
        achievement_pct: achievementPct,
        multiplier: 0.5,
        amount: Number(variablePay.toFixed(2)),
      })
    }
  }

  // Product incentives
  let productIncentive = 0
  const productDetails: unknown[] = (products || []).map((p: unknown) => {
    productIncentive += p.incentive_earned || 0
    return {
      product_type: p.product_type,
      deals_count: p.conversions_count || 0,
      total_disbursed: p.revenue_generated || 0,
      commission_rate: p.revenue_generated > 0 ? ((p.incentive_earned || 0) / p.revenue_generated) * 100 : 0,
      amount: p.incentive_earned || 0,
    }
  })

  // Super achiever bonus
  const superAchieverBonus = achievementPct >= 150 ? baseSalary * 0.25 : 0

  // Gross calculation
  const grossCommission = baseSalary + variablePay + productIncentive + superAchieverBonus
  const tdsRate = grossCommission > 50000 ? 0.10 : 0
  const tdsDeduction = grossCommission * tdsRate
  const netPayout = grossCommission - tdsDeduction

  const breakdown: CommissionBreakdown = {
    base_salary_details: { amount: baseSalary, description: 'Fixed monthly base salary' },
    variable_details: variableDetails,
    product_details: productDetails,
    cross_sell_details: [],
    clawback_details: [],
    super_achiever: {
      qualified: achievementPct >= 150,
      amount: superAchieverBonus,
      achievement_pct: achievementPct,
    },
    tds: { rate: tdsRate * 100, amount: Number(tdsDeduction.toFixed(2)) },
  }

  return {
    dse_user_id: userId,
    month,
    year,
    base_salary: baseSalary,
    variable_pay: Number(variablePay.toFixed(2)),
    product_incentive: Number(productIncentive.toFixed(2)),
    cross_sell_bonus: 0,
    super_achiever_bonus: Number(superAchieverBonus.toFixed(2)),
    clawback_amount: 0,
    gross_commission: Number(grossCommission.toFixed(2)),
    tds_deduction: Number(tdsDeduction.toFixed(2)),
    net_payout: Number(netPayout.toFixed(2)),
    calculation_details: breakdown,
    status: 'calculated' as const,
  }
}

/**
 * Get payout timeline information.
 */
function getPayoutTimeline(status: string, month: number, year: number) {
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year

  return {
    calculation_date: `${nextYear}-${String(nextMonth).padStart(2, '0')}-05`,
    verification_date: `${nextYear}-${String(nextMonth).padStart(2, '0')}-10`,
    payout_date: `${nextYear}-${String(nextMonth).padStart(2, '0')}-15`,
    current_status: status,
    steps: [
      { step: 'Calculated', date: `5th ${getMonthName(nextMonth)}`, done: ['calculated', 'verified', 'approved', 'paid'].includes(status) },
      { step: 'Verified by Finance', date: `10th ${getMonthName(nextMonth)}`, done: ['verified', 'approved', 'paid'].includes(status) },
      { step: 'Approved', date: `12th ${getMonthName(nextMonth)}`, done: ['approved', 'paid'].includes(status) },
      { step: 'Paid', date: `15th ${getMonthName(nextMonth)}`, done: status === 'paid' },
    ],
  }
}

function getMonthName(month: number): string {
  return new Date(2024, month - 1).toLocaleDateString('en-IN', { month: 'short' })
}
