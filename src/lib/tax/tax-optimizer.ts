// =====================================================
// TAX OPTIMIZATION ENGINE (Enhancement E2)
// AI-powered tax savings recommendations
// =====================================================

export interface TaxRegime {
  type: 'old' | 'new'
  taxableIncome: number
  taxAmount: number
  standardDeduction: number
  totalDeductions: number
  effectiveTaxRate: number
}

export interface TaxSection {
  section: string
  name: string
  maxLimit: number
  currentDeclared: number
  availableLimit: number
  potentialSavings: number
  priority: 'high' | 'medium' | 'low'
  category: 'investment' | 'insurance' | 'donation' | 'savings' | 'housing'
  description: string
  suggestedInvestments: string[]
}

export interface TaxOptimizationResult {
  currentRegime: TaxRegime
  alternateRegime: TaxRegime
  recommendation: 'old' | 'new'
  annualSavings: number
  monthlySavings: number
  optimizationSuggestions: TaxSection[]
  totalPotentialSavings: number
  implementationPriority: string[]
}

/**
 * Apply surcharge based on income level (applicable to both regimes)
 */
function applySurcharge(tax: number, taxableIncome: number): number {
  let surchargeRate = 0
  if (taxableIncome > 50000000) surchargeRate = 0.37       // Above ₹5 Cr
  else if (taxableIncome > 20000000) surchargeRate = 0.25  // Above ₹2 Cr
  else if (taxableIncome > 10000000) surchargeRate = 0.15  // Above ₹1 Cr
  else if (taxableIncome > 5000000) surchargeRate = 0.10   // Above ₹50 L
  return tax + (tax * surchargeRate)
}

/**
 * Calculate tax based on old regime slabs (FY 2024-25)
 * Includes Section 87A rebate and surcharge
 */
export function calculateOldRegimeTax(taxableIncome: number): number {
  let tax = 0

  if (taxableIncome <= 250000) {
    tax = 0
  } else if (taxableIncome <= 500000) {
    tax = (taxableIncome - 250000) * 0.05
  } else if (taxableIncome <= 1000000) {
    tax = 12500 + (taxableIncome - 500000) * 0.20
  } else {
    tax = 112500 + (taxableIncome - 1000000) * 0.30
  }

  // Section 87A rebate: If taxable income <= ₹5,00,000, tax payable is NIL
  if (taxableIncome <= 500000) {
    tax = 0
  }

  // Apply surcharge for high incomes
  tax = applySurcharge(tax, taxableIncome)

  // Add 4% health and education cess
  tax = tax * 1.04

  return Math.round(tax)
}

/**
 * Calculate tax based on new regime slabs (FY 2024-25 Budget updated)
 * Slabs: 0-3L: nil, 3-7L: 5%, 7-10L: 10%, 10-12L: 15%, 12-15L: 20%, >15L: 30%
 * Includes Section 87A rebate (up to ₹7,00,000) and surcharge
 */
export function calculateNewRegimeTax(taxableIncome: number): number {
  let tax = 0

  if (taxableIncome <= 300000) {
    tax = 0
  } else if (taxableIncome <= 700000) {
    tax = (taxableIncome - 300000) * 0.05
  } else if (taxableIncome <= 1000000) {
    tax = 20000 + (taxableIncome - 700000) * 0.10
  } else if (taxableIncome <= 1200000) {
    tax = 50000 + (taxableIncome - 1000000) * 0.15
  } else if (taxableIncome <= 1500000) {
    tax = 80000 + (taxableIncome - 1200000) * 0.20
  } else {
    tax = 140000 + (taxableIncome - 1500000) * 0.30
  }

  // Section 87A rebate under new regime: If taxable income <= ₹7,00,000, tax = NIL
  if (taxableIncome <= 700000) {
    tax = 0
  }

  // Apply surcharge for high incomes
  tax = applySurcharge(tax, taxableIncome)

  // Add 4% health and education cess
  tax = tax * 1.04

  return Math.round(tax)
}

