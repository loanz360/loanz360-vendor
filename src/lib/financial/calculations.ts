/**
 * Financial Calculation Utilities for LOANZ360
 *
 * CRITICAL: All monetary calculations MUST use Decimal.js to avoid
 * floating-point precision errors. Never use native JavaScript number
 * operations for money calculations.
 *
 * Compliance: RBI Guidelines, PCI-DSS, SOX
 */

import Decimal from 'decimal.js'

// Configure Decimal.js for financial precision
Decimal.set({
  precision: 20, // 20 significant digits
  rounding: Decimal.ROUND_HALF_UP, // Banker's rounding
  toExpNeg: -7,
  toExpPos: 21,
  minE: -9e15,
  maxE: 9e15
})

/**
 * Currency configuration for Indian Rupee
 */
export const INR_CONFIG = {
  currency: 'INR',
  decimals: 2,
  symbol: '₹',
  locale: 'en-IN'
} as const

/**
 * RBI Interest Rate Caps (as of 2024)
 */
export const RBI_RATE_CAPS = {
  PERSONAL_LOAN: new Decimal(36), // 36% per annum max
  HOME_LOAN: new Decimal(15), // 15% per annum typical max
  BUSINESS_LOAN: new Decimal(24), // 24% per annum max
  GOLD_LOAN: new Decimal(29), // 29% per annum max
} as const

/**
 * GST Rate for financial services (India)
 */
export const GST_RATE = new Decimal(18) // 18%

/**
 * Loan calculation parameters
 */
export interface LoanParameters {
  principal: Decimal | number | string
  annualRate: Decimal | number | string // Annual percentage rate
  tenureMonths: number
  processingFeePercent?: Decimal | number | string
  prepaymentCharges?: Decimal | number | string
}

/**
 * Loan calculation results with all charges disclosed
 */
export interface LoanCalculationResult {
  // Input parameters
  principal: string
  annualRate: string
  tenureMonths: number

  // EMI calculations
  monthlyEMI: string
  totalRepayment: string
  totalInterest: string

  // Fees and charges
  processingFee: string
  gstOnProcessingFee: string
  totalProcessingFee: string

  // Effective rates (RBI mandated disclosure)
  effectiveAPR: string
  monthlyRate: string

  // Total cost
  totalCostToCustomer: string

  // Amortization schedule summary
  principalComponent: string
  interestComponent: string
}

/**
 * Calculate EMI using reducing balance method
 * Formula: EMI = P × r × (1 + r)^n / ((1 + r)^n - 1)
 *
 * Where:
 * P = Principal loan amount
 * r = Monthly interest rate (annual rate / 12 / 100)
 * n = Tenure in months
 *
 * @param params - Loan parameters
 * @returns Detailed loan calculation results
 */
