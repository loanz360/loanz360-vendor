// =====================================================
// PAYROLL ANALYTICS UTILITIES
// YTD summaries, salary trends, deduction breakdowns,
// take-home projections, gratuity estimation
// =====================================================

// ---------------------
// Interfaces
// ---------------------

export interface Payslip {
  id: string
  month: number
  year: number
  gross_salary: number
  total_deductions: number
  net_salary: number
  basic_salary: number
  hra: number
  special_allowance: number
  pf_employee: number
  esi_employee: number
  professional_tax: number
  tds: number
  generated_date: string
}

export interface EmployeeSalary {
  basic_salary: number
  hra: number
  special_allowance: number
  gross_salary: number
  total_deductions: number
  net_salary: number
  ctc: number
  effective_from: string
}

export interface YTDSummary {
  total_gross: number
  total_deductions: number
  total_net: number
  total_pf: number
  total_esi: number
  total_professional_tax: number
  total_tds: number
  months_count: number
  average_gross: number
  average_net: number
  /** Month-over-month change percentages (latest vs previous) */
  mom_change: {
    gross: number | null
    deductions: number | null
    net: number | null
  }
  /** Financial year this summary covers */
  financial_year: string
}

export interface SalaryTrendPoint {
  month: number
  year: number
  label: string
  gross_salary: number
  total_deductions: number
  net_salary: number
}

export interface SalaryTrendData {
  data_points: SalaryTrendPoint[]
  period: { from: string; to: string }
  highest_gross: { amount: number; month_label: string }
  lowest_gross: { amount: number; month_label: string }
  average_gross: number
  growth_rate: number | null
}

export interface DeductionBreakdownItem {
  category: string
  amount: number
  percentage: number
  color: string
}

export interface DeductionBreakdown {
  items: DeductionBreakdownItem[]
  total_deductions: number
  deduction_rate: number
}

export interface TakeHomeProjection {
  gross_salary: number
  statutory_deductions: number
  emi_deductions: number
  total_deductions: number
  take_home: number
  take_home_percentage: number
  ctc: number
  ctc_utilization: number
  monthly_breakdown: {
    basic: number
    hra: number
    special_allowance: number
    pf: number
    esi: number
    professional_tax: number
    tds_estimate: number
    emi: number
    net: number
  }
}

export interface GratuityEstimate {
  basic_salary: number
  years_of_service: number
  gratuity_amount: number
  is_eligible: boolean
  eligibility_note: string
  formula: string
}

// ---------------------
// Constants
// ---------------------

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

const DEDUCTION_COLORS = {
  pf: '#3B82F6',          // Blue
  esi: '#8B5CF6',         // Purple
  professional_tax: '#F59E0B', // Amber
  tds: '#EF4444',         // Red
  other: '#6B7280',       // Gray
} as const

// Standard PF rate: 12% of basic (employee contribution)
const PF_RATE = 0.12
// ESI rate: 0.75% of gross (if gross <= 21,000/month)
const ESI_RATE = 0.0075
const ESI_GROSS_LIMIT = 21000

// ---------------------
// YTD Summary
// ---------------------

/**
 * Calculate Year-to-Date summary from payslip array
 * Includes totals, averages, and month-over-month change percentages
 */
export function calculateYTDSummary(payslips: Payslip[]): YTDSummary {
  if (!payslips || payslips.length === 0) {
    return {
      total_gross: 0,
      total_deductions: 0,
      total_net: 0,
      total_pf: 0,
      total_esi: 0,
      total_professional_tax: 0,
      total_tds: 0,
      months_count: 0,
      average_gross: 0,
      average_net: 0,
      mom_change: { gross: null, deductions: null, net: null },
      financial_year: getPayrollFY(),
    }
  }

  // Sort by year and month ascending
  const sorted = [...payslips].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    return a.month - b.month
  })

  const totals = sorted.reduce(
    (acc, p) => ({
      gross: acc.gross + p.gross_salary,
      deductions: acc.deductions + p.total_deductions,
      net: acc.net + p.net_salary,
      pf: acc.pf + p.pf_employee,
      esi: acc.esi + p.esi_employee,
      pt: acc.pt + p.professional_tax,
      tds: acc.tds + p.tds,
    }),
    { gross: 0, deductions: 0, net: 0, pf: 0, esi: 0, pt: 0, tds: 0 }
  )

  const count = sorted.length

  // Month-over-month change (latest vs second-latest)
  let momChange: YTDSummary['mom_change'] = { gross: null, deductions: null, net: null }
  if (count >= 2) {
    const latest = sorted[count - 1]
    const previous = sorted[count - 2]
    momChange = {
      gross: calcPercentChange(previous.gross_salary, latest.gross_salary),
      deductions: calcPercentChange(previous.total_deductions, latest.total_deductions),
      net: calcPercentChange(previous.net_salary, latest.net_salary),
    }
  }

  return {
    total_gross: Math.round(totals.gross),
    total_deductions: Math.round(totals.deductions),
    total_net: Math.round(totals.net),
    total_pf: Math.round(totals.pf),
    total_esi: Math.round(totals.esi),
    total_professional_tax: Math.round(totals.pt),
    total_tds: Math.round(totals.tds),
    months_count: count,
    average_gross: Math.round(totals.gross / count),
    average_net: Math.round(totals.net / count),
    mom_change: momChange,
    financial_year: getPayrollFY(),
  }
}

