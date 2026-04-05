export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const CompareSchema = z.object({
  loan_type: z.string().min(1).max(100),
  principal_amount: z.number().positive().max(500000000), // Max 50 Cr
  tenure_months: z.number().int().positive().max(480), // Max 40 years
  credit_score_range: z.enum(['excellent', 'good', 'fair', 'below', '750_above', '700_749', '650_699']).optional().default('good'),
})

/**
 * POST /api/bank-products/compare
 * Compare EMI across multiple banks for a given loan configuration
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate with Zod
    const body = await request.json()
    const parseResult = CompareSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json({
        error: 'Invalid input',
        details: parseResult.error.flatten().fieldErrors
      }, { status: 400 })
    }

    const { loan_type, principal_amount, tenure_months, credit_score_range } = parseResult.data

    // Fetch active bank products for this loan type with specific columns
    const { data: products, error: fetchError } = await supabase
      .from('bank_product_rules')
      .select('bank_name, bank_code, rate_excellent, rate_good, rate_fair, rate_below_average, min_amount, max_amount, min_tenure_months, max_tenure_months, processing_fee_percent, processing_fee_min, processing_fee_max, min_credit_score, max_foir, min_income_monthly, avg_turnaround_days, approval_rate')
      .eq('loan_type', loan_type)
      .eq('is_active', true)
      .order('rate_excellent', { ascending: true })
      .limit(50)

    if (fetchError) {
      console.error('Error fetching bank products:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch bank products' }, { status: 500 })
    }

    // Calculate EMI for each bank
    const comparisons = (products || [])
      .filter(product => {
        return principal_amount >= (product.min_amount ?? 0) &&
               principal_amount <= (product.max_amount ?? Infinity) &&
               tenure_months >= (product.min_tenure_months ?? 0) &&
               tenure_months <= (product.max_tenure_months ?? Infinity)
      })
      .map(product => {
        // Determine rate based on credit score
        let rate: number | null = null
        if (credit_score_range === 'excellent' || credit_score_range === '750_above') {
          rate = product.rate_excellent
        } else if (credit_score_range === 'good' || credit_score_range === '700_749') {
          rate = product.rate_good
        } else if (credit_score_range === 'fair' || credit_score_range === '650_699') {
          rate = product.rate_fair
        } else {
          rate = product.rate_below_average ?? product.rate_fair
        }

        // Fallback chain for null rates
        if (rate == null) rate = product.rate_good
        if (rate == null) rate = product.rate_excellent
        if (rate == null) rate = product.rate_fair
        if (rate == null) return null // Skip this bank entirely

        // Calculate EMI
        const monthlyRate = rate / 100 / 12
        let emi: number
        if (rate === 0 || monthlyRate === 0) {
          emi = principal_amount / tenure_months
        } else {
          emi = (principal_amount * monthlyRate * Math.pow(1 + monthlyRate, tenure_months)) /
                (Math.pow(1 + monthlyRate, tenure_months) - 1)
        }

        if (!isFinite(emi) || isNaN(emi)) return null

        const totalAmount = emi * tenure_months
        const totalInterest = totalAmount - principal_amount

        // Calculate processing fee with null safety
        const feePercent = product.processing_fee_percent ?? 0
        let processingFee = (principal_amount * feePercent) / 100
        if (product.processing_fee_min != null && processingFee < product.processing_fee_min) {
          processingFee = product.processing_fee_min
        }
        if (product.processing_fee_max != null && processingFee > product.processing_fee_max) {
          processingFee = product.processing_fee_max
        }

        const totalCost = totalAmount + processingFee

        return {
          bank_name: product.bank_name,
          bank_code: product.bank_code,
          interest_rate: rate,
          monthly_emi: Math.round(emi),
          total_interest: Math.round(totalInterest),
          total_amount: Math.round(totalAmount),
          processing_fee: Math.round(processingFee),
          total_cost: Math.round(totalCost),
          min_credit_score: product.min_credit_score ?? 0,
          max_foir: product.max_foir ?? null,
          min_income_monthly: product.min_income_monthly ?? null,
          avg_turnaround_days: product.avg_turnaround_days ?? null,
          approval_rate: product.approval_rate ?? null,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.total_cost - b.total_cost)

    // Calculate savings
    const cheapest = comparisons[0]
    const mostExpensive = comparisons[comparisons.length - 1]
    const maxSavings = cheapest && mostExpensive ? mostExpensive.total_cost - cheapest.total_cost : 0

    return NextResponse.json({
      success: true,
      comparisons,
      summary: {
        banks_compared: comparisons.length,
        cheapest_bank: cheapest?.bank_name || null,
        cheapest_emi: cheapest?.monthly_emi || 0,
        max_savings: Math.round(maxSavings),
        loan_type,
        principal_amount,
        tenure_months,
        credit_score_range,
      }
    })
  } catch (error) {
    console.error('Error in bank comparison:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/bank-products/compare
 * Get all available banks for a loan type (for UI dropdown)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const loanType = searchParams.get('loan_type')

    let query = supabase
      .from('bank_product_rules')
      .select('bank_name, bank_code, loan_type, rate_excellent, rate_good, min_amount, max_amount, min_tenure_months, max_tenure_months, processing_fee_percent, approval_rate, avg_turnaround_days')
      .eq('is_active', true)
      .order('bank_name')
      .limit(100)

    if (loanType) {
      query = query.eq('loan_type', loanType)
    }

    const { data: products, error } = await query

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
    }

    return NextResponse.json({ success: true, products: products || [] })
  } catch (error) {
    console.error('Error fetching bank products:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
