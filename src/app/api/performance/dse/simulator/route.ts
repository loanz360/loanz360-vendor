import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import type { CommissionSimulatorResult } from '@/lib/types/dse-enhanced-performance.types'


/**
 * POST /api/performance/dse/simulator
 * What-if commission simulator.
 * Accepts hypothetical additional deals/revenue and returns projected payout.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

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

    const bodySchema = z.object({


      additional_deals: z.number().optional().default(0),


      additional_revenue: z.number().optional().default(0),


      product_type: z.string().optional().default('personal_loan'),


      cross_sells: z.number().optional().default(0),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const {
      additional_deals = 0,
      additional_revenue = 0,
      product_type = 'personal_loan',
      cross_sells = 0,
    } = body

    // Validate inputs
    if (additional_deals < 0 || additional_deals > 100) {
      return NextResponse.json({ error: 'Invalid deal count (0-100)' }, { status: 400 })
    }
    if (additional_revenue < 0 || additional_revenue > 100000000) {
      return NextResponse.json({ error: 'Invalid revenue amount' }, { status: 400 })
    }

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    // Fetch current commission data
    const commissionRes = await fetch(
      `${request.nextUrl.origin}/api/performance/dse/commission?month=${currentMonth}&year=${currentYear}`,
      { headers: { cookie: request.headers.get('cookie') || '' } }
    )

    let currentCommission: unknown = null
    if (commissionRes.ok) {
      const data = await commissionRes.json()
      currentCommission = data.commission
    }

    // Fetch current summary
    let summary: unknown = null
    const { data: s1 } = await adminClient
      .from('dse_monthly_summary')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle()
    summary = s1

    if (!summary) {
      const { data: s2 } = await adminClient
        .from('dse_monthly_summary')
        .select('*')
        .eq('dse_user_id', user.id)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .maybeSingle()
      summary = s2
    }

    // Fetch targets
    const { data: targets } = await adminClient
      .from('dse_targets')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle()

    const currentRevenue = summary?.total_revenue || summary?.total_converted_revenue || 0
    const revenueTarget = targets?.revenue_target || 800000
    const baseSalary = currentCommission?.base_salary || 25000

    // Calculate projected metrics
    const projectedRevenue = currentRevenue + additional_revenue
    const currentAchievement = revenueTarget > 0 ? (currentRevenue / revenueTarget) * 100 : 0
    const projectedAchievement = revenueTarget > 0 ? (projectedRevenue / revenueTarget) * 100 : 0

    // Calculate projected variable pay
    let projectedVariable = 0
    if (projectedAchievement >= 150) {
      projectedVariable = baseSalary * 0.75 // 3x multiplier at top slab
    } else if (projectedAchievement >= 120) {
      projectedVariable = baseSalary * 0.5 // 2x multiplier
    } else if (projectedAchievement >= 100) {
      projectedVariable = baseSalary * 0.375 // 1.5x multiplier
    } else if (projectedAchievement >= 80) {
      projectedVariable = baseSalary * 0.25 // Base payout
    }

    // Product incentive estimate
    const productIncentiveRates: Record<string, number> = {
      home_loan: 0.003,
      lap: 0.005,
      personal_loan: 0.015,
      business_loan: 0.008,
      gold_loan: 0.010,
    }
    const additionalProductIncentive = additional_revenue * (productIncentiveRates[product_type] || 0.01)
    const currentProductIncentive = currentCommission?.product_incentive || 0
    const projectedProductIncentive = currentProductIncentive + additionalProductIncentive

    // Cross-sell bonus
    const crossSellBonus = cross_sells * 500 // ₹500 per cross-sell
    const currentCrossSell = currentCommission?.cross_sell_bonus || 0
    const projectedCrossSell = currentCrossSell + crossSellBonus

    // Super achiever bonus
    const projectedSuperAchiever = projectedAchievement >= 150 ? baseSalary * 0.25 : 0
    const currentSuperAchiever = currentCommission?.super_achiever_bonus || 0

    // Calculate totals
    const currentPayout = currentCommission?.net_payout || baseSalary
    const projectedGross = baseSalary + projectedVariable + projectedProductIncentive + projectedCrossSell + projectedSuperAchiever
    const tdsRate = projectedGross > 50000 ? 0.10 : 0
    const projectedNet = projectedGross * (1 - tdsRate)

    // Determine new slab
    let newSlab: string
    if (projectedAchievement >= 150) newSlab = 'Super Achiever (150%+)'
    else if (projectedAchievement >= 120) newSlab = 'High Performer (120-150%)'
    else if (projectedAchievement >= 100) newSlab = 'Target Achiever (100-120%)'
    else if (projectedAchievement >= 80) newSlab = 'Base Payout (80-100%)'
    else newSlab = 'Below Threshold (<80%)'

    const result: CommissionSimulatorResult = {
      current_payout: Number(currentPayout.toFixed(2)),
      projected_payout: Number(projectedNet.toFixed(2)),
      additional_earning: Number((projectedNet - currentPayout).toFixed(2)),
      new_achievement_pct: Number(projectedAchievement.toFixed(1)),
      new_slab: newSlab,
      new_rank_estimate: 0, // Would need leaderboard data for actual estimate
      breakdown: {
        base_salary_details: { amount: baseSalary, description: 'Fixed monthly base salary' },
        variable_details: [{
          slab_name: newSlab,
          achievement_pct: projectedAchievement,
          multiplier: projectedVariable / baseSalary,
          amount: projectedVariable,
        }],
        product_details: [{
          product_type,
          deals_count: additional_deals,
          total_disbursed: additional_revenue,
          commission_rate: (productIncentiveRates[product_type] || 0.01) * 100,
          amount: additionalProductIncentive,
        }],
        cross_sell_details: cross_sells > 0 ? [{
          product_name: 'Insurance/Credit Card',
          count: cross_sells,
          per_unit_bonus: 500,
          amount: crossSellBonus,
        }] : [],
        clawback_details: [],
        super_achiever: {
          qualified: projectedAchievement >= 150,
          amount: projectedSuperAchiever,
          achievement_pct: projectedAchievement,
        },
        tds: { rate: tdsRate * 100, amount: Number((projectedGross * tdsRate).toFixed(2)) },
      },
    }

    return NextResponse.json({
      result,
      comparison: {
        current_achievement: Number(currentAchievement.toFixed(1)),
        projected_achievement: Number(projectedAchievement.toFixed(1)),
        achievement_increase: Number((projectedAchievement - currentAchievement).toFixed(1)),
        payout_increase: Number((projectedNet - currentPayout).toFixed(2)),
        payout_increase_pct: currentPayout > 0 ? Number(((projectedNet - currentPayout) / currentPayout * 100).toFixed(1)) : 0,
      },
    })
  } catch (error) {
    apiLogger.error('Error in simulator API', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
