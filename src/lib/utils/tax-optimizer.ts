// =====================================================
// TAX REGIME OPTIMIZER - Indian Income Tax Calculator
// FY 2024-25 (AY 2025-26) Tax Slabs & Rules
// Supports Old Regime (with deductions) & New Regime
// =====================================================

// ---------------------
// Interfaces
// ---------------------

export interface TaxDeductions {
  /** Section 80C: PPF, ELSS, LIC, etc. (max 1,50,000) */
  section_80c: number
  /** Section 80D: Medical Insurance (25K self, 50K senior citizen parent) */
  section_80d: number
  /** Section 80E: Education Loan Interest (no limit) */
  section_80e: number
  /** Section 80G: Donations */
  section_80g: number
  /** Section 80TTA: Savings Account Interest (max 10,000) */
  section_80tta: number
  /** HRA Exemption (calculated separately or provided directly) */
  hra_exemption: number
  /** NPS 80CCD(1B): Additional NPS deduction (max 50,000) */
  nps_80ccd1b: number
  /** Standard Deduction: 50,000 for old regime salaried */
  standard_deduction: number
  /** Other exemptions: LTA, home loan principal in 80C, etc. */
  other_exemptions: number
}

export interface HRAInput {
  basic_salary: number
  hra_received: number
  rent_paid: number
  is_metro: boolean
}

export interface TaxSlabBreakdown {
  slab: string
  rate: number
  taxable_amount: number
  tax: number
}

export interface TaxCalculationResult {
  gross_income: number
  total_deductions: number
  taxable_income: number
  slab_breakdown: TaxSlabBreakdown[]
  tax_before_cess: number
  surcharge: number
  cess: number
  total_tax: number
  effective_tax_rate: number
  regime: 'old' | 'new'
}

export interface TaxComparisonResult {
  old_regime: TaxCalculationResult
  new_regime: TaxCalculationResult
  recommended_regime: 'old' | 'new'
  savings_amount: number
  savings_percentage: number
  optimization_suggestions: OptimizationSuggestion[]
}

export interface OptimizationSuggestion {
  category: string
  section: string
  current_amount: number
  max_limit: number
  additional_investment: number
  potential_tax_saving: number
  description: string
}

// ---------------------
// Constants
// ---------------------

const OLD_REGIME_SLABS = [
  { min: 0, max: 250000, rate: 0 },
  { min: 250000, max: 500000, rate: 0.05 },
  { min: 500000, max: 1000000, rate: 0.20 },
  { min: 1000000, max: Infinity, rate: 0.30 },
] as const

const NEW_REGIME_SLABS = [
  { min: 0, max: 300000, rate: 0 },
  { min: 300000, max: 700000, rate: 0.05 },
  { min: 700000, max: 1000000, rate: 0.10 },
  { min: 1000000, max: 1200000, rate: 0.15 },
  { min: 1200000, max: 1500000, rate: 0.20 },
  { min: 1500000, max: Infinity, rate: 0.30 },
] as const

const SECTION_LIMITS = {
  section_80c: 150000,
  section_80d_self: 25000,
  section_80d_senior: 50000,
  section_80d_total: 100000,
  section_80tta: 10000,
  nps_80ccd1b: 50000,
  standard_deduction_old: 50000,
  standard_deduction_new: 75000,
} as const

const CESS_RATE = 0.04

// Surcharge slabs for Old Regime
const SURCHARGE_SLABS_OLD = [
  { min: 0, max: 5000000, rate: 0 },
  { min: 5000000, max: 10000000, rate: 0.10 },
  { min: 10000000, max: 20000000, rate: 0.15 },
  { min: 20000000, max: 50000000, rate: 0.25 },
  { min: 50000000, max: Infinity, rate: 0.37 },
] as const

// Surcharge slabs for New Regime (capped at 25%)
const SURCHARGE_SLABS_NEW = [
  { min: 0, max: 5000000, rate: 0 },
  { min: 5000000, max: 10000000, rate: 0.10 },
  { min: 10000000, max: 20000000, rate: 0.15 },
  { min: 20000000, max: Infinity, rate: 0.25 },
] as const

