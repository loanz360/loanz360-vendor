import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { z } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { calculateEMI, formatIndianCurrency } from '@/lib/utils/emi-calculations'


const checkSchema = z.object({
  monthlyIncome: z.number().min(1000, 'Minimum income is ₹1,000'),
  loanAmount: z.number().min(10000, 'Minimum loan amount is ₹10,000'),
  employmentType: z.enum(['salaried', 'self_employed', 'business']),
  loanType: z.string().min(1),
  cibilScore: z.number().min(300).max(900).optional(),
})

// Normalize loan type from display format to DB format
function normalizeLoanType(input: string): string {
  // Already normalized
  if (!input.includes(' ')) return input
  // "Personal Loan" → "Personal Loan" (DB stores display format)
  return input
}

/**
 * POST /api/cro/eligibility-check
 * Check loan eligibility against product matrix
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Role verification - check database for consistency
    const { data: userData } = await supabase
      .from('users')
      .select('role, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    const userRole = (userData?.sub_role || userData?.role || '').toUpperCase()
    const allowedRoles = ['CRO', 'CUSTOMER RELATIONSHIP OFFICER', 'CRO_TEAM_LEADER', 'CRO_STATE_MANAGER', 'SUPER_ADMIN', 'ADMIN']
    if (!allowedRoles.some(r => userRole === r)) {
      return NextResponse.json({ success: false, error: 'Forbidden: CRO access required' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = checkSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      }, { status: 400 })
    }

    const { monthlyIncome, loanAmount, employmentType, loanType, cibilScore } = parsed.data
    const normalizedType = normalizeLoanType(loanType)

    // Fetch matching loan products using ilike for flexible matching
    const { data: products, error: fetchError } = await supabase
      .from('loan_products')
      .select('*')
      .ilike('loan_type', normalizedType)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (fetchError) {
      apiLogger.error('Failed to fetch loan products:', fetchError)
      return NextResponse.json({ success: false, error: 'Failed to query products' }, { status: 500 })
    }

    if (!products || products.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          eligible: false,
          results: [],
          matchCount: 0,
          totalProducts: 0,
          message: 'No loan products found for this type. Try a different loan category.',
        },
      })
    }

    // Calculate eligibility for each product
    const results = products.map(product => {
      let eligibilityScore = 0
      const reasons: string[] = []
      const warnings: string[] = []

      // Income check
      const minIncome = Number(product.min_income) || 15000
      if (monthlyIncome >= minIncome) {
        eligibilityScore += 25
      } else {
        reasons.push(`Minimum income ${formatIndianCurrency(minIncome)} required`)
      }

      // Amount range check
      const minAmount = Number(product.min_amount) || 50000
      const maxAmount = Number(product.max_amount) || 10000000
      if (loanAmount >= minAmount && loanAmount <= maxAmount) {
        eligibilityScore += 25
      } else if (loanAmount < minAmount) {
        reasons.push(`Minimum loan amount is ${formatIndianCurrency(minAmount)}`)
      } else {
        reasons.push(`Maximum loan amount is ${formatIndianCurrency(maxAmount)}`)
      }

      // CIBIL check
      const minCibil = Number(product.min_cibil) || 650
      if (cibilScore) {
        if (cibilScore >= minCibil) {
          eligibilityScore += 25
          if (cibilScore >= 750) eligibilityScore += 10
        } else {
          reasons.push(`Minimum CIBIL score ${minCibil} required (yours: ${cibilScore})`)
        }
      } else {
        warnings.push('CIBIL score not provided — actual eligibility may vary')
        eligibilityScore += 15
      }

      // Employment type check
      const allowedTypes: string[] = Array.isArray(product.employment_types)
        ? product.employment_types
        : ['salaried', 'self_employed', 'business']
      if (allowedTypes.includes(employmentType)) {
        eligibilityScore += 15
      } else {
        const formattedType = employmentType.replace(/_/g, ' ')
        reasons.push(`"${formattedType}" not eligible for this product`)
      }

      // Calculate max eligible amount based on income multiplier
      const multiplier = employmentType === 'salaried' ? 60 : 48
      const maxEligibleAmount = monthlyIncome * multiplier
      const suggestedAmount = Math.min(loanAmount, maxEligibleAmount, maxAmount)

      // Use shared calculateEMI function (eliminates duplication)
      const interestRate = Number(product.min_interest_rate) || 12
      const tenure = Number(product.max_tenure) || 60
      const emi = calculateEMI(suggestedAmount, interestRate, tenure)
      const emiToIncomeRatio = monthlyIncome > 0 ? (emi / monthlyIncome) * 100 : 0

      if (emiToIncomeRatio > 50) {
        warnings.push('EMI exceeds 50% of monthly income — may affect approval')
      } else if (emiToIncomeRatio > 40) {
        warnings.push('EMI is above 40% of income — consider a lower amount or longer tenure')
      }

      return {
        productId: product.id,
        productName: product.name || product.loan_type,
        bankName: product.bank_name || 'Multiple Banks',
        interestRate: `${Number(product.min_interest_rate) || interestRate}% - ${Number(product.max_interest_rate) || (interestRate + 2)}%`,
        processingFee: product.processing_fee || '1-2%',
        maxAmount,
        maxTenure: `${tenure} months`,
        eligibilityScore: Math.min(eligibilityScore, 100),
        isEligible: eligibilityScore >= 65,
        suggestedAmount,
        estimatedEMI: Math.round(emi),
        emiToIncomeRatio: emiToIncomeRatio.toFixed(1),
        reasons,
        warnings,
      }
    })

    // Sort by eligibility score
    results.sort((a, b) => b.eligibilityScore - a.eligibilityScore)

    return NextResponse.json({
      success: true,
      data: {
        eligible: results.some(r => r.isEligible),
        results,
        matchCount: results.filter(r => r.isEligible).length,
        totalProducts: results.length,
      },
    })
  } catch (error) {
    apiLogger.error('Eligibility check error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