export function calculateLoanEMI(params: LoanParameters): LoanCalculationResult {
  // Convert all inputs to Decimal for precision
  const principal = new Decimal(params.principal)
  const annualRate = new Decimal(params.annualRate)
  const tenureMonths = params.tenureMonths
  const processingFeePercent = params.processingFeePercent
    ? new Decimal(params.processingFeePercent)
    : new Decimal(0)

  // Validation
  if (principal.lessThanOrEqualTo(0)) {
    throw new Error('Principal amount must be greater than zero')
  }

  if (annualRate.lessThan(0)) {
    throw new Error('Interest rate cannot be negative')
  }

  if (annualRate.greaterThan(RBI_RATE_CAPS.PERSONAL_LOAN)) {
    throw new Error(`Interest rate ${annualRate}% exceeds RBI cap of ${RBI_RATE_CAPS.PERSONAL_LOAN}% per annum`)
  }

  if (tenureMonths <= 0 || !Number.isInteger(tenureMonths)) {
    throw new Error('Tenure must be a positive integer (months)')
  }

  // Calculate monthly interest rate (r)
  const monthlyRate = annualRate.div(100).div(12)

  // Calculate EMI using reducing balance formula
  let monthlyEMI: Decimal

  if (monthlyRate.equals(0)) {
    // If interest rate is 0%, EMI is simply principal / tenure
    monthlyEMI = principal.div(tenureMonths)
  } else {
    // EMI = P × r × (1 + r)^n / ((1 + r)^n - 1)
    const onePlusR = monthlyRate.plus(1)
    const onePlusRPowerN = onePlusR.pow(tenureMonths)

    const numerator = principal.mul(monthlyRate).mul(onePlusRPowerN)
    const denominator = onePlusRPowerN.minus(1)

    monthlyEMI = numerator.div(denominator)
  }

  // Round EMI to 2 decimal places (paise)
  monthlyEMI = monthlyEMI.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)

  // Calculate total repayment
  const totalRepayment = monthlyEMI.mul(tenureMonths)

  // Calculate total interest
  const totalInterest = totalRepayment.minus(principal)

  // Calculate processing fee
  const processingFee = principal.mul(processingFeePercent.div(100))
  const gstOnProcessingFee = processingFee.mul(GST_RATE.div(100))
  const totalProcessingFee = processingFee.plus(gstOnProcessingFee)

  // Calculate total cost to customer
  const totalCost = totalRepayment.plus(totalProcessingFee)

  // Calculate effective APR (includes all fees)
  // Effective APR = ((Total Cost - Principal) / Principal) × (12 / Tenure in years) × 100
  const tenureYears = tenureMonths / 12
  const effectiveAPR = totalCost.minus(principal)
    .div(principal)
    .mul(100)
    .div(tenureYears)

  return {
    // Inputs (formatted for display)
    principal: formatCurrency(principal),
    annualRate: annualRate.toFixed(2),
    tenureMonths,

    // EMI details
    monthlyEMI: formatCurrency(monthlyEMI),
    totalRepayment: formatCurrency(totalRepayment),
    totalInterest: formatCurrency(totalInterest),

    // Fees
    processingFee: formatCurrency(processingFee),
    gstOnProcessingFee: formatCurrency(gstOnProcessingFee),
    totalProcessingFee: formatCurrency(totalProcessingFee),

    // Rates
    effectiveAPR: effectiveAPR.toFixed(2),
    monthlyRate: monthlyRate.mul(100).toFixed(4),

    // Total cost
    totalCostToCustomer: formatCurrency(totalCost),

    // Components
    principalComponent: formatCurrency(principal),
    interestComponent: formatCurrency(totalInterest)
  }
}

/**
 * Calculate prepayment penalty
 *
 * @param outstandingPrincipal - Remaining principal amount
 * @param prepaymentPercent - Penalty percentage (typically 2-4%)
 * @returns Prepayment charge amount
 */
export function calculatePrepaymentCharge(
  outstandingPrincipal: Decimal | number | string,
  prepaymentPercent: Decimal | number | string
): Decimal {
  const principal = new Decimal(outstandingPrincipal)
  const percent = new Decimal(prepaymentPercent)

  if (principal.lessThanOrEqualTo(0)) {
    throw new Error('Outstanding principal must be greater than zero')
  }

  if (percent.lessThan(0) || percent.greaterThan(5)) {
    throw new Error('Prepayment charge must be between 0% and 5%')
  }

  return principal.mul(percent.div(100)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
}

/**
 * Generate amortization schedule
 * Shows month-wise breakup of principal and interest
 *
 * @param params - Loan parameters
 * @returns Array of monthly payment details
 */
export interface AmortizationEntry {
  month: number
  emi: string
  principalPaid: string
  interestPaid: string
  outstandingPrincipal: string
  cumulativePrincipal: string
  cumulativeInterest: string
}

export function generateAmortizationSchedule(
  params: LoanParameters
): AmortizationEntry[] {
  const principal = new Decimal(params.principal)
  const annualRate = new Decimal(params.annualRate)
  const tenureMonths = params.tenureMonths
  const monthlyRate = annualRate.div(100).div(12)

  // Calculate EMI
  const loanCalc = calculateLoanEMI(params)
  const emi = new Decimal(loanCalc.monthlyEMI.replace(/[₹,]/g, ''))

  const schedule: AmortizationEntry[] = []
  let outstandingPrincipal = principal
  let cumulativePrincipal = new Decimal(0)
  let cumulativeInterest = new Decimal(0)

  for (let month = 1; month <= tenureMonths; month++) {
    // Interest for this month = Outstanding Principal × Monthly Rate
    const interestPaid = outstandingPrincipal.mul(monthlyRate)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)

    // Principal for this month = EMI - Interest
    let principalPaid = emi.minus(interestPaid)

    // Last month adjustment (to account for rounding)
    if (month === tenureMonths) {
      principalPaid = outstandingPrincipal
    }

    // Update cumulative amounts
    cumulativePrincipal = cumulativePrincipal.plus(principalPaid)
    cumulativeInterest = cumulativeInterest.plus(interestPaid)

    // Update outstanding principal
    outstandingPrincipal = outstandingPrincipal.minus(principalPaid)

    // Ensure outstanding doesn't go negative due to rounding
    if (outstandingPrincipal.lessThan(0)) {
      outstandingPrincipal = new Decimal(0)
    }

    schedule.push({
      month,
      emi: formatCurrency(emi),
      principalPaid: formatCurrency(principalPaid),
      interestPaid: formatCurrency(interestPaid),
      outstandingPrincipal: formatCurrency(outstandingPrincipal),
      cumulativePrincipal: formatCurrency(cumulativePrincipal),
      cumulativeInterest: formatCurrency(cumulativeInterest)
    })
  }

  return schedule
}