// ---------------------
// Salary Trend
// ---------------------

/**
 * Generate 12-month salary trend data for charting
 * Returns data points sorted chronologically with gross, deductions, and net
 */
export function calculateSalaryTrend(payslips: Payslip[]): SalaryTrendData {
  if (!payslips || payslips.length === 0) {
    return {
      data_points: [],
      period: { from: '', to: '' },
      highest_gross: { amount: 0, month_label: '' },
      lowest_gross: { amount: 0, month_label: '' },
      average_gross: 0,
      growth_rate: null,
    }
  }

  // Sort chronologically and take last 12
  const sorted = [...payslips]
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year
      return a.month - b.month
    })
    .slice(-12)

  const dataPoints: SalaryTrendPoint[] = sorted.map((p) => ({
    month: p.month,
    year: p.year,
    label: `${MONTH_LABELS[p.month - 1]} ${p.year}`,
    gross_salary: Math.round(p.gross_salary),
    total_deductions: Math.round(p.total_deductions),
    net_salary: Math.round(p.net_salary),
  }))

  const grossValues = sorted.map((p) => p.gross_salary)
  const maxGross = Math.max(...grossValues)
  const minGross = Math.min(...grossValues)
  const maxIdx = grossValues.indexOf(maxGross)
  const minIdx = grossValues.indexOf(minGross)

  const totalGross = grossValues.reduce((a, b) => a + b, 0)

  // Growth rate: first vs last month
  let growthRate: number | null = null
  if (sorted.length >= 2) {
    growthRate = calcPercentChange(sorted[0].gross_salary, sorted[sorted.length - 1].gross_salary)
  }

  const first = sorted[0]
  const last = sorted[sorted.length - 1]

  return {
    data_points: dataPoints,
    period: {
      from: `${MONTH_LABELS[first.month - 1]} ${first.year}`,
      to: `${MONTH_LABELS[last.month - 1]} ${last.year}`,
    },
    highest_gross: {
      amount: Math.round(maxGross),
      month_label: `${MONTH_LABELS[sorted[maxIdx].month - 1]} ${sorted[maxIdx].year}`,
    },
    lowest_gross: {
      amount: Math.round(minGross),
      month_label: `${MONTH_LABELS[sorted[minIdx].month - 1]} ${sorted[minIdx].year}`,
    },
    average_gross: Math.round(totalGross / sorted.length),
    growth_rate: growthRate,
  }
}

// ---------------------
// Deduction Breakdown
// ---------------------

/**
 * Generate pie chart data for a single payslip's deduction categories
 */
