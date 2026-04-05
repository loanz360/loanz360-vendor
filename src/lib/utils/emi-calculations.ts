/**
 * EMI Calculation Utilities - Enterprise-grade Financial Calculations
 *
 * Comprehensive calculation functions for EMI, prepayment, eligibility,
 * tax benefits, and loan comparisons
 */

import type {
  EMICalculationInput,
  EMICalculationResult,
  AmortizationRow,
  AmortizationSchedule,
  YearWiseSummary,
  PrepaymentInput,
  PrepaymentResult,
  EligibilityInput,
  EligibilityResult,
  TaxBenefitInput,
  TaxBenefitResult,
  LoanScenario,
  LoanComparisonResult,
  InterestCalculationMethod,
  LOAN_TYPE_CONFIG,
  DEFAULT_FOIR_LIMITS,
  CREDIT_SCORE_CONFIG,
  TAX_DEDUCTION_LIMITS,
} from '@/types/emi-calculator'

// ============================================================================
// CORE EMI CALCULATIONS
// ============================================================================

/**
 * Calculate EMI using the standard formula
 * EMI = P × r × (1 + r)^n / ((1 + r)^n - 1)
 *
 * Handles edge case of 0% interest rate
 */
export function calculateEMI(
  principal: number,
  annualInterestRate: number,
  tenureMonths: number,
  method: InterestCalculationMethod = 'reducing_balance_monthly'
): number {
  if (principal <= 0 || tenureMonths <= 0) {
    return 0
  }

  // Handle 0% interest rate (interest-free loans)
  if (annualInterestRate === 0) {
    return principal / tenureMonths
  }

  // For flat rate calculation
  if (method === 'flat_rate') {
    const totalInterest = (principal * annualInterestRate * tenureMonths) / 1200
    return (principal + totalInterest) / tenureMonths
  }

  // Standard reducing balance (monthly rest)
  const monthlyRate = annualInterestRate / 100 / 12
  const emi =
    (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
    (Math.pow(1 + monthlyRate, tenureMonths) - 1)

  return emi
}

/**
 * Complete EMI calculation with all fees and costs
 */
export function calculateEMIComplete(input: EMICalculationInput): EMICalculationResult {
  const {
    principalAmount,
    interestRate,
    tenureMonths,
    calculationMethod = 'reducing_balance_monthly',
    processingFeePercentage = 0,
    processingFeeFlat = 0,
    insurancePremium = 0,
    otherCharges = 0,
  } = input

  const monthlyEMI = calculateEMI(principalAmount, interestRate, tenureMonths, calculationMethod)
  const totalAmount = monthlyEMI * tenureMonths
  const totalInterest = totalAmount - principalAmount

  // Calculate processing fee
  const processingFee = Math.max(processingFeeFlat, (principalAmount * processingFeePercentage) / 100)

  // Total cost of loan including all fees
  const totalCostOfLoan = totalAmount + processingFee + insurancePremium + otherCharges

  // Calculate effective interest rate (APR) including fees
  const effectiveInterestRate = calculateEffectiveRate(
    principalAmount - processingFee - insurancePremium - otherCharges,
    monthlyEMI,
    tenureMonths
  )

  return {
    monthlyEMI: roundToTwo(monthlyEMI),
    totalInterest: roundToTwo(totalInterest),
    totalAmount: roundToTwo(totalAmount),
    principalAmount,
    interestRate,
    tenureMonths,
    effectiveInterestRate: roundToTwo(effectiveInterestRate),
    processingFee: roundToTwo(processingFee),
    totalCostOfLoan: roundToTwo(totalCostOfLoan),
  }
}

/**
 * Calculate effective interest rate (APR) using Newton-Raphson method
 */
export function calculateEffectiveRate(netLoanAmount: number, emi: number, tenureMonths: number): number {
  if (netLoanAmount <= 0 || emi <= 0 || tenureMonths <= 0) return 0

  let rate = 0.01 // Initial guess: 1% monthly
  const maxIterations = 100
  const tolerance = 0.0000001

  for (let i = 0; i < maxIterations; i++) {
    const f = calculatePVFactor(rate, tenureMonths) * emi - netLoanAmount
    const fPrime = calculatePVFactorDerivative(rate, tenureMonths) * emi

    if (Math.abs(fPrime) < tolerance) break

    const newRate = rate - f / fPrime

    if (Math.abs(newRate - rate) < tolerance) {
      rate = newRate
      break
    }

    rate = newRate
  }

  return rate * 12 * 100 // Convert to annual percentage
}

function calculatePVFactor(rate: number, n: number): number {
  if (rate === 0) return n
  return (1 - Math.pow(1 + rate, -n)) / rate
}

function calculatePVFactorDerivative(rate: number, n: number): number {
  if (rate === 0) return -n * (n + 1) / 2
  const term1 = n * Math.pow(1 + rate, -(n + 1)) / rate
  const term2 = (1 - Math.pow(1 + rate, -n)) / (rate * rate)
  return term1 - term2
}

// ============================================================================
// AMORTIZATION SCHEDULE
// ============================================================================

/**
 * Generate complete amortization schedule
 */
export function generateAmortizationSchedule(
  principal: number,
  annualInterestRate: number,
  tenureMonths: number,
  startDate?: Date
): AmortizationSchedule {
  const emi = calculateEMI(principal, annualInterestRate, tenureMonths)
  const monthlyRate = annualInterestRate / 100 / 12
  const rows: AmortizationRow[] = []
  let balance = principal
  let cumulativePrincipal = 0
  let cumulativeInterest = 0

  const currentDate = startDate || new Date()

  for (let month = 1; month <= tenureMonths; month++) {
    // Handle 0% interest rate
    const interestPaid = annualInterestRate === 0 ? 0 : balance * monthlyRate
    const principalPaid = emi - interestPaid
    balance = Math.max(0, balance - principalPaid)

    cumulativePrincipal += principalPaid
    cumulativeInterest += interestPaid

    // Calculate payment date
    const paymentDate = new Date(currentDate)
    paymentDate.setMonth(paymentDate.getMonth() + month)

    rows.push({
      month,
      year: Math.ceil(month / 12),
      emi: roundToTwo(emi),
      principalPaid: roundToTwo(principalPaid),
      interestPaid: roundToTwo(interestPaid),
      balance: roundToTwo(balance),
      cumulativePrincipal: roundToTwo(cumulativePrincipal),
      cumulativeInterest: roundToTwo(cumulativeInterest),
      paymentDate: paymentDate.toISOString().split('T')[0],
    })
  }

  // Generate year-wise summary
  const yearWiseSummary = generateYearWiseSummary(rows, principal)

  return {
    rows,
    summary: {
      totalEMIPaid: roundToTwo(emi * tenureMonths),
      totalPrincipalPaid: roundToTwo(principal),
      totalInterestPaid: roundToTwo(cumulativeInterest),
      yearWiseSummary,
    },
  }
}

/**
 * Generate year-wise summary from amortization rows
 */
function generateYearWiseSummary(rows: AmortizationRow[], principal: number): YearWiseSummary[] {
  const yearMap = new Map<number, YearWiseSummary>()

  for (const row of rows) {
    if (!yearMap.has(row.year)) {
      const prevYearRow = rows.find((r) => r.month === (row.year - 1) * 12)
      yearMap.set(row.year, {
        year: row.year,
        totalEMI: 0,
        totalPrincipal: 0,
        totalInterest: 0,
        openingBalance: prevYearRow?.balance ?? principal,
        closingBalance: 0,
      })
    }

    const yearSummary = yearMap.get(row.year)!
    yearSummary.totalEMI += row.emi
    yearSummary.totalPrincipal += row.principalPaid
    yearSummary.totalInterest += row.interestPaid
    yearSummary.closingBalance = row.balance
  }

  return Array.from(yearMap.values()).map((summary) => ({
    ...summary,
    totalEMI: roundToTwo(summary.totalEMI),
    totalPrincipal: roundToTwo(summary.totalPrincipal),
    totalInterest: roundToTwo(summary.totalInterest),
    openingBalance: roundToTwo(summary.openingBalance),
    closingBalance: roundToTwo(summary.closingBalance),
  }))
}

// ============================================================================
// PREPAYMENT CALCULATIONS
// ============================================================================

/**
 * Calculate impact of prepayment on loan
 */
export function calculatePrepaymentImpact(input: PrepaymentInput): PrepaymentResult {
  const {
    currentOutstanding,
    currentEMI,
    remainingTenureMonths,
    interestRate,
    prepaymentAmount,
    prepaymentType,
  } = input

  const newOutstanding = currentOutstanding - prepaymentAmount
  const monthlyRate = interestRate / 100 / 12

  // Calculate original total interest remaining
  const originalTotalRemaining = currentEMI * remainingTenureMonths
  const originalInterestRemaining = originalTotalRemaining - currentOutstanding

  let newEMI: number
  let newTenureMonths: number
  let newTotalInterest: number

  if (prepaymentType === 'reduce_emi') {
    // Keep same tenure, reduce EMI
    newTenureMonths = remainingTenureMonths
    newEMI = calculateEMI(newOutstanding, interestRate, newTenureMonths)
    newTotalInterest = newEMI * newTenureMonths - newOutstanding
  } else {
    // Keep same EMI, reduce tenure
    newEMI = currentEMI
    // Calculate new tenure using formula: n = -log(1 - PV*r/PMT) / log(1+r)
    if (monthlyRate === 0) {
      newTenureMonths = Math.ceil(newOutstanding / newEMI)
    } else {
      // Validate: EMI must exceed monthly interest, otherwise loan can never be repaid
      const monthlyInterest = newOutstanding * monthlyRate
      if (newEMI <= monthlyInterest) {
        newTenureMonths = remainingTenureMonths
      } else {
        const logArg = 1 - (newOutstanding * monthlyRate) / newEMI
        if (logArg <= 0 || !isFinite(logArg)) {
          newTenureMonths = remainingTenureMonths
        } else {
          newTenureMonths = Math.ceil(
            -Math.log(logArg) / Math.log(1 + monthlyRate)
          )
        }
      }
    }
    newTotalInterest = newEMI * newTenureMonths - newOutstanding
  }

  const interestSaved = originalInterestRemaining - newTotalInterest
  const tenureReduction = remainingTenureMonths - newTenureMonths
  const emiReduction = currentEMI - newEMI

  // Generate revised schedule
  const revisedSchedule = generateAmortizationSchedule(newOutstanding, interestRate, newTenureMonths).rows

  return {
    newEMI: roundToTwo(newEMI),
    newTenureMonths,
    interestSaved: roundToTwo(Math.max(0, interestSaved)),
    newTotalInterest: roundToTwo(newTotalInterest),
    tenureReduction,
    emiReduction: roundToTwo(Math.max(0, emiReduction)),
    revisedSchedule,
  }
}

/**
 * Calculate optimal prepayment amount for target savings
 */
export function calculateOptimalPrepayment(
  outstanding: number,
  emi: number,
  remainingTenure: number,
  interestRate: number,
  targetInterestSaving: number
): number {
  // Binary search for optimal prepayment
  let low = 0
  let high = outstanding
  const tolerance = 100 // ₹100 tolerance

  while (high - low > tolerance) {
    const mid = (low + high) / 2
    const result = calculatePrepaymentImpact({
      currentOutstanding: outstanding,
      currentEMI: emi,
      remainingTenureMonths: remainingTenure,
      interestRate,
      prepaymentAmount: mid,
      prepaymentType: 'reduce_tenure',
    })

    if (result.interestSaved < targetInterestSaving) {
      low = mid
    } else {
      high = mid
    }
  }

  return roundToTwo((low + high) / 2)
}

// ============================================================================
// ELIGIBILITY CALCULATIONS
// ============================================================================

/**
 * Calculate loan eligibility based on income and other factors
 */
export function calculateEligibility(input: EligibilityInput): EligibilityResult {
  const {
    monthlyIncome,
    existingEMIs,
    age,
    retirementAge = 60,
    loanType,
    interestRate,
    maxFOIR = DEFAULT_FOIR_LIMITS[loanType] || 0.5,
    maxLTV,
    propertyValue,
    creditScore,
    employmentType,
    employerCategory,
  } = input

  const recommendations: string[] = []
  const warnings: string[] = []

  // Get loan type config
  const loanConfig = LOAN_TYPE_CONFIG[loanType]
  const maxTenureYears = Math.min(
    loanConfig.maxTenure / 12,
    retirementAge - age // Max tenure until retirement
  )
  const maxTenureMonths = maxTenureYears * 12

  // Calculate available EMI capacity
  const maxTotalEMI = monthlyIncome * maxFOIR
  const availableForNewEMI = maxTotalEMI - existingEMIs

  if (availableForNewEMI <= 0) {
    warnings.push('Your existing EMI obligations exceed the maximum FOIR limit')
    return {
      maxLoanAmount: 0,
      maxEMIAffordable: 0,
      maxTenureMonths: 0,
      suggestedLoanAmount: 0,
      suggestedTenure: 0,
      suggestedEMI: 0,
      foirUsed: (existingEMIs / monthlyIncome) * 100,
      availableFOIR: 0,
      factors: {
        incomeBasedMax: 0,
        ageBasedMax: 0,
      },
      recommendations: [],
      warnings,
    }
  }

  // Calculate max loan based on income (using full max tenure from loan config)
  const incomeBasedMax = calculateMaxLoanFromEMI(availableForNewEMI, interestRate, loanConfig.maxTenure)

  // Calculate max loan based on age/tenure (using age-constrained tenure)
  const ageBasedMax = calculateMaxLoanFromEMI(availableForNewEMI, interestRate, maxTenureMonths)

  // Apply credit score impact
  let creditScoreMultiplier = 1
  let creditScoreImpact = 'Not assessed'
  if (creditScore) {
    const scoreConfig = CREDIT_SCORE_CONFIG[creditScore]
    creditScoreMultiplier = scoreConfig.eligibilityImpact
    creditScoreImpact = `${scoreConfig.label} - ${creditScoreMultiplier > 1 ? 'Positive' : creditScoreMultiplier < 1 ? 'Negative' : 'Neutral'} impact`

    if (creditScore === 'poor') {
      warnings.push('Your credit score may affect loan approval. Consider improving it before applying.')
    }
  }

  // Apply employer category bonus
  if (employmentType === 'salaried' && (employerCategory === 'government' || employerCategory === 'psu')) {
    creditScoreMultiplier *= 1.1
    recommendations.push('Government/PSU employees get preferential rates')
  }

  // Calculate final max amounts
  let maxLoanAmount = Math.min(incomeBasedMax, ageBasedMax) * creditScoreMultiplier

  // Apply LTV for secured loans
  let ltvBasedMax: number | undefined
  if (loanConfig.hasCollateral && propertyValue && maxLTV) {
    ltvBasedMax = propertyValue * maxLTV
    maxLoanAmount = Math.min(maxLoanAmount, ltvBasedMax)
  }

  // Apply loan type limits
  maxLoanAmount = Math.min(maxLoanAmount, loanConfig.maxAmount)
  maxLoanAmount = Math.max(maxLoanAmount, 0)

  // Calculate suggested values (80% of max for safety margin)
  const suggestedLoanAmount = roundToTwo(maxLoanAmount * 0.8)
  const suggestedTenure = Math.min(maxTenureMonths, loanConfig.maxTenure)
  const suggestedEMI = calculateEMI(suggestedLoanAmount, interestRate, suggestedTenure)

  // Generate recommendations
  if (maxTenureYears < loanConfig.maxTenure / 12) {
    recommendations.push(
      `Your maximum tenure is limited to ${maxTenureYears} years based on retirement age`
    )
  }

  if (existingEMIs > 0) {
    recommendations.push('Consider closing existing loans to increase eligibility')
  }

  if (employmentType === 'self_employed') {
    recommendations.push('Self-employed applicants may need additional income proof')
  }

  return {
    maxLoanAmount: roundToTwo(maxLoanAmount),
    maxEMIAffordable: roundToTwo(availableForNewEMI),
    maxTenureMonths,
    suggestedLoanAmount,
    suggestedTenure,
    suggestedEMI: roundToTwo(suggestedEMI),
    foirUsed: roundToTwo((existingEMIs / monthlyIncome) * 100),
    availableFOIR: roundToTwo(((maxTotalEMI - existingEMIs) / monthlyIncome) * 100),
    factors: {
      incomeBasedMax: roundToTwo(incomeBasedMax),
      ageBasedMax: roundToTwo(ageBasedMax),
      ltvBasedMax: ltvBasedMax ? roundToTwo(ltvBasedMax) : undefined,
      creditScoreImpact,
    },
    recommendations,
    warnings,
  }
}

/**
 * Calculate maximum loan amount for a given EMI
 */
function calculateMaxLoanFromEMI(emi: number, annualRate: number, tenureMonths: number): number {
  if (emi <= 0 || tenureMonths <= 0) return 0
  if (annualRate === 0) return emi * tenureMonths

  const monthlyRate = annualRate / 100 / 12
  return (emi * (Math.pow(1 + monthlyRate, tenureMonths) - 1)) / (monthlyRate * Math.pow(1 + monthlyRate, tenureMonths))
}

// ============================================================================
// TAX BENEFIT CALCULATIONS
// ============================================================================

/**
 * Calculate tax benefits for home loan and education loan
 */
export function calculateTaxBenefits(input: TaxBenefitInput): TaxBenefitResult {
  const {
    loanType,
    principalAmount,
    interestRate,
    tenureMonths,
    financialYear,
    isFirstHomeLoan,
    isPropertyUnderConstruction,
    constructionCompletionYear,
    borrowerType,
    ownershipPercentage = 100,
    taxRegime,
    incomeSlabRate,
  } = input

  const schedule = generateAmortizationSchedule(principalAmount, interestRate, tenureMonths)
  const yearWiseBenefits: TaxBenefitResult['yearWiseBenefits'] = []
  const ownershipFactor = ownershipPercentage / 100

  // Initialize result structure
  const result: TaxBenefitResult = {
    section80C: {
      eligible: false,
      maxDeduction: 0,
      actualDeduction: 0,
      taxSaved: 0,
    },
    section24b: {
      eligible: false,
      maxDeduction: 0,
      actualDeduction: 0,
      taxSaved: 0,
    },
    totalTaxBenefit: 0,
    effectiveInterestRate: interestRate,
    yearWiseBenefits: [],
  }

  // Tax benefits only available under old regime
  if (taxRegime === 'new') {
    result.section24b.note = 'Tax benefits not available under new tax regime'
    return result
  }

  // Calculate year-wise benefits
  for (const yearSummary of schedule.summary.yearWiseSummary) {
    const principalDeduction = Math.min(
      yearSummary.totalPrincipal * ownershipFactor,
      TAX_DEDUCTION_LIMITS.section80C
    )

    let interestDeduction = 0
    if (loanType === 'home_loan') {
      const maxInterestDeduction = TAX_DEDUCTION_LIMITS.section24bSelfOccupied
      interestDeduction = Math.min(yearSummary.totalInterest * ownershipFactor, maxInterestDeduction)
    } else if (loanType === 'education_loan') {
      // No limit on education loan interest deduction under Section 80E
      interestDeduction = yearSummary.totalInterest * ownershipFactor
    }

    const taxSaved = ((principalDeduction + interestDeduction) * incomeSlabRate) / 100

    yearWiseBenefits.push({
      year: yearSummary.year,
      principalDeduction: roundToTwo(principalDeduction),
      interestDeduction: roundToTwo(interestDeduction),
      totalTaxSaved: roundToTwo(taxSaved),
    })
  }

  // Set Section 80C benefits (principal repayment for home loan)
  if (loanType === 'home_loan') {
    result.section80C.eligible = true
    result.section80C.maxDeduction = TAX_DEDUCTION_LIMITS.section80C
    result.section80C.actualDeduction = yearWiseBenefits[0]?.principalDeduction || 0
    result.section80C.taxSaved = (result.section80C.actualDeduction * incomeSlabRate) / 100

    result.section24b.eligible = true
    result.section24b.maxDeduction = TAX_DEDUCTION_LIMITS.section24bSelfOccupied
    result.section24b.actualDeduction = yearWiseBenefits[0]?.interestDeduction || 0
    result.section24b.taxSaved = (result.section24b.actualDeduction * incomeSlabRate) / 100

    // Section 80EE for first-time homebuyers
    if (isFirstHomeLoan && principalAmount <= 3500000) {
      result.section80EE = {
        eligible: true,
        maxDeduction: TAX_DEDUCTION_LIMITS.section80EE,
        actualDeduction: Math.min(
          schedule.summary.yearWiseSummary[0]?.totalInterest || 0,
          TAX_DEDUCTION_LIMITS.section80EE
        ),
        taxSaved: 0,
      }
      result.section80EE.taxSaved = (result.section80EE.actualDeduction * incomeSlabRate) / 100
    }

    // Section 80EEA for affordable housing
    if (isFirstHomeLoan && principalAmount <= 4500000) {
      result.section80EEA = {
        eligible: true,
        maxDeduction: TAX_DEDUCTION_LIMITS.section80EEA,
        actualDeduction: Math.min(
          (schedule.summary.yearWiseSummary[0]?.totalInterest || 0) -
            (result.section24b.actualDeduction || 0),
          TAX_DEDUCTION_LIMITS.section80EEA
        ),
        taxSaved: 0,
      }
      result.section80EEA.taxSaved = (result.section80EEA.actualDeduction * incomeSlabRate) / 100
    }
  }

  // Calculate total tax benefit
  result.totalTaxBenefit =
    result.section80C.taxSaved +
    result.section24b.taxSaved +
    (result.section80EE?.taxSaved || 0) +
    (result.section80EEA?.taxSaved || 0)

  // Calculate effective interest rate after tax benefit
  const firstYearInterest = schedule.summary.yearWiseSummary[0]?.totalInterest || 0
  const firstYearTaxSaved = yearWiseBenefits[0]?.totalTaxSaved || 0
  if (firstYearInterest > 0) {
    result.effectiveInterestRate = roundToTwo(
      ((firstYearInterest - firstYearTaxSaved) / principalAmount) * 100
    )
  }

  result.yearWiseBenefits = yearWiseBenefits

  return result
}

// ============================================================================
// LOAN COMPARISON
// ============================================================================

/**
 * Compare multiple loan scenarios
 */
export function compareLoanScenarios(scenarios: LoanScenario[]): LoanComparisonResult {
  // Calculate values for each scenario
  const calculatedScenarios = scenarios.map((scenario) => {
    const result = calculateEMIComplete({
      principalAmount: scenario.principalAmount,
      interestRate: scenario.interestRate,
      tenureMonths: scenario.tenureMonths,
      processingFeePercentage: scenario.processingFeePercentage,
      processingFeeFlat: scenario.processingFeeFlat,
      insurancePremium: scenario.insurancePremium,
      otherCharges: scenario.otherCharges,
    })

    return {
      ...scenario,
      monthlyEMI: result.monthlyEMI,
      totalInterest: result.totalInterest,
      totalAmount: result.totalAmount,
      totalCost: result.totalCostOfLoan,
      effectiveRate: result.effectiveInterestRate,
    }
  })

  // Find best scenarios
  const bestForLowestEMI = calculatedScenarios.reduce((best, current) =>
    (current.monthlyEMI || Infinity) < (best.monthlyEMI || Infinity) ? current : best
  ).id

  const bestForLowestInterest = calculatedScenarios.reduce((best, current) =>
    (current.totalInterest || Infinity) < (best.totalInterest || Infinity) ? current : best
  ).id

  const bestForLowestTotalCost = calculatedScenarios.reduce((best, current) =>
    (current.totalCost || Infinity) < (best.totalCost || Infinity) ? current : best
  ).id

  // Calculate savings between scenarios
  const savings: LoanComparisonResult['savings'] = []
  for (let i = 0; i < calculatedScenarios.length; i++) {
    for (let j = i + 1; j < calculatedScenarios.length; j++) {
      const s1 = calculatedScenarios[i]
      const s2 = calculatedScenarios[j]

      savings.push({
        fromScenarioId: s1.id,
        toScenarioId: s2.id,
        emiDifference: roundToTwo((s1.monthlyEMI || 0) - (s2.monthlyEMI || 0)),
        interestDifference: roundToTwo((s1.totalInterest || 0) - (s2.totalInterest || 0)),
        totalCostDifference: roundToTwo((s1.totalCost || 0) - (s2.totalCost || 0)),
      })
    }
  }

  return {
    scenarios: calculatedScenarios,
    bestForLowestEMI,
    bestForLowestInterest,
    bestForLowestTotalCost,
    savings,
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Round to 2 decimal places
 */
export function roundToTwo(num: number): number {
  return Math.round(num * 100) / 100
}

/**
 * Format currency in Indian format
 */
export function formatIndianCurrency(amount: number, showSymbol = true): string {
  const formatter = new Intl.NumberFormat('en-IN', {
    style: showSymbol ? 'currency' : 'decimal',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })

  return formatter.format(amount)
}

/**
 * Format number in Indian lakhs/crores
 */
export function formatIndianNumber(amount: number): string {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`
  } else if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)} L`
  } else if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(2)} K`
  }
  return formatIndianCurrency(amount)
}

/**
 * Calculate tenure in months from years and months
 */
export function calculateTenureMonths(years: number, months: number = 0): number {
  return years * 12 + months
}

/**
 * Format tenure for display
 */
export function formatTenure(months: number): string {
  const years = Math.floor(months / 12)
  const remainingMonths = months % 12

  if (years === 0) {
    return `${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`
  } else if (remainingMonths === 0) {
    return `${years} year${years !== 1 ? 's' : ''}`
  }
  return `${years}Y ${remainingMonths}M`
}

/**
 * Validate EMI calculation inputs
 */
export function validateEMIInputs(principal: number, rate: number, tenure: number): string[] {
  const errors: string[] = []

  if (!principal || principal <= 0) {
    errors.push('Principal amount must be greater than 0')
  }

  if (principal > 1000000000) {
    errors.push('Principal amount exceeds maximum limit')
  }

  if (rate < 0) {
    errors.push('Interest rate cannot be negative')
  }

  if (rate > 50) {
    errors.push('Interest rate seems unusually high')
  }

  if (!tenure || tenure <= 0) {
    errors.push('Tenure must be greater than 0')
  }

  if (tenure > 480) {
    errors.push('Tenure exceeds maximum 40 years')
  }

  return errors
}

/**
 * Sanitize numeric input
 */
export function sanitizeNumericInput(value: string): number {
  // Remove all non-numeric characters except decimal point
  const cleaned = value.replace(/[^0-9.]/g, '')
  // Handle multiple decimal points
  const parts = cleaned.split('.')
  if (parts.length > 2) {
    return parseFloat(parts[0] + '.' + parts.slice(1).join(''))
  }
  return parseFloat(cleaned) || 0
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}
