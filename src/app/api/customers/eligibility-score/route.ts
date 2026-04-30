/**
 * Instant Eligibility Score API
 * GET /api/customers/eligibility-score
 *
 * Computes customer eligibility across all loan products using:
 * - Customer profile (income, employment)
 * - Credit bureau score (from credit_bureau_fetch_log)
 * - Existing obligations (from leads / loan_applications)
 * - FOIR-based max eligible amount calculation
 *
 * Returns: overall score (0-100), per-product eligibility, improvement tips
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


// ─── Loan Product Definitions ────────────────────────────────────────────────

interface LoanProductConfig {
  id: string
  name: string
  minAmount: number
  maxAmount: number
  minRate: number
  maxRate: number
  interestRateDisplay: string
  maxTenureMonths: number
  maxTenureDisplay: string
  maxFoir: number           // Maximum FOIR limit for this product (as decimal, e.g. 0.50)
  minCreditScore: number    // Minimum credit score required
  category: 'consumer' | 'business' | 'asset_backed' | 'professional' | 'nri'
}

const LOAN_PRODUCTS: LoanProductConfig[] = [
  {
    id: 'personal',
    name: 'Personal Loan',
    minAmount: 50000,
    maxAmount: 2500000,
    minRate: 10.5,
    maxRate: 18,
    interestRateDisplay: '10.5% - 18%',
    maxTenureMonths: 60,
    maxTenureDisplay: '60 months',
    maxFoir: 0.50,
    minCreditScore: 650,
    category: 'consumer',
  },
  {
    id: 'home',
    name: 'Home Loan',
    minAmount: 500000,
    maxAmount: 50000000,
    minRate: 8.5,
    maxRate: 10.5,
    interestRateDisplay: '8.5% - 10.5%',
    maxTenureMonths: 360,
    maxTenureDisplay: '30 years',
    maxFoir: 0.50,
    minCreditScore: 700,
    category: 'consumer',
  },
  {
    id: 'car',
    name: 'Car Loan',
    minAmount: 100000,
    maxAmount: 10000000,
    minRate: 9,
    maxRate: 14,
    interestRateDisplay: '9% - 14%',
    maxTenureMonths: 84,
    maxTenureDisplay: '84 months',
    maxFoir: 0.50,
    minCreditScore: 650,
    category: 'consumer',
  },
  {
    id: 'business',
    name: 'Business Loan',
    minAmount: 100000,
    maxAmount: 50000000,
    minRate: 12,
    maxRate: 24,
    interestRateDisplay: '12% - 24%',
    maxTenureMonths: 60,
    maxTenureDisplay: '60 months',
    maxFoir: 0.65,
    minCreditScore: 650,
    category: 'business',
  },
  {
    id: 'education',
    name: 'Education Loan',
    minAmount: 100000,
    maxAmount: 15000000,
    minRate: 8,
    maxRate: 15,
    interestRateDisplay: '8% - 15%',
    maxTenureMonths: 180,
    maxTenureDisplay: '15 years',
    maxFoir: 0.50,
    minCreditScore: 600,
    category: 'consumer',
  },
  {
    id: 'lap',
    name: 'Loan Against Property',
    minAmount: 500000,
    maxAmount: 100000000,
    minRate: 9,
    maxRate: 14,
    interestRateDisplay: '9% - 14%',
    maxTenureMonths: 240,
    maxTenureDisplay: '20 years',
    maxFoir: 0.55,
    minCreditScore: 650,
    category: 'asset_backed',
  },
  {
    id: 'gold',
    name: 'Gold Loan',
    minAmount: 10000,
    maxAmount: 5000000,
    minRate: 7,
    maxRate: 14,
    interestRateDisplay: '7% - 14%',
    maxTenureMonths: 36,
    maxTenureDisplay: '36 months',
    maxFoir: 0.65,
    minCreditScore: 0,  // No credit score needed for gold loans
    category: 'asset_backed',
  },
  {
    id: 'credit-card',
    name: 'Credit Card',
    minAmount: 25000,
    maxAmount: 1000000,
    minRate: 24,
    maxRate: 42,
    interestRateDisplay: '24% - 42%',
    maxTenureMonths: 0,
    maxTenureDisplay: 'Revolving',
    maxFoir: 0.50,
    minCreditScore: 700,
    category: 'consumer',
  },
  {
    id: 'working-capital',
    name: 'Working Capital',
    minAmount: 100000,
    maxAmount: 50000000,
    minRate: 12,
    maxRate: 20,
    interestRateDisplay: '12% - 20%',
    maxTenureMonths: 60,
    maxTenureDisplay: '60 months',
    maxFoir: 0.65,
    minCreditScore: 650,
    category: 'business',
  },
  {
    id: 'machinery',
    name: 'Machinery Loan',
    minAmount: 500000,
    maxAmount: 100000000,
    minRate: 10,
    maxRate: 18,
    interestRateDisplay: '10% - 18%',
    maxTenureMonths: 84,
    maxTenureDisplay: '84 months',
    maxFoir: 0.60,
    minCreditScore: 650,
    category: 'business',
  },
  {
    id: 'bill-discounting',
    name: 'Bill Discounting',
    minAmount: 100000,
    maxAmount: 50000000,
    minRate: 10,
    maxRate: 16,
    interestRateDisplay: '10% - 16%',
    maxTenureMonths: 6,
    maxTenureDisplay: '180 days',
    maxFoir: 0.70,
    minCreditScore: 600,
    category: 'business',
  },
  {
    id: 'mortgage',
    name: 'Mortgage Loan',
    minAmount: 1000000,
    maxAmount: 100000000,
    minRate: 9,
    maxRate: 13,
    interestRateDisplay: '9% - 13%',
    maxTenureMonths: 240,
    maxTenureDisplay: '20 years',
    maxFoir: 0.55,
    minCreditScore: 700,
    category: 'asset_backed',
  },
  {
    id: 'loan-against-shares',
    name: 'Loan Against Shares',
    minAmount: 100000,
    maxAmount: 50000000,
    minRate: 9,
    maxRate: 14,
    interestRateDisplay: '9% - 14%',
    maxTenureMonths: 36,
    maxTenureDisplay: '36 months',
    maxFoir: 0.55,
    minCreditScore: 650,
    category: 'asset_backed',
  },
  {
    id: 'lease-rental-discounting',
    name: 'Lease Rental Discounting',
    minAmount: 1000000,
    maxAmount: 100000000,
    minRate: 8.5,
    maxRate: 12,
    interestRateDisplay: '8.5% - 12%',
    maxTenureMonths: 180,
    maxTenureDisplay: '15 years',
    maxFoir: 0.60,
    minCreditScore: 700,
    category: 'asset_backed',
  },
  {
    id: 'loan-to-doctors',
    name: 'Loan to Doctors',
    minAmount: 500000,
    maxAmount: 50000000,
    minRate: 10,
    maxRate: 16,
    interestRateDisplay: '10% - 16%',
    maxTenureMonths: 84,
    maxTenureDisplay: '84 months',
    maxFoir: 0.60,
    minCreditScore: 650,
    category: 'professional',
  },
  {
    id: 'loan-to-hospitals',
    name: 'Loan to Hospitals',
    minAmount: 1000000,
    maxAmount: 200000000,
    minRate: 10,
    maxRate: 15,
    interestRateDisplay: '10% - 15%',
    maxTenureMonths: 120,
    maxTenureDisplay: '10 years',
    maxFoir: 0.60,
    minCreditScore: 650,
    category: 'professional',
  },
  {
    id: 'loan-to-educational-institutions',
    name: 'Loan to Educational Institutions',
    minAmount: 1000000,
    maxAmount: 100000000,
    minRate: 10,
    maxRate: 14,
    interestRateDisplay: '10% - 14%',
    maxTenureMonths: 120,
    maxTenureDisplay: '10 years',
    maxFoir: 0.60,
    minCreditScore: 650,
    category: 'professional',
  },
  {
    id: 'loan-to-builders',
    name: 'Loan to Builders',
    minAmount: 5000000,
    maxAmount: 500000000,
    minRate: 12,
    maxRate: 18,
    interestRateDisplay: '12% - 18%',
    maxTenureMonths: 60,
    maxTenureDisplay: '60 months',
    maxFoir: 0.65,
    minCreditScore: 700,
    category: 'professional',
  },
  {
    id: 'loan-to-professionals',
    name: 'Loan to Professionals',
    minAmount: 500000,
    maxAmount: 50000000,
    minRate: 10,
    maxRate: 16,
    interestRateDisplay: '10% - 16%',
    maxTenureMonths: 84,
    maxTenureDisplay: '84 months',
    maxFoir: 0.60,
    minCreditScore: 650,
    category: 'professional',
  },
  {
    id: 'nri',
    name: 'NRI Loan',
    minAmount: 1000000,
    maxAmount: 100000000,
    minRate: 8.5,
    maxRate: 12,
    interestRateDisplay: '8.5% - 12%',
    maxTenureMonths: 240,
    maxTenureDisplay: '20 years',
    maxFoir: 0.50,
    minCreditScore: 700,
    category: 'nri',
  },
]

// ─── Financial Computation Helpers ──────────────────────────────────────────

/**
 * Calculate Present Value of an annuity (max loan amount given EMI capacity)
 * PV = EMI * [(1 - (1 + r)^-n) / r]
 * where r = monthly interest rate, n = number of months
 */