export function calculateDeductionBreakdown(payslip: Payslip): DeductionBreakdown {
  const items: DeductionBreakdownItem[] = []
  const total = payslip.total_deductions

  if (total <= 0) {
    return { items: [], total_deductions: 0, deduction_rate: 0 }
  }

  // PF
  if (payslip.pf_employee > 0) {
    items.push({
      category: 'Provident Fund',
      amount: Math.round(payslip.pf_employee),
      percentage: round2((payslip.pf_employee / total) * 100),
      color: DEDUCTION_COLORS.pf,
    })
  }

  // ESI
  if (payslip.esi_employee > 0) {
    items.push({
      category: 'ESI',
      amount: Math.round(payslip.esi_employee),
      percentage: round2((payslip.esi_employee / total) * 100),
      color: DEDUCTION_COLORS.esi,
    })
  }

  // Professional Tax
  if (payslip.professional_tax > 0) {
    items.push({
      category: 'Professional Tax',
      amount: Math.round(payslip.professional_tax),
      percentage: round2((payslip.professional_tax / total) * 100),
      color: DEDUCTION_COLORS.professional_tax,
    })
  }

  // TDS
  if (payslip.tds > 0) {
    items.push({
      category: 'TDS (Income Tax)',
      amount: Math.round(payslip.tds),
      percentage: round2((payslip.tds / total) * 100),
      color: DEDUCTION_COLORS.tds,
    })
  }

  // Other deductions (total - known categories)
  const knownDeductions =
    payslip.pf_employee + payslip.esi_employee + payslip.professional_tax + payslip.tds
  const otherDeductions = total - knownDeductions

  if (otherDeductions > 0) {
    items.push({
      category: 'Other Deductions',
      amount: Math.round(otherDeductions),
      percentage: round2((otherDeductions / total) * 100),
      color: DEDUCTION_COLORS.other,
    })
  }

  // Sort by amount descending
  items.sort((a, b) => b.amount - a.amount)

  return {
    items,
    total_deductions: Math.round(total),
    deduction_rate: round2((total / payslip.gross_salary) * 100),
  }
}

// ---------------------
// Take-Home Projection
// ---------------------

/**
 * Calculate take-home pay projection after EMI/advance deductions
 * Uses current salary structure and statutory deduction rates
 */
export function calculateTakeHomeProjection(
  salary: EmployeeSalary,
  emiDeductions: number = 0
): TakeHomeProjection {
  const monthlyBasic = salary.basic_salary
  const monthlyHRA = salary.hra
  const monthlySpecial = salary.special_allowance
  const monthlyGross = salary.gross_salary

  // Statutory deductions
  const pf = Math.round(monthlyBasic * PF_RATE)
  const esi = monthlyGross <= ESI_GROSS_LIMIT ? Math.round(monthlyGross * ESI_RATE) : 0

  // Professional Tax: typical max slab (varies by state, using common 200/month)
  const professionalTax = monthlyGross > 15000 ? 200 : 0

  // TDS estimate: rough monthly (annual tax / 12), simplified
  // Using approximate for projection - actual TDS uses full tax-optimizer
  const annualGross = monthlyGross * 12
  const estimatedAnnualTax = estimateAnnualTax(annualGross)
  const tdsEstimate = Math.round(estimatedAnnualTax / 12)

  const statutoryDeductions = pf + esi + professionalTax + tdsEstimate
  const totalDeductions = statutoryDeductions + emiDeductions
  const takeHome = Math.max(0, monthlyGross - totalDeductions)

  return {
    gross_salary: monthlyGross,
    statutory_deductions: statutoryDeductions,
    emi_deductions: emiDeductions,
    total_deductions: totalDeductions,
    take_home: takeHome,
    take_home_percentage: monthlyGross > 0 ? round2((takeHome / monthlyGross) * 100) : 0,
    ctc: salary.ctc,
    ctc_utilization:
      salary.ctc > 0 ? round2((takeHome / (salary.ctc / 12)) * 100) : 0,
    monthly_breakdown: {
      basic: monthlyBasic,
      hra: monthlyHRA,
      special_allowance: monthlySpecial,
      pf,
      esi,
      professional_tax: professionalTax,
      tds_estimate: tdsEstimate,
      emi: emiDeductions,
      net: takeHome,
    },
  }
}

// ---------------------
// Gratuity Estimate
// ---------------------

/**
 * Calculate gratuity estimate
 * Formula: (Basic Salary x 15 x Years of Service) / 26
 * Eligible after 5 years of continuous service
 * Maximum gratuity: Rs 20,00,000 (Payment of Gratuity Act)
 */
