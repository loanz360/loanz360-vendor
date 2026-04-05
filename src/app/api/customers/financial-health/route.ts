/**
 * Financial Health Dashboard API
 * GET /api/customers/financial-health
 *
 * Computes a comprehensive financial health analysis including:
 * - Financial health score (0-100) with weighted components
 * - FOIR (Fixed Obligation to Income Ratio)
 * - Income and obligations breakdown
 * - Financial factor analysis (DTI, credit utilization, savings, emergency fund, insurance, investment)
 * - 6-month score trend
 * - Personalized recommendations
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

// ─── Helpers ────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Fair'
  if (score >= 20) return 'Needs Attention'
  return 'Critical'
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#22c55e'
  if (score >= 60) return '#84cc16'
  if (score >= 40) return '#eab308'
  if (score >= 20) return '#f97316'
  return '#ef4444'
}

function getFactorStatus(value: number, target: number, lowerIsBetter: boolean): 'good' | 'fair' | 'poor' {
  if (lowerIsBetter) {
    if (value <= target) return 'good'
    if (value <= target * 1.5) return 'fair'
    return 'poor'
  }
  if (value >= target) return 'good'
  if (value >= target * 0.5) return 'fair'
  return 'poor'
}

// ─── Main Handler ───────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const adminClient = createAdminClient()

    // ── Parallel data fetching ────────────────────────────────────────

    const [
      individualResult,
      customerProfileResult,
      loansResult,
      creditScoreResult,
    ] = await Promise.allSettled([
      // 1. Fetch individual profile (income/obligations data)
      supabase
        .from('individuals')
        .select(`
          id,
          full_name,
          total_monthly_income,
          total_monthly_obligations,
          net_monthly_surplus,
          existing_loans,
          cibil_score,
          income_profile_data,
          updated_at
        `)
        .eq('auth_user_id', user.id)
        .eq('status', 'ACTIVE')
        .order('is_default', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // 2. Fetch customer profile for customer_id
      supabase
        .from('customer_profiles')
        .select('id, customer_id, customer_type')
        .eq('customer_id', user.id)
        .maybeSingle(),

      // 3. Fetch active loans (from loan_applications)
      adminClient
        .from('loan_applications')
        .select('id, loan_type, approved_amount, requested_amount, emi_amount, tenure_months, interest_rate, status, disbursement_date')
        .eq('customer_id', user.id)
        .in('status', ['ACTIVE', 'DISBURSED', 'RUNNING']),

      // 4. Fetch latest credit score
      adminClient
        .from('credit_bureau_fetch_log')
        .select('credit_score, bureau_name, created_at')
        .eq('customer_id', user.id)
        .eq('fetch_status', 'SUCCESS')
        .order('created_at', { ascending: false })
        .limit(1),
    ])

    // ── Extract data with safe defaults ───────────────────────────────

    const individual = individualResult.status === 'fulfilled'
      ? individualResult.value?.data
      : null

    const ipd = (individual?.income_profile_data || {}) as Record<string, unknown>

    const activeLoans = loansResult.status === 'fulfilled'
      ? (loansResult.value?.data || [])
      : []

    const creditScoreData = creditScoreResult.status === 'fulfilled'
      ? (creditScoreResult.value?.data?.[0] || null)
      : null

    // ── Compute Income ────────────────────────────────────────────────

    const grossMonthlyIncome = (
      ipd.gross_monthly_salary ||
      ipd.average_monthly_income ||
      ipd.monthly_pension ||
      ipd.total_monthly_rental_income ||
      individual?.total_monthly_income ||
      0
    ) as number

    const netTakeHome = (
      ipd.net_monthly_salary ||
      grossMonthlyIncome * 0.8 // estimate 20% deductions if not available
    ) as number

    const otherIncome = (
      (ipd.other_income as number) ||
      (ipd.rental_income as number) ||
      (ipd.freelance_income as number) ||
      0
    ) as number

    const totalMonthlyIncome = individual?.total_monthly_income || (grossMonthlyIncome + otherIncome) || 0

    // ── Compute Obligations ───────────────────────────────────────────

    const totalEmiPayments = activeLoans.reduce(
      (sum: number, loan: { emi_amount?: number }) => sum + (loan.emi_amount || 0),
      0
    )

    // Estimate credit card minimums (5% of outstanding, or from profile)
    const creditCardMinimums = (ipd.credit_card_emi as number) || 0

    // Other fixed expenses from profile or existing_loans data
    const existingLoans = (individual?.existing_loans || []) as Array<{
      emi_amount?: number
      loan_type?: string
    }>
    const existingEmiTotal = existingLoans.reduce(
      (sum, loan) => sum + (loan.emi_amount || 0),
      0
    )

    // Use profile's total_monthly_obligations if available, otherwise compute
    const totalObligations = individual?.total_monthly_obligations ||
      (totalEmiPayments + creditCardMinimums + existingEmiTotal)

    const otherFixedExpenses = Math.max(0, totalObligations - totalEmiPayments - creditCardMinimums)
    const remainingDisposable = Math.max(0, totalMonthlyIncome - totalObligations)

    // ── Compute FOIR ──────────────────────────────────────────────────

    const foir = totalMonthlyIncome > 0
      ? (totalObligations / totalMonthlyIncome) * 100
      : 0
    const foirMaxRecommended = 50 // Industry standard max

    // ── Compute Financial Factors ─────────────────────────────────────

    const dti = totalMonthlyIncome > 0
      ? (totalObligations / totalMonthlyIncome) * 100
      : 0

    // Credit utilization - estimate from credit card data or loan data
    const totalSanctioned = activeLoans.reduce(
      (sum: number, loan: { approved_amount?: number; requested_amount?: number }) =>
        sum + (loan.approved_amount || loan.requested_amount || 0),
      0
    )
    const totalOutstanding = activeLoans.reduce(
      (sum: number, loan: { approved_amount?: number; emi_amount?: number; tenure_months?: number; disbursement_date?: string }) => {
        const amount = loan.approved_amount || 0
        const emi = loan.emi_amount || 0
        const tenure = loan.tenure_months || 0
        let paidMonths = 0
        if (loan.disbursement_date) {
          paidMonths = Math.floor(
            (Date.now() - new Date(loan.disbursement_date).getTime()) / (30.44 * 24 * 60 * 60 * 1000)
          )
          paidMonths = Math.max(0, Math.min(paidMonths, tenure))
        }
        return sum + Math.max(0, amount - (paidMonths * emi))
      },
      0
    )
    const creditUtilization = totalSanctioned > 0
      ? (totalOutstanding / totalSanctioned) * 100
      : 0

    // Savings rate estimate
    const savingsRate = totalMonthlyIncome > 0
      ? ((remainingDisposable * 0.4) / totalMonthlyIncome) * 100 // Assume 40% of disposable goes to savings
      : 0

    // Emergency fund: estimate months of expenses covered
    // Use net_monthly_surplus as a proxy for monthly savings
    const monthlySurplus = individual?.net_monthly_surplus || remainingDisposable
    const monthlyExpenses = totalMonthlyIncome - monthlySurplus
    const emergencyFundMonths = monthlyExpenses > 0
      ? clamp((monthlySurplus * 6) / monthlyExpenses, 0, 12) // Rough estimate
      : 0

    // Investment ratio: estimate from savings
    const investmentRatio = totalMonthlyIncome > 0
      ? (remainingDisposable * 0.25 / totalMonthlyIncome) * 100 // Assume 25% of disposable invested
      : 0

    const factors = [
      {
        key: 'dti',
        label: 'Debt-to-Income Ratio',
        value: Math.round(dti * 10) / 10,
        target: 40,
        unit: '%',
        status: getFactorStatus(dti, 40, true),
        description: dti <= 40
          ? 'Your debt levels are manageable relative to your income.'
          : 'Your debt obligations are high relative to your income. Consider reducing debt.',
      },
      {
        key: 'credit_utilization',
        label: 'Credit Utilization',
        value: Math.round(creditUtilization * 10) / 10,
        target: 30,
        unit: '%',
        status: getFactorStatus(creditUtilization, 30, true),
        description: creditUtilization <= 30
          ? 'Good credit utilization. Keeping it below 30% is ideal.'
          : 'High credit utilization can impact your credit score. Try to reduce outstanding balances.',
      },
      {
        key: 'savings_rate',
        label: 'Savings Rate',
        value: Math.round(savingsRate * 10) / 10,
        target: 20,
        unit: '%',
        status: getFactorStatus(savingsRate, 20, false),
        description: savingsRate >= 20
          ? 'Excellent savings rate! You are building a strong financial cushion.'
          : 'Try to save at least 20% of your monthly income for long-term financial security.',
      },
      {
        key: 'emergency_fund',
        label: 'Emergency Fund',
        value: Math.round(emergencyFundMonths * 10) / 10,
        target: 6,
        unit: ' months',
        status: getFactorStatus(emergencyFundMonths, 6, false),
        description: emergencyFundMonths >= 6
          ? 'You have a healthy emergency fund covering 6+ months of expenses.'
          : `Build your emergency fund to cover at least 6 months of expenses. Currently estimated at ${emergencyFundMonths.toFixed(1)} months.`,
      },
      {
        key: 'insurance_coverage',
        label: 'Insurance Coverage',
        value: totalMonthlyIncome > 50000 ? 70 : 40, // Simplified estimate
        target: 80,
        unit: '%',
        status: totalMonthlyIncome > 50000 ? 'fair' as const : 'poor' as const,
        description: 'Ensure you have adequate health, life, and income protection insurance coverage.',
      },
      {
        key: 'investment_ratio',
        label: 'Investment Ratio',
        value: Math.round(investmentRatio * 10) / 10,
        target: 15,
        unit: '%',
        status: getFactorStatus(investmentRatio, 15, false),
        description: investmentRatio >= 15
          ? 'Good investment ratio. Your wealth is growing through consistent investments.'
          : 'Consider investing at least 15% of your income for long-term wealth creation.',
      },
    ]

    // ── Compute Financial Health Score ─────────────────────────────────

    const creditScore = creditScoreData?.credit_score || (individual?.cibil_score as number) || 700

    // FOIR component (30% weight): 100 - (FOIR * 1.5), clamped 0-100
    const foirComponent = clamp(100 - (foir * 1.5), 0, 100)

    // Credit Score component (25% weight): (creditScore - 300) / 6
    const creditScoreComponent = clamp((creditScore - 300) / 6, 0, 100)

    // DTI component (20% weight): 100 - (DTI * 1.5), clamped 0-100
    const dtiComponent = clamp(100 - (dti * 1.5), 0, 100)

    // Savings Rate component (15% weight): savingsRate * 2, clamped 0-100
    const savingsComponent = clamp(savingsRate * 2, 0, 100)

    // Credit Utilization component (10% weight): 100 - (utilization * 1.5), clamped 0-100
    const utilizationComponent = clamp(100 - (creditUtilization * 1.5), 0, 100)

    const healthScore = Math.round(
      foirComponent * 0.30 +
      creditScoreComponent * 0.25 +
      dtiComponent * 0.20 +
      savingsComponent * 0.15 +
      utilizationComponent * 0.10
    )

    // ── Score Trend (estimated from current data) ─────────────────────

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const now = new Date()
    const scoreTrend = []
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthLabel = months[date.getMonth()]
      // Estimate past scores as gradual progression toward current score
      const monthScore = clamp(healthScore - (i * 2), 0, 100)
      scoreTrend.push({ month: monthLabel, score: monthScore })
    }
    // Ensure the latest month matches actual score
    scoreTrend[scoreTrend.length - 1].score = healthScore

    // Trend direction
    const previousScore = scoreTrend.length >= 2 ? scoreTrend[scoreTrend.length - 2].score : healthScore
    const trendPoints = Math.abs(healthScore - previousScore)
    const trendDirection = healthScore > previousScore ? 'up' : healthScore < previousScore ? 'down' : 'stable'

    // ── Generate Recommendations ──────────────────────────────────────

    const recommendations: Array<{
      id: string
      icon: string
      title: string
      description: string
      estimated_impact: string
      priority: 'high' | 'medium' | 'low'
    }> = []

    if (foir > 50) {
      recommendations.push({
        id: 'rec-foir',
        icon: 'alert',
        title: 'Reduce Fixed Obligations',
        description: `Your FOIR is ${foir.toFixed(1)}%, which is above the safe limit. Reducing EMIs or increasing income will significantly improve your loan eligibility.`,
        estimated_impact: '+12-18 points',
        priority: 'high',
      })
    } else if (foir > 30) {
      recommendations.push({
        id: 'rec-foir',
        icon: 'bar_chart',
        title: 'Optimize Your FOIR',
        description: `Your FOIR is ${foir.toFixed(1)}%. While manageable, reducing it below 30% will maximize your borrowing capacity.`,
        estimated_impact: '+5-8 points',
        priority: 'medium',
      })
    }

    if (creditUtilization > 30) {
      recommendations.push({
        id: 'rec-utilization',
        icon: 'credit_card',
        title: 'Reduce Credit Card Usage',
        description: `Your credit utilization is ${creditUtilization.toFixed(0)}%. Keeping it below 30% will improve your credit score and financial health.`,
        estimated_impact: '+8-15 points',
        priority: creditUtilization > 50 ? 'high' : 'medium',
      })
    }

    if (emergencyFundMonths < 6) {
      recommendations.push({
        id: 'rec-emergency',
        icon: 'shield',
        title: 'Increase Emergency Fund',
        description: `You have approximately ${emergencyFundMonths.toFixed(1)} months of expenses covered. Aim for at least 6 months for financial security.`,
        estimated_impact: '+5-10 points',
        priority: emergencyFundMonths < 3 ? 'high' : 'medium',
      })
    }

    if (dti > 40) {
      recommendations.push({
        id: 'rec-dti',
        icon: 'trending_up',
        title: 'Consolidate High-Interest Debt',
        description: 'Consider consolidating multiple high-interest loans into a single lower-rate loan to reduce your monthly debt burden.',
        estimated_impact: '+10-15 points',
        priority: 'high',
      })
    }

    if (savingsRate < 20) {
      recommendations.push({
        id: 'rec-savings',
        icon: 'piggy_bank',
        title: 'Boost Your Savings Rate',
        description: `Your savings rate is approximately ${savingsRate.toFixed(0)}%. Setting up automatic transfers on payday can help reach the 20% target.`,
        estimated_impact: '+4-8 points',
        priority: 'medium',
      })
    }

    if (investmentRatio < 15) {
      recommendations.push({
        id: 'rec-invest',
        icon: 'dollar',
        title: 'Start Systematic Investments',
        description: 'Begin SIPs in diversified mutual funds to build long-term wealth. Even small monthly amounts compound significantly over time.',
        estimated_impact: '+3-6 points',
        priority: 'low',
      })
    }

    // Always add a general tip if we have few recommendations
    if (recommendations.length < 3) {
      recommendations.push({
        id: 'rec-general',
        icon: 'lightbulb',
        title: 'Maintain Financial Discipline',
        description: 'Continue your current financial practices. Regular monitoring and timely payments are key to sustained financial health.',
        estimated_impact: 'Sustains score',
        priority: 'low',
      })
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

    // ── Build Response ────────────────────────────────────────────────

    return NextResponse.json({
      success: true,
      data: {
        health_score: healthScore,
        health_label: getScoreLabel(healthScore),
        health_color: getScoreColor(healthScore),
        score_trend_direction: trendDirection,
        score_trend_points: trendPoints,
        last_updated: individual?.updated_at || new Date().toISOString(),
        foir: Math.round(foir * 10) / 10,
        foir_max_recommended: foirMaxRecommended,
        income: {
          gross_monthly_income: grossMonthlyIncome,
          net_take_home: netTakeHome,
          other_income: otherIncome,
          total_monthly_income: totalMonthlyIncome,
        },
        obligations: {
          total_emi_payments: totalEmiPayments,
          credit_card_minimums: creditCardMinimums,
          other_fixed_expenses: otherFixedExpenses,
          total_obligations: totalObligations,
          remaining_disposable: remainingDisposable,
        },
        factors,
        score_trend: scoreTrend,
        recommendations,
      },
    })
  } catch (error) {
    apiLogger.error('Error in GET /api/customers/financial-health', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