function calculateMaxLoanAmount(
  availableEmi: number,
  annualRate: number,
  tenureMonths: number
): number {
  if (availableEmi <= 0 || tenureMonths <= 0 || annualRate <= 0) return 0

  const monthlyRate = annualRate / 12 / 100
  const factor = (1 - Math.pow(1 + monthlyRate, -tenureMonths)) / monthlyRate
  return Math.floor(availableEmi * factor)
}

/**
 * Compute overall eligibility score (0-100) based on multiple factors
 */
function computeOverallScore(
  monthlyIncome: number,
  creditScore: number | null,
  currentFoir: number,
  hasProfile: boolean
): number {
  let score = 0

  // Income factor (0-30 points)
  if (monthlyIncome >= 100000) score += 30
  else if (monthlyIncome >= 50000) score += 25
  else if (monthlyIncome >= 30000) score += 20
  else if (monthlyIncome >= 20000) score += 15
  else if (monthlyIncome > 0) score += 8
  // 0 points if no income

  // Credit score factor (0-35 points)
  if (creditScore !== null) {
    if (creditScore >= 800) score += 35
    else if (creditScore >= 750) score += 30
    else if (creditScore >= 700) score += 25
    else if (creditScore >= 650) score += 18
    else if (creditScore >= 600) score += 12
    else if (creditScore >= 550) score += 6
    // Below 550: 0 points
  } else {
    // No credit score available - partial credit for having income
    score += monthlyIncome > 0 ? 10 : 0
  }

  // FOIR factor (0-25 points) - lower is better
  if (currentFoir <= 0) score += 25       // No existing obligations
  else if (currentFoir <= 20) score += 22
  else if (currentFoir <= 30) score += 18
  else if (currentFoir <= 40) score += 14
  else if (currentFoir <= 50) score += 8
  else if (currentFoir <= 60) score += 4
  // Above 60%: 0 points

  // Profile completeness factor (0-10 points)
  if (hasProfile) score += 10

  return Math.min(Math.max(score, 0), 100)
}