// ---------------------
// Tax Calculation Core
// ---------------------

/**
 * Calculate tax using given slabs for taxable income
 */
function calculateSlabTax(
  taxableIncome: number,
  slabs: readonly { min: number; max: number; rate: number }[]
): { breakdown: TaxSlabBreakdown[]; totalTax: number } {
  const breakdown: TaxSlabBreakdown[] = []
  let totalTax = 0

  for (const slab of slabs) {
    if (taxableIncome <= slab.min) break

    const taxableInSlab = Math.min(taxableIncome, slab.max) - slab.min
    const taxForSlab = taxableInSlab * slab.rate

    const slabLabel =
      slab.max === Infinity
        ? `Above ${formatINR(slab.min)}`
        : `${formatINR(slab.min)} - ${formatINR(slab.max)}`

    breakdown.push({
      slab: slabLabel,
      rate: slab.rate * 100,
      taxable_amount: taxableInSlab,
      tax: Math.round(taxForSlab),
    })

    totalTax += taxForSlab
  }

  return { breakdown, totalTax: Math.round(totalTax) }
}

/**
 * Calculate surcharge based on taxable income and regime
 */
function calculateSurcharge(
  taxBeforeSurcharge: number,
  taxableIncome: number,
  regime: 'old' | 'new'
): number {
  const slabs = regime === 'old' ? SURCHARGE_SLABS_OLD : SURCHARGE_SLABS_NEW

  for (let i = slabs.length - 1; i >= 0; i--) {
    if (taxableIncome > slabs[i].min) {
      const surcharge = Math.round(taxBeforeSurcharge * slabs[i].rate)

      // Marginal relief: surcharge should not exceed the additional income
      // above the threshold that triggered it
      if (i > 0 && slabs[i].rate > 0) {
        const threshold = slabs[i].min
        const excessIncome = taxableIncome - threshold

        // Tax at previous slab threshold
        const regimeSlabs = regime === 'old' ? OLD_REGIME_SLABS : NEW_REGIME_SLABS
        const { totalTax: taxAtThreshold } = calculateSlabTax(threshold, regimeSlabs)
        const prevSurchargeRate = i > 1 ? slabs[i - 1].rate : 0
        const totalTaxAtThreshold =
          taxAtThreshold + Math.round(taxAtThreshold * prevSurchargeRate)

        const totalWithSurcharge = taxBeforeSurcharge + surcharge
        const marginalRelief = totalWithSurcharge - (totalTaxAtThreshold + excessIncome)

        if (marginalRelief > 0) {
          return Math.max(0, surcharge - marginalRelief)
        }
      }

      return surcharge
    }
  }

  return 0
}

/**
 * Cap deductions to their respective section limits
 */
function capDeductions(deductions: TaxDeductions): TaxDeductions {
  return {
    section_80c: Math.min(Math.max(0, deductions.section_80c), SECTION_LIMITS.section_80c),
    section_80d: Math.min(Math.max(0, deductions.section_80d), SECTION_LIMITS.section_80d_total),
    section_80e: Math.max(0, deductions.section_80e), // No upper limit
    section_80g: Math.max(0, deductions.section_80g),
    section_80tta: Math.min(Math.max(0, deductions.section_80tta), SECTION_LIMITS.section_80tta),
    hra_exemption: Math.max(0, deductions.hra_exemption),
    nps_80ccd1b: Math.min(Math.max(0, deductions.nps_80ccd1b), SECTION_LIMITS.nps_80ccd1b),
    standard_deduction: Math.min(
      Math.max(0, deductions.standard_deduction),
      SECTION_LIMITS.standard_deduction_old
    ),
    other_exemptions: Math.max(0, deductions.other_exemptions),
  }
}

// ---------------------
// Public API
// ---------------------

/**
 * Calculate tax under Old Regime with all applicable deductions
 * Old regime allows deductions under 80C, 80D, HRA, etc.
 */