/**
 * Get marginal tax rate based on taxable income (old regime)
 * Returns effective rate including cess
 */
function getMarginalTaxRate(taxableIncome: number): number {
  if (taxableIncome <= 250000) return 0
  if (taxableIncome <= 500000) return 0.052   // 5% + 4% cess
  if (taxableIncome <= 1000000) return 0.2080  // 20% + 4% cess
  return 0.312                                 // 30% + 4% cess
}

/**
 * Calculate Section 80C deductions
 */
export function analyze80C(grossIncome: number, currentDeclared: number): TaxSection {
  const maxLimit = 150000
  const availableLimit = Math.max(0, maxLimit - currentDeclared)
  const marginalRate = getMarginalTaxRate(grossIncome)
  const potentialSavings = Math.round(availableLimit * marginalRate)

  return {
    section: '80C',
    name: 'Life Insurance, PPF, ELSS, EPF, Home Loan Principal',
    maxLimit,
    currentDeclared,
    availableLimit,
    potentialSavings,
    priority: availableLimit > 50000 ? 'high' : availableLimit > 20000 ? 'medium' : 'low',
    category: 'investment',
    description: 'Investments in PPF, ELSS mutual funds, life insurance premiums, home loan principal',
    suggestedInvestments: [
      'ELSS Mutual Funds (Tax saving + market returns)',
      'Public Provident Fund (PPF) - Safe, 7.1% returns',
      'National Pension System (NPS) - Additional ₹50,000 under 80CCD(1B)',
      'Life Insurance Premium',
      'Home Loan Principal Repayment'
    ]
  }
}

/**
 * Calculate Section 80D deductions (Health Insurance)
 */
export function analyze80D(age: number, parentsAge: number, currentDeclared: number, grossIncome: number = 1000000): TaxSection {
  // Self + Family: ₹25,000 (or ₹50,000 if senior citizen)
  // Parents: ₹25,000 (or ₹50,000 if senior citizen)
  const selfLimit = age >= 60 ? 50000 : 25000
  const parentsLimit = parentsAge >= 60 ? 50000 : 25000
  const maxLimit = selfLimit + parentsLimit

  const availableLimit = Math.max(0, maxLimit - currentDeclared)
  const marginalRate = getMarginalTaxRate(grossIncome)
  const potentialSavings = Math.round(availableLimit * marginalRate)

  return {
    section: '80D',
    name: 'Health Insurance Premium',
    maxLimit,
    currentDeclared,
    availableLimit,
    potentialSavings,
    priority: availableLimit > 25000 ? 'high' : 'medium',
    category: 'insurance',
    description: `Health insurance for self, family, and parents. Max: ₹${maxLimit.toLocaleString('en-IN')}`,
    suggestedInvestments: [
      `Health Insurance for Self/Family: ₹${selfLimit.toLocaleString('en-IN')}`,
      `Health Insurance for Parents: ₹${parentsLimit.toLocaleString('en-IN')}`,
      'Preventive Health Checkup: ₹5,000 (within above limits)'
    ]
  }
}

/**
 * Calculate Section 80CCD(1B) - Additional NPS deduction
 */
export function analyze80CCD1B(currentDeclared: number, grossIncome: number = 1000000): TaxSection {
  const maxLimit = 50000
  const availableLimit = Math.max(0, maxLimit - currentDeclared)
  const marginalRate = getMarginalTaxRate(grossIncome)
  const potentialSavings = Math.round(availableLimit * marginalRate)

  return {
    section: '80CCD(1B)',
    name: 'Additional NPS Contribution',
    maxLimit,
    currentDeclared,
    availableLimit,
    potentialSavings,
    priority: availableLimit > 0 ? 'high' : 'low',
    category: 'investment',
    description: 'Additional deduction for National Pension System over and above 80C limit',
    suggestedInvestments: [
      'NPS Tier 1 Account - Additional ₹50,000 deduction',
      'Dual benefit: Tax saving + Retirement corpus',
      'Invest before March 31st'
    ]
  }
}