/**
 * Generate improvement tips based on customer's financial profile
 */
function generateTips(
  monthlyIncome: number,
  creditScore: number | null,
  currentFoir: number,
  totalExistingEmis: number
): string[] {
  const tips: string[] = []

  // FOIR tips
  if (currentFoir > 55) {
    tips.push(
      'Your debt-to-income ratio is high. Consider closing or prepaying existing loans to significantly increase your eligible loan amounts across all products.'
    )
  } else if (currentFoir > 40) {
    tips.push(
      'Reducing your existing EMI obligations by even 10-15% can unlock significantly higher eligible amounts, especially for Home Loans and LAP.'
    )
  }

  // Credit score tips
  if (creditScore === null) {
    tips.push(
      'We could not find your credit score. Complete your PAN verification and ensure you have at least one active credit line (credit card or small loan) to build a credit history.'
    )
  } else if (creditScore < 650) {
    tips.push(
      'Improving your credit score above 700 will unlock more loan products and better interest rates. Pay all EMIs and credit card bills on time for 6 months to see improvement.'
    )
  } else if (creditScore < 750) {
    tips.push(
      'Your credit score is good but improving it above 750 can get you the best interest rates. Maintain low credit card utilization (below 30%) and avoid multiple loan applications.'
    )
  }

  // Income tips
  if (monthlyIncome > 0 && monthlyIncome < 25000) {
    tips.push(
      'Adding a co-applicant with income can significantly increase your eligible loan amounts, especially for Home Loans and Car Loans.'
    )
  }

  // General tips
  if (totalExistingEmis > 0 && currentFoir > 30) {
    tips.push(
      'Consider consolidating multiple small loans into a single personal loan at a lower interest rate to reduce your overall EMI burden and improve FOIR.'
    )
  }

  if (tips.length === 0) {
    tips.push(
      'Your financial profile looks strong! You are eligible for most loan products. Apply now to lock in the best rates before they change.'
    )
  }

  return tips
}