export function calculateGratuityEstimate(
  basicSalary: number,
  yearsOfService: number
): GratuityEstimate {
  const MAX_GRATUITY = 2000000 // Rs 20 Lakh cap

  const isEligible = yearsOfService >= 5
  const rawGratuity = (basicSalary * 15 * yearsOfService) / 26
  const gratuityAmount = Math.min(Math.round(rawGratuity), MAX_GRATUITY)

  let eligibilityNote: string
  if (isEligible) {
    eligibilityNote = `Eligible for gratuity (${yearsOfService} years of service).`
    if (rawGratuity > MAX_GRATUITY) {
      eligibilityNote += ' Amount capped at statutory maximum of Rs 20,00,000.'
    }
  } else {
    const remaining = Math.ceil(5 - yearsOfService)
    eligibilityNote = `Not yet eligible. Need ${remaining} more year${remaining > 1 ? 's' : ''} of service (minimum 5 years required).`
  }

  return {
    basic_salary: basicSalary,
    years_of_service: yearsOfService,
    gratuity_amount: isEligible ? gratuityAmount : 0,
    is_eligible: isEligible,
    eligibility_note: eligibilityNote,
    formula: `(${formatINRSimple(basicSalary)} x 15 x ${yearsOfService}) / 26 = ${formatINRSimple(Math.round(rawGratuity))}`,
  }
}

// ---------------------
// Savings Rate
// ---------------------

/**
 * Calculate savings rate as percentage of gross pay being saved/deducted
 * Useful for financial health indicators
 */
export function getSavingsRate(
  netPay: number,
  totalDeductions: number
): {
  savings_rate: number
  gross_pay: number
  rating: 'excellent' | 'good' | 'average' | 'low'
  message: string
} {
  const grossPay = netPay + totalDeductions
  const savingsRate = grossPay > 0 ? round2((totalDeductions / grossPay) * 100) : 0

  let rating: 'excellent' | 'good' | 'average' | 'low'
  let message: string

  if (savingsRate >= 30) {
    rating = 'excellent'
    message = 'Excellent savings discipline. You are saving more than 30% of gross pay through deductions and investments.'
  } else if (savingsRate >= 20) {
    rating = 'good'
    message = 'Good savings rate. Consider increasing investments to reach the 30% mark for stronger financial health.'
  } else if (savingsRate >= 10) {
    rating = 'average'
    message = 'Average savings rate. Explore tax-saving instruments under 80C and 80D to improve your savings.'
  } else {
    rating = 'low'
    message = 'Low savings rate. Consider starting SIPs in ELSS funds or increasing PF contribution for better tax savings.'
  }

  return {
    savings_rate: savingsRate,
    gross_pay: grossPay,
    rating,
    message,
  }
}

// ---------------------
// Internal Helpers
// ---------------------

/**
 * Calculate percentage change between two values
 */
function calcPercentChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) return newValue > 0 ? 100 : 0
  return round2(((newValue - oldValue) / oldValue) * 100)
}

/**
 * Round to 2 decimal places
 */
function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Get financial year for payroll context
 */
function getPayrollFY(): string {
  const now = new Date()
  const month = now.getMonth()
  const year = now.getFullYear()
  const fyStart = month < 3 ? year - 1 : year
  const fyEnd = fyStart + 1
  return `${fyStart}-${fyEnd.toString().slice(-2)}`
}

/**
 * Simple INR formatting for internal use
 */
function formatINRSimple(amount: number): string {
  return `Rs ${Math.abs(amount).toLocaleString('en-IN')}`
}

/**
 * Rough annual tax estimate for take-home projection
 * Uses New Regime defaults for quick calculation
 */
function estimateAnnualTax(annualGross: number): number {
  const standardDeduction = 75000
  const taxable = Math.max(0, annualGross - standardDeduction)

  // New regime slab calculation (simplified)
  let tax = 0
  if (taxable <= 300000) {
    tax = 0
  } else if (taxable <= 700000) {
    tax = (taxable - 300000) * 0.05
    // 87A rebate for income up to 7L
    if (taxable <= 700000) tax = 0
  } else if (taxable <= 1000000) {
    tax = 400000 * 0.05 + (taxable - 700000) * 0.10
  } else if (taxable <= 1200000) {
    tax = 400000 * 0.05 + 300000 * 0.10 + (taxable - 1000000) * 0.15
  } else if (taxable <= 1500000) {
    tax = 400000 * 0.05 + 300000 * 0.10 + 200000 * 0.15 + (taxable - 1200000) * 0.20
  } else {
    tax =
      400000 * 0.05 +
      300000 * 0.10 +
      200000 * 0.15 +
      300000 * 0.20 +
      (taxable - 1500000) * 0.30
  }

  // Add 4% cess
  tax = tax * 1.04

  return Math.round(tax)
}