/**
 * Format currency amount in Indian Rupee format
 * Example: 1234567.89 → ₹12,34,567.89
 *
 * @param amount - Decimal amount
 * @returns Formatted currency string
 */
export function formatCurrency(amount: Decimal | number | string): string {
  const decimal = new Decimal(amount)
  const rounded = decimal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)

  // Indian numbering system (lakhs and crores)
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

  return formatter.format(rounded.toNumber())
}

/**
 * Parse currency string to Decimal
 * Removes currency symbols and formatting
 *
 * @param currencyString - Formatted currency string
 * @returns Decimal value
 */
export function parseCurrency(currencyString: string): Decimal {
  // Remove currency symbols, commas, and whitespace
  const cleaned = currencyString.replace(/[₹,\s]/g, '')
  return new Decimal(cleaned)
}

/**
 * Compare two decimal amounts with tolerance
 * Useful for reconciliation checks
 *
 * @param amount1 - First amount
 * @param amount2 - Second amount
 * @param tolerance - Acceptable difference (default 0.01 = 1 paisa)
 * @returns true if amounts are equal within tolerance
 */
export function amountsEqual(
  amount1: Decimal | number | string,
  amount2: Decimal | number | string,
  tolerance: Decimal | number = 0.01
): boolean {
  const diff = new Decimal(amount1).minus(amount2).abs()
  return diff.lessThanOrEqualTo(tolerance)
}

/**
 * Calculate compound interest
 * A = P(1 + r/n)^(nt)
 *
 * @param principal - Initial amount
 * @param annualRate - Annual interest rate (percentage)
 * @param compoundingFrequency - Times per year (12 for monthly, 4 for quarterly, 1 for yearly)
 * @param years - Time period in years
 * @returns Final amount including compound interest
 */
export function calculateCompoundInterest(
  principal: Decimal | number | string,
  annualRate: Decimal | number | string,
  compoundingFrequency: number,
  years: number
): Decimal {
  const P = new Decimal(principal)
  const r = new Decimal(annualRate).div(100)
  const n = compoundingFrequency
  const t = years

  // A = P(1 + r/n)^(nt)
  const amount = P.mul(
    r.div(n).plus(1).pow(n * t)
  )

  return amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
}

/**
 * Validate loan parameters before processing
 * Ensures compliance with RBI guidelines
 *
 * @param params - Loan parameters
 * @returns Validation result
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export function validateLoanParameters(params: LoanParameters): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  try {
    const principal = new Decimal(params.principal)
    const annualRate = new Decimal(params.annualRate)

    // Principal validation
    if (principal.lessThanOrEqualTo(0)) {
      errors.push('Principal amount must be greater than zero')
    }

    if (principal.greaterThan(100000000)) { // 10 crore
      warnings.push('Principal amount exceeds ₹10 crore - additional approvals may be required')
    }

    // Interest rate validation
    if (annualRate.lessThan(0)) {
      errors.push('Interest rate cannot be negative')
    }

    if (annualRate.greaterThan(RBI_RATE_CAPS.PERSONAL_LOAN)) {
      errors.push(`Interest rate ${annualRate}% exceeds RBI cap of ${RBI_RATE_CAPS.PERSONAL_LOAN}% per annum`)
    }

    if (annualRate.greaterThan(18)) {
      warnings.push('Interest rate above 18% - ensure customer understands the high cost')
    }

    // Tenure validation
    if (params.tenureMonths <= 0 || !Number.isInteger(params.tenureMonths)) {
      errors.push('Tenure must be a positive integer (months)')
    }

    if (params.tenureMonths > 360) { // 30 years
      warnings.push('Tenure exceeds 30 years - very long-term commitment')
    }

    // Processing fee validation
    if (params.processingFeePercent) {
      const feePercent = new Decimal(params.processingFeePercent)
      if (feePercent.greaterThan(5)) {
        errors.push('Processing fee cannot exceed 5% of loan amount')
      }
    }

  } catch (error) {
    errors.push('Invalid numeric input: ' + (error as Error).message)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}