// ─── Main API Handler ───────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    const supabaseAdmin = createSupabaseAdmin()

    // ─── Fetch all data in parallel ──────────────────────────────────────

    const [profileResult, creditScoreResult, leadsResult, loansResult] = await Promise.allSettled([
      // 1. Customer profile (income, employment)
      supabaseAdmin
        .from('customer_profiles')
        .select('id, customer_id, customer_type, employment_type, monthly_income, annual_income, total_existing_emis, profile_completed, mobile_number')
        .eq('customer_id', user.id)
        .maybeSingle(),

      // 2. Latest credit score
      supabaseAdmin
        .from('credit_bureau_fetch_log')
        .select('credit_score, bureau_name, created_at')
        .eq('customer_id', user.id)
        .eq('fetch_status', 'SUCCESS')
        .order('created_at', { ascending: false })
        .limit(1),

      // 3. Active leads (to check existing EMI from applications)
      (async () => {
        const { data: profile } = await supabaseAdmin
          .from('customer_profiles')
          .select('mobile_number')
          .eq('customer_id', user.id)
          .maybeSingle()

        const userMobile = profile?.mobile_number || null

        let query = supabaseAdmin
          .from('leads')
          .select('id, loan_type, required_loan_amount, emi_amount, lead_status')
          .order('created_at', { ascending: false })

        if (userMobile) {
          query = query.or(`customer_user_id.eq.${user.id},customer_mobile.eq.${userMobile}`)
        } else {
          query = query.eq('customer_user_id', user.id)
        }

        return query
      })(),

      // 4. Active loan accounts (for EMI obligations)
      supabaseAdmin
        .from('loan_applications')
        .select('id, emi_amount, status')
        .eq('customer_id', user.id)
        .in('status', ['ACTIVE', 'DISBURSED', 'RUNNING']),
    ])

    // ─── Extract data ───────────────────────────────────────────────────

    const profile =
      profileResult.status === 'fulfilled' ? profileResult.value?.data : null

    const creditScoreData =
      creditScoreResult.status === 'fulfilled'
        ? creditScoreResult.value?.data?.[0] || null
        : null

    const leads =
      leadsResult.status === 'fulfilled' ? leadsResult.value?.data || [] : []

    const activeLoans =
      loansResult.status === 'fulfilled' ? loansResult.value?.data || [] : []

    // ─── Compute financial metrics ──────────────────────────────────────

    // Monthly income: from profile, fallback to annual / 12
    let monthlyIncome = 0
    if (profile?.monthly_income && profile.monthly_income > 0) {
      monthlyIncome = profile.monthly_income
    } else if (profile?.annual_income && profile.annual_income > 0) {
      monthlyIncome = Math.round(profile.annual_income / 12)
    }

    // Credit score
    const creditScore: number | null = creditScoreData?.credit_score ?? null

    // Existing EMI obligations
    let totalExistingEmis = 0

    // From profile (self-declared)
    if (profile?.total_existing_emis && profile.total_existing_emis > 0) {
      totalExistingEmis = profile.total_existing_emis
    }

    // From active loan accounts (system-tracked)
    const systemEmis = activeLoans.reduce(
      (sum: number, loan: { emi_amount?: number }) => sum + (loan.emi_amount || 0),
      0
    )

    // Use the higher of self-declared or system-tracked
    totalExistingEmis = Math.max(totalExistingEmis, systemEmis)

    // FOIR calculation: (Total EMI / Gross Monthly Income) * 100
    const currentFoir = monthlyIncome > 0 ? (totalExistingEmis / monthlyIncome) * 100 : 0

    // ─── Compute per-product eligibility ────────────────────────────────

    const productResults = LOAN_PRODUCTS.map((product) => {
      // Available EMI capacity for this product
      const availableEmiForProduct =
        monthlyIncome > 0
          ? Math.max(0, monthlyIncome * product.maxFoir - totalExistingEmis)
          : 0

      // Max eligible amount via PV of annuity
      let maxEligibleAmount = 0
      if (product.maxTenureMonths > 0 && availableEmiForProduct > 0) {
        // Use the average rate for estimation
        const avgRate = (product.minRate + product.maxRate) / 2
        maxEligibleAmount = calculateMaxLoanAmount(
          availableEmiForProduct,
          avgRate,
          product.maxTenureMonths
        )
      } else if (product.id === 'credit-card') {
        // Credit card: limit based on income multiplier
        maxEligibleAmount = monthlyIncome > 0 ? Math.min(monthlyIncome * 3, product.maxAmount) : 0
      }

      // Cap at product max
      maxEligibleAmount = Math.min(maxEligibleAmount, product.maxAmount)

      // Determine eligibility status
      let eligibility: 'eligible' | 'partially_eligible' | 'not_eligible' = 'not_eligible'
      let reason: string | undefined
      let confidence: 'high' | 'medium' | 'low' = 'low'

      // Check income
      if (monthlyIncome <= 0) {
        eligibility = 'not_eligible'
        reason = 'Income information not available. Please complete your profile.'
        return {
          id: product.id,
          name: product.name,
          eligibility,
          maxEligibleAmount: 0,
          interestRateRange: product.interestRateDisplay,
          maxTenure: product.maxTenureDisplay,
          confidence,
          foirLimit: product.maxFoir * 100,
          reason,
        }
      }

      // Check credit score requirement
      const creditScoreMet =
        product.minCreditScore === 0 ||
        creditScore === null ||
        creditScore >= product.minCreditScore

      const creditScorePartial =
        creditScore !== null &&
        product.minCreditScore > 0 &&
        creditScore >= product.minCreditScore - 50 &&
        creditScore < product.minCreditScore

      // Check FOIR
      const foirDecimal = currentFoir / 100
      const foirMet = foirDecimal < product.maxFoir
      const foirPartial = foirDecimal >= product.maxFoir && foirDecimal < product.maxFoir + 0.10

      // Check minimum amount
      const amountMet = maxEligibleAmount >= product.minAmount

      // Determine status
      if (creditScoreMet && foirMet && amountMet) {
        eligibility = 'eligible'
        confidence = creditScore !== null ? 'high' : 'medium'
      } else if (
        (creditScoreMet || creditScorePartial) &&
        (foirMet || foirPartial)
      ) {
        eligibility = 'partially_eligible'
        confidence = 'medium'

        const reasons: string[] = []
        if (creditScorePartial) {
          reasons.push(`Credit score slightly below ${product.minCreditScore} requirement`)
        }
        if (foirPartial) {
          reasons.push('FOIR slightly above recommended limit')
        }
        if (!amountMet && maxEligibleAmount > 0) {
          reasons.push(`Eligible amount below minimum of ₹${(product.minAmount / 100000).toFixed(1)}L`)
        }
        reason = reasons.join('. ')
      } else {
        eligibility = 'not_eligible'
        confidence = 'low'

        const reasons: string[] = []
        if (!creditScoreMet && !creditScorePartial && creditScore !== null) {
          reasons.push(`Requires credit score of ${product.minCreditScore}+`)
        }
        if (!foirMet && !foirPartial) {
          reasons.push(`FOIR exceeds ${(product.maxFoir * 100).toFixed(0)}% limit`)
        }
        if (maxEligibleAmount < product.minAmount) {
          reasons.push('Insufficient EMI capacity for minimum loan amount')
        }
        reason = reasons.join('. ') || 'Does not meet eligibility criteria.'
      }

      return {
        id: product.id,
        name: product.name,
        eligibility,
        maxEligibleAmount: eligibility !== 'not_eligible' ? maxEligibleAmount : 0,
        interestRateRange: product.interestRateDisplay,
        maxTenure: product.maxTenureDisplay,
        confidence,
        foirLimit: product.maxFoir * 100,
        reason,
      }
    })

    // ─── Compute overall score ──────────────────────────────────────────

    const overallScore = computeOverallScore(
      monthlyIncome,
      creditScore,
      currentFoir,
      profile?.profile_completed === true
    )

    // Available EMI capacity (using standard 50% FOIR)
    const availableEmiCapacity = Math.max(0, monthlyIncome * 0.5 - totalExistingEmis)

    // Generate tips
    const tips = generateTips(monthlyIncome, creditScore, currentFoir, totalExistingEmis)

    // ─── Return response ────────────────────────────────────────────────

    return NextResponse.json({
      success: true,
      data: {
        overallScore,
        monthlyIncome,
        creditScore,
        currentFoir: Math.round(currentFoir * 10) / 10,
        availableEmiCapacity: Math.round(availableEmiCapacity),
        totalExistingEmis,
        products: productResults,
        tips,
        lastUpdated: new Date().toISOString(),
      },
      meta: {
        productsCount: LOAN_PRODUCTS.length,
        eligibleCount: productResults.filter((p) => p.eligibility === 'eligible').length,
        partialCount: productResults.filter((p) => p.eligibility === 'partially_eligible').length,
      },
    })
  } catch (error) {
    apiLogger.error('Eligibility Score API error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    )
  }
}