/**
 * Calculate HRA Exemption
 */
export function analyzeHRAExemption(
  basicSalary: number,
  hra: number,
  rentPaid: number,
  metroCity: boolean,
  grossIncome: number = 1000000
): TaxSection {
  // HRA exemption = Minimum of:
  // 1. Actual HRA received
  // 2. Rent paid - 10% of basic salary
  // 3. 50% of basic salary (metro) or 40% of basic salary (non-metro)

  const exemptionLimit1 = hra
  const exemptionLimit2 = Math.max(0, rentPaid - basicSalary * 0.1)
  const exemptionLimit3 = basicSalary * (metroCity ? 0.5 : 0.4)

  const exemption = Math.min(exemptionLimit1, exemptionLimit2, exemptionLimit3)
  const marginalRate = getMarginalTaxRate(grossIncome)
  const potentialSavings = Math.round(exemption * marginalRate)

  return {
    section: 'HRA',
    name: 'House Rent Allowance Exemption',
    maxLimit: Math.round(exemption),
    currentDeclared: 0,
    availableLimit: Math.round(exemption),
    potentialSavings,
    priority: potentialSavings > 20000 ? 'high' : 'medium',
    category: 'housing',
    description: 'Tax exemption on rent paid (requires rent receipts)',
    suggestedInvestments: [
      'Submit rent receipts for rent paid',
      'Get rent agreement executed',
      `Potential exemption: ₹${Math.round(exemption).toLocaleString('en-IN')}`
    ]
  }
}

/**
 * Calculate Home Loan Interest deduction (Section 24)
 */
export function analyzeHomeLoanInterest(interestPaid: number, grossIncome: number = 1000000): TaxSection {
  const maxLimit = 200000
  const exemption = Math.min(interestPaid, maxLimit)
  const marginalRate = getMarginalTaxRate(grossIncome)
  const potentialSavings = Math.round(exemption * marginalRate)

  return {
    section: '24',
    name: 'Home Loan Interest',
    maxLimit,
    currentDeclared: 0,
    availableLimit: Math.round(exemption),
    potentialSavings,
    priority: potentialSavings > 30000 ? 'high' : 'medium',
    category: 'housing',
    description: 'Deduction on home loan interest (self-occupied property)',
    suggestedInvestments: [
      'Submit home loan interest certificate from bank',
      `Maximum deduction: ₹${maxLimit.toLocaleString('en-IN')}`,
      'First-time home buyers get additional ₹1.5L under 80EEA'
    ]
  }
}

/**
 * Main tax optimization function
 */