export function calculateOldRegimeTax(
  annualIncome: number,
  deductions: TaxDeductions
): TaxCalculationResult {
  const cappedDeductions = capDeductions(deductions)

  const totalDeductions =
    cappedDeductions.section_80c +
    cappedDeductions.section_80d +
    cappedDeductions.section_80e +
    cappedDeductions.section_80g +
    cappedDeductions.section_80tta +
    cappedDeductions.hra_exemption +
    cappedDeductions.nps_80ccd1b +
    cappedDeductions.standard_deduction +
    cappedDeductions.other_exemptions

  const taxableIncome = Math.max(0, annualIncome - totalDeductions)

  const { breakdown, totalTax } = calculateSlabTax(taxableIncome, OLD_REGIME_SLABS)

  // Section 87A rebate: If taxable income <= 5L, rebate up to 12,500 (Old Regime)
  let taxAfterRebate = totalTax
  if (taxableIncome <= 500000) {
    taxAfterRebate = Math.max(0, totalTax - 12500)
  }

  const surcharge = calculateSurcharge(taxAfterRebate, taxableIncome, 'old')
  const taxPlusSurcharge = taxAfterRebate + surcharge
  const cess = Math.round(taxPlusSurcharge * CESS_RATE)
  const totalTaxPayable = taxPlusSurcharge + cess

  return {
    gross_income: annualIncome,
    total_deductions: totalDeductions,
    taxable_income: taxableIncome,
    slab_breakdown: breakdown,
    tax_before_cess: taxAfterRebate,
    surcharge,
    cess,
    total_tax: totalTaxPayable,
    effective_tax_rate:
      annualIncome > 0
        ? Math.round((totalTaxPayable / annualIncome) * 10000) / 100
        : 0,
    regime: 'old',
  }
}

/**
 * Calculate tax under New Regime (FY 2024-25)
 * New regime has lower slabs but no deductions except standard deduction of 75,000
 */
export function calculateNewRegimeTax(annualIncome: number): TaxCalculationResult {
  const standardDeduction = SECTION_LIMITS.standard_deduction_new
  const taxableIncome = Math.max(0, annualIncome - standardDeduction)

  const { breakdown, totalTax } = calculateSlabTax(taxableIncome, NEW_REGIME_SLABS)

  // Section 87A rebate under New Regime: If taxable income <= 7L, full rebate
  let taxAfterRebate = totalTax
  if (taxableIncome <= 700000) {
    taxAfterRebate = 0
  }

  const surcharge = calculateSurcharge(taxAfterRebate, taxableIncome, 'new')
  const taxPlusSurcharge = taxAfterRebate + surcharge
  const cess = Math.round(taxPlusSurcharge * CESS_RATE)
  const totalTaxPayable = taxPlusSurcharge + cess

  return {
    gross_income: annualIncome,
    total_deductions: standardDeduction,
    taxable_income: taxableIncome,
    slab_breakdown: breakdown,
    tax_before_cess: taxAfterRebate,
    surcharge,
    cess,
    total_tax: totalTaxPayable,
    effective_tax_rate:
      annualIncome > 0
        ? Math.round((totalTaxPayable / annualIncome) * 10000) / 100
        : 0,
    regime: 'new',
  }
}

/**
 * Compare both tax regimes and provide recommendation with optimization suggestions
 */
export function compareTaxRegimes(
  annualIncome: number,
  deductions: TaxDeductions
): TaxComparisonResult {
  const oldRegime = calculateOldRegimeTax(annualIncome, deductions)
  const newRegime = calculateNewRegimeTax(annualIncome)

  const savingsAmount = Math.abs(oldRegime.total_tax - newRegime.total_tax)
  const recommendedRegime = oldRegime.total_tax <= newRegime.total_tax ? 'old' : 'new'

  const higherTax = Math.max(oldRegime.total_tax, newRegime.total_tax)
  const savingsPercentage =
    higherTax > 0 ? Math.round((savingsAmount / higherTax) * 10000) / 100 : 0

  const suggestions = generateOptimizationSuggestions(annualIncome, deductions)

  return {
    old_regime: oldRegime,
    new_regime: newRegime,
    recommended_regime: recommendedRegime,
    savings_amount: savingsAmount,
    savings_percentage: savingsPercentage,
    optimization_suggestions: suggestions,
  }
}

// ---------------------
// HRA Exemption
// ---------------------

