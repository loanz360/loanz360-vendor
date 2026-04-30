
// =====================================================
// EMPLOYEE TAX OPTIMIZER API
// POST: Compare Old vs New tax regime with optimization tips
// Secured with Supabase auth + rate limiting
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { z } from 'zod'
import {
  calculateOldRegimeTax,
  calculateNewRegimeTax,
  compareTaxRegimes,
  calculateHRAExemption,
  calculateMonthlyTDS,
  getFinancialYear,
  formatINR,
  type TaxDeductions,
} from '@/lib/utils/tax-optimizer'

// ---------------------
// Validation Schema
// ---------------------

const taxOptimizerSchema = z.object({
  annual_income: z
    .number()
    .min(0, 'Annual income must be non-negative')
    .max(1000000000, 'Annual income exceeds maximum limit'),
  deductions: z.object({
    section_80c: z.number().min(0).max(150000, 'Section 80C limit is 1,50,000').default(0),
    section_80d: z.number().min(0).max(100000, 'Section 80D limit is 1,00,000').default(0),
    section_80e: z.number().min(0).default(0),
    section_80g: z.number().min(0).default(0),
    section_80tta: z.number().min(0).max(10000, 'Section 80TTA limit is 10,000').default(0),
    hra_exemption: z.number().min(0).default(0),
    nps_80ccd1b: z.number().min(0).max(50000, 'NPS 80CCD(1B) limit is 50,000').default(0),
    standard_deduction: z.number().min(0).max(50000).default(50000),
    other_exemptions: z.number().min(0).default(0),
  }).optional(),
  // Optional HRA calculation inputs (if user wants auto-calculation)
  hra_details: z.object({
    basic_salary: z.number().min(0),
    hra_received: z.number().min(0),
    rent_paid: z.number().min(0),
    is_metro: z.boolean(),
  }).optional(),
  // Optional: TDS already paid this FY for monthly projection
  tds_paid_so_far: z.number().min(0).default(0),
  remaining_months: z.number().min(0).max(12).default(0),
})

// ---------------------
// POST Handler
// ---------------------

export async function POST(request: NextRequest) {
  try {
    // Rate limit: use standard calculation limits
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    // Auth check
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const parsed = taxOptimizerSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.errors[0]
      return NextResponse.json(
        {
          success: false,
          error: firstError?.message || 'Validation failed',
          code: 'VALIDATION_ERROR',
          meta: { details: parsed.error.errors },
        },
        { status: 400 }
      )
    }

    const {
      annual_income,
      deductions: rawDeductions,
      hra_details,
      tds_paid_so_far,
      remaining_months,
    } = parsed.data

    // Build deductions object with defaults
    const deductions: TaxDeductions = {
      section_80c: rawDeductions?.section_80c ?? 0,
      section_80d: rawDeductions?.section_80d ?? 0,
      section_80e: rawDeductions?.section_80e ?? 0,
      section_80g: rawDeductions?.section_80g ?? 0,
      section_80tta: rawDeductions?.section_80tta ?? 0,
      hra_exemption: rawDeductions?.hra_exemption ?? 0,
      nps_80ccd1b: rawDeductions?.nps_80ccd1b ?? 0,
      standard_deduction: rawDeductions?.standard_deduction ?? 50000,
      other_exemptions: rawDeductions?.other_exemptions ?? 0,
    }

    // Auto-calculate HRA if details provided and hra_exemption not manually set
    if (hra_details && deductions.hra_exemption === 0) {
      const annualBasic = hra_details.basic_salary * 12
      const annualHRA = hra_details.hra_received * 12
      const annualRent = hra_details.rent_paid * 12
      deductions.hra_exemption = calculateHRAExemption(
        annualBasic,
        annualHRA,
        annualRent,
        hra_details.is_metro
      )
    }

    // Perform tax comparison
    const comparison = compareTaxRegimes(annual_income, deductions)

    // Calculate monthly TDS projection if requested
    let monthlyTDS = null
    if (remaining_months > 0) {
      const recommendedTax =
        comparison.recommended_regime === 'old'
          ? comparison.old_regime.total_tax
          : comparison.new_regime.total_tax
      monthlyTDS = {
        recommended_regime_monthly_tds: calculateMonthlyTDS(
          recommendedTax,
          tds_paid_so_far,
          remaining_months
        ),
        old_regime_monthly_tds: calculateMonthlyTDS(
          comparison.old_regime.total_tax,
          tds_paid_so_far,
          remaining_months
        ),
        new_regime_monthly_tds: calculateMonthlyTDS(
          comparison.new_regime.total_tax,
          tds_paid_so_far,
          remaining_months
        ),
        tds_paid_so_far,
        remaining_months,
      }
    }

    // Build formatted summary for display
    const summary = {
      financial_year: getFinancialYear(),
      annual_income: formatINR(annual_income),
      recommended_regime: comparison.recommended_regime,
      old_regime_tax: formatINR(comparison.old_regime.total_tax),
      new_regime_tax: formatINR(comparison.new_regime.total_tax),
      savings: formatINR(comparison.savings_amount),
      recommendation_text:
        comparison.savings_amount === 0
          ? 'Both regimes result in the same tax liability.'
          : `${comparison.recommended_regime === 'old' ? 'Old' : 'New'} regime saves you ${formatINR(comparison.savings_amount)} (${comparison.savings_percentage}% lower tax).`,
    }

    return NextResponse.json({
      success: true,
      data: {
        comparison,
        monthly_tds: monthlyTDS,
        summary,
        deductions_used: deductions,
        hra_auto_calculated: !!(hra_details && (rawDeductions?.hra_exemption ?? 0) === 0),
      },
      message: `Tax optimization complete. ${summary.recommendation_text}`,
    })
  } catch (error) {
    apiLogger.error('Tax Optimizer POST Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