export function optimizeTax(
  grossAnnualIncome: number,
  currentDeductions: {
    section80C?: number
    section80D?: number
    section80CCD1B?: number
    hraExemption?: number
    homeLoanInterest?: number
    otherDeductions?: number
  },
  employeeDetails: {
    age?: number
    parentsAge?: number
    rentPaid?: number
    metroCity?: boolean
    homeLoanInterest?: number
  }
): TaxOptimizationResult {
  const {
    section80C = 0,
    section80D = 0,
    section80CCD1B = 0,
    hraExemption = 0,
    homeLoanInterest = 0,
    otherDeductions = 0
  } = currentDeductions

  const {
    age = 30,
    parentsAge = 60,
    rentPaid = 0,
    metroCity = true,
    homeLoanInterest: loanInterest = 0
  } = employeeDetails

  // Calculate Old Regime (standard deduction raised to ₹75,000 from FY 2024-25 Budget)
  const standardDeduction = 75000
  const totalOldRegimeDeductions =
    standardDeduction +
    section80C +
    section80D +
    section80CCD1B +
    hraExemption +
    homeLoanInterest +
    otherDeductions

  const oldRegimeTaxableIncome = Math.max(0, grossAnnualIncome - totalOldRegimeDeductions)
  const oldRegimeTax = calculateOldRegimeTax(oldRegimeTaxableIncome)

  const oldRegime: TaxRegime = {
    type: 'old',
    taxableIncome: oldRegimeTaxableIncome,
    taxAmount: oldRegimeTax,
    standardDeduction,
    totalDeductions: totalOldRegimeDeductions,
    effectiveTaxRate: grossAnnualIncome > 0 ? (oldRegimeTax / grossAnnualIncome) * 100 : 0
  }

  // Calculate New Regime (no deductions except standard deduction of ₹75,000 as per Budget 2024)
  const newRegimeStandardDeduction = 75000
  const newRegimeTaxableIncome = Math.max(0, grossAnnualIncome - newRegimeStandardDeduction)
  const newRegimeTax = calculateNewRegimeTax(newRegimeTaxableIncome)

  const newRegime: TaxRegime = {
    type: 'new',
    taxableIncome: newRegimeTaxableIncome,
    taxAmount: newRegimeTax,
    standardDeduction: newRegimeStandardDeduction,
    totalDeductions: newRegimeStandardDeduction,
    effectiveTaxRate: grossAnnualIncome > 0 ? (newRegimeTax / grossAnnualIncome) * 100 : 0
  }

  // Analyze optimization opportunities
  const optimizationSuggestions: TaxSection[] = []

  // Section 80C
  optimizationSuggestions.push(analyze80C(grossAnnualIncome, section80C))

  // Section 80D
  optimizationSuggestions.push(analyze80D(age, parentsAge, section80D, grossAnnualIncome))

  // Section 80CCD(1B)
  optimizationSuggestions.push(analyze80CCD1B(section80CCD1B, grossAnnualIncome))

  // HRA Exemption
  if (rentPaid > 0) {
    const basicSalary = grossAnnualIncome * 0.4
    const hraReceived = grossAnnualIncome * 0.25
    optimizationSuggestions.push(analyzeHRAExemption(basicSalary, hraReceived, rentPaid, metroCity, grossAnnualIncome))
  }

  // Home Loan Interest
  if (loanInterest > 0) {
    optimizationSuggestions.push(analyzeHomeLoanInterest(loanInterest, grossAnnualIncome))
  }

  // Calculate total potential savings
  const totalPotentialSavings = optimizationSuggestions.reduce(
    (sum, section) => sum + section.potentialSavings,
    0
  )

  // Implementation priority
  const implementationPriority = optimizationSuggestions
    .filter(s => s.availableLimit > 0)
    .sort((a, b) => b.potentialSavings - a.potentialSavings)
    .slice(0, 3)
    .map(s => `${s.section}: ${s.name} - Save ₹${s.potentialSavings.toLocaleString('en-IN')}`)

  // Recommendation
  const recommendation = oldRegimeTax < newRegimeTax ? 'old' : 'new'
  const annualSavings = Math.abs(oldRegimeTax - newRegimeTax)
  const monthlySavings = Math.round(annualSavings / 12)

  return {
    currentRegime: oldRegime,
    alternateRegime: newRegime,
    recommendation,
    annualSavings,
    monthlySavings,
    optimizationSuggestions: optimizationSuggestions.sort((a, b) => b.potentialSavings - a.potentialSavings),
    totalPotentialSavings,
    implementationPriority
  }
}

/**
 * Calculate monthly TDS projection
 */
export function calculateMonthlyTDS(
  annualIncome: number,
  annualDeductions: number,
  monthsRemaining: number = 12
): { monthlyTDS: number; annualTDS: number; effectiveRate: number } {
  const taxableIncome = Math.max(0, annualIncome - annualDeductions)
  const annualTax = calculateOldRegimeTax(taxableIncome)
  // Spread remaining tax over remaining months (not always 12)
  const effectiveMonths = Math.max(1, monthsRemaining)
  const monthlyTDS = Math.round(annualTax / effectiveMonths)

  return {
    monthlyTDS,
    annualTDS: annualTax,
    effectiveRate: annualIncome > 0 ? (annualTax / annualIncome) * 100 : 0
  }
}