/**
 * Calculate HRA exemption as per Section 10(13A)
 * Minimum of:
 * 1. Actual HRA received
 * 2. Rent paid - 10% of basic salary
 * 3. 50% of basic (metro) or 40% of basic (non-metro)
 */
export function calculateHRAExemption(
  basic: number,
  hraReceived: number,
  rentPaid: number,
  isMetro: boolean
): number {
  if (rentPaid <= 0 || hraReceived <= 0 || basic <= 0) return 0

  const annualBasic = basic
  const annualHRA = hraReceived
  const annualRent = rentPaid

  const rule1 = annualHRA
  const rule2 = Math.max(0, annualRent - 0.10 * annualBasic)
  const rule3 = isMetro ? 0.50 * annualBasic : 0.40 * annualBasic

  return Math.round(Math.min(rule1, rule2, rule3))
}

/**
 * HRA exemption from monthly inputs (convenience wrapper)
 */
export function calculateHRAExemptionMonthly(input: HRAInput): number {
  const annualBasic = input.basic_salary * 12
  const annualHRA = input.hra_received * 12
  const annualRent = input.rent_paid * 12

  return calculateHRAExemption(annualBasic, annualHRA, annualRent, input.is_metro)
}

// ---------------------
// Optimization Suggestions
// ---------------------

function generateOptimizationSuggestions(
  annualIncome: number,
  deductions: TaxDeductions
): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = []
  const cappedDeductions = capDeductions(deductions)

  // Determine marginal tax rate for savings calculation
  const taxableAfterDeductions =
    annualIncome -
    (cappedDeductions.section_80c +
      cappedDeductions.section_80d +
      cappedDeductions.section_80e +
      cappedDeductions.section_80g +
      cappedDeductions.section_80tta +
      cappedDeductions.hra_exemption +
      cappedDeductions.nps_80ccd1b +
      cappedDeductions.standard_deduction +
      cappedDeductions.other_exemptions)

  let marginalRate = 0
  if (taxableAfterDeductions > 1000000) marginalRate = 0.30
  else if (taxableAfterDeductions > 500000) marginalRate = 0.20
  else if (taxableAfterDeductions > 250000) marginalRate = 0.05

  // Include cess in marginal rate
  const effectiveMarginalRate = marginalRate * (1 + CESS_RATE)

  // 80C suggestions
  if (cappedDeductions.section_80c < SECTION_LIMITS.section_80c) {
    const gap = SECTION_LIMITS.section_80c - cappedDeductions.section_80c
    const saving = Math.round(gap * effectiveMarginalRate)
    if (saving > 0) {
      suggestions.push({
        category: 'Investment',
        section: '80C',
        current_amount: cappedDeductions.section_80c,
        max_limit: SECTION_LIMITS.section_80c,
        additional_investment: gap,
        potential_tax_saving: saving,
        description: `Invest ${formatINR(gap)} more in 80C instruments (PPF, ELSS, NPS Tier-I, etc.) to save ${formatINR(saving)} in taxes`,
      })
    }
  }

  // 80D suggestions
  if (cappedDeductions.section_80d < SECTION_LIMITS.section_80d_self) {
    const gap = SECTION_LIMITS.section_80d_self - cappedDeductions.section_80d
    const saving = Math.round(gap * effectiveMarginalRate)
    if (saving > 0) {
      suggestions.push({
        category: 'Health Insurance',
        section: '80D',
        current_amount: cappedDeductions.section_80d,
        max_limit: SECTION_LIMITS.section_80d_self,
        additional_investment: gap,
        potential_tax_saving: saving,
        description: `Get health insurance worth ${formatINR(gap)} more to claim full 80D deduction and save ${formatINR(saving)}`,
      })
    }
  }

  // NPS 80CCD(1B) suggestions
  if (cappedDeductions.nps_80ccd1b < SECTION_LIMITS.nps_80ccd1b) {
    const gap = SECTION_LIMITS.nps_80ccd1b - cappedDeductions.nps_80ccd1b
    const saving = Math.round(gap * effectiveMarginalRate)
    if (saving > 0) {
      suggestions.push({
        category: 'Retirement',
        section: '80CCD(1B)',
        current_amount: cappedDeductions.nps_80ccd1b,
        max_limit: SECTION_LIMITS.nps_80ccd1b,
        additional_investment: gap,
        potential_tax_saving: saving,
        description: `Invest ${formatINR(gap)} in NPS (over and above 80C) to save additional ${formatINR(saving)} in taxes`,
      })
    }
  }

  // 80TTA suggestions
  if (cappedDeductions.section_80tta < SECTION_LIMITS.section_80tta) {
    const gap = SECTION_LIMITS.section_80tta - cappedDeductions.section_80tta
    const saving = Math.round(gap * effectiveMarginalRate)
    if (saving > 100) {
      suggestions.push({
        category: 'Savings Interest',
        section: '80TTA',
        current_amount: cappedDeductions.section_80tta,
        max_limit: SECTION_LIMITS.section_80tta,
        additional_investment: gap,
        potential_tax_saving: saving,
        description: `Claim savings bank interest deduction of ${formatINR(gap)} under 80TTA to save ${formatINR(saving)}`,
      })
    }
  }

  // HRA suggestion (only if not already claiming)
  if (cappedDeductions.hra_exemption === 0 && annualIncome > 500000) {
    suggestions.push({
      category: 'Housing',
      section: '10(13A) HRA',
      current_amount: 0,
      max_limit: 0, // Variable based on salary
      additional_investment: 0,
      potential_tax_saving: 0,
      description:
        'If you are paying rent, submit rent receipts to claim HRA exemption and reduce taxable income significantly',
    })
  }

  // Sort by potential savings descending
  suggestions.sort((a, b) => b.potential_tax_saving - a.potential_tax_saving)

  return suggestions
}

// ---------------------
// Helper Functions
// ---------------------

/**
 * Format amount in Indian Rupee notation with proper grouping
 * e.g., 1234567 -> "₹12,34,567"
 */
export function formatINR(amount: number): string {
  const isNegative = amount < 0
  const absAmount = Math.abs(Math.round(amount))

  if (absAmount === 0) return '₹0'

  const str = absAmount.toString()
  let result = ''

  if (str.length <= 3) {
    result = str
  } else {
    // Last 3 digits
    result = str.slice(-3)
    // Remaining digits in groups of 2 (Indian numbering system)
    let remaining = str.slice(0, -3)
    while (remaining.length > 2) {
      result = remaining.slice(-2) + ',' + result
      remaining = remaining.slice(0, -2)
    }
    if (remaining.length > 0) {
      result = remaining + ',' + result
    }
  }

  return `${isNegative ? '-' : ''}₹${result}`
}

/**
 * Get financial year string for a given date
 * e.g., Date in Jan 2026 -> "2025-26", Date in Apr 2025 -> "2025-26"
 * Financial year runs April 1 to March 31
 */
export function getFinancialYear(date?: Date): string {
  const d = date || new Date()
  const month = d.getMonth() // 0-indexed: 0=Jan, 3=Apr
  const year = d.getFullYear()

  // If month is Jan-Mar (0-2), FY started previous year
  const fyStart = month < 3 ? year - 1 : year
  const fyEnd = fyStart + 1

  return `${fyStart}-${fyEnd.toString().slice(-2)}`
}

/**
 * Create default (empty) TaxDeductions object
 */
export function createEmptyDeductions(): TaxDeductions {
  return {
    section_80c: 0,
    section_80d: 0,
    section_80e: 0,
    section_80g: 0,
    section_80tta: 0,
    hra_exemption: 0,
    nps_80ccd1b: 0,
    standard_deduction: 50000, // Default old regime standard deduction
    other_exemptions: 0,
  }
}

/**
 * Get section limits for reference
 */
export function getSectionLimits() {
  return { ...SECTION_LIMITS }
}

/**
 * Calculate monthly TDS based on annual tax liability
 * Distributes evenly across remaining months in the FY
 */
export function calculateMonthlyTDS(
  annualTax: number,
  tdsPaidSoFar: number,
  remainingMonths: number
): number {
  if (remainingMonths <= 0) return 0
  const remainingTax = Math.max(0, annualTax - tdsPaidSoFar)
  return Math.round(remainingTax / remainingMonths)
}
