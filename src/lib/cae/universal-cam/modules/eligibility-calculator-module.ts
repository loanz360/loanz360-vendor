/**
 * Eligibility Calculator Module
 * Calculates loan eligibility based on income, obligations, and loan parameters
 */

import type { EligibilityCalculation, EmploymentIncome, CreditAnalysis } from '../types'

interface EligibilityInput {
  // Loan request
  requested_amount: number
  requested_tenure_months?: number
  loan_type: string

  // Income
  employment: EmploymentIncome

  // Credit obligations
  credit: CreditAnalysis

  // Collateral (for secured loans)
  collateral_value?: number

  // Lender-specific limits (optional, uses defaults otherwise)
  lender_limits?: {
    max_foir?: number // e.g., 50 means 50%
    max_dti?: number
    max_ltv?: number
    min_credit_score?: number
    max_loan_amount?: number
    max_tenure_months?: number
    interest_rate?: number
  }
}

// Default limits by loan type
const DEFAULT_LIMITS: Record<string, {
  max_foir: number
  max_dti: number
  max_ltv: number | null
  default_tenure: number
  default_rate: number
}> = {
  'HOME_LOAN': { max_foir: 50, max_dti: 60, max_ltv: 80, default_tenure: 240, default_rate: 8.5 },
  'PERSONAL_LOAN': { max_foir: 50, max_dti: 50, max_ltv: null, default_tenure: 60, default_rate: 12.0 },
  'BUSINESS_LOAN': { max_foir: 65, max_dti: 70, max_ltv: null, default_tenure: 84, default_rate: 14.0 },
  'LAP': { max_foir: 55, max_dti: 60, max_ltv: 65, default_tenure: 180, default_rate: 10.0 },
  'CAR_LOAN': { max_foir: 50, max_dti: 50, max_ltv: 85, default_tenure: 84, default_rate: 9.0 },
  'TWO_WHEELER': { max_foir: 50, max_dti: 50, max_ltv: 90, default_tenure: 48, default_rate: 12.0 },
  'GOLD_LOAN': { max_foir: 75, max_dti: 80, max_ltv: 75, default_tenure: 36, default_rate: 9.0 },
  'EDUCATION_LOAN': { max_foir: 50, max_dti: 50, max_ltv: null, default_tenure: 84, default_rate: 9.5 },
  'CONSUMER_DURABLE': { max_foir: 40, max_dti: 45, max_ltv: null, default_tenure: 24, default_rate: 13.0 },
}

export class EligibilityCalculatorModule {
  /**
   * Calculate comprehensive loan eligibility
   */
  calculate(input: EligibilityInput): EligibilityCalculation {
    const limits = this.getLimits(input.loan_type, input.lender_limits)
    const tenure = input.requested_tenure_months || limits.default_tenure
    const interestRate = input.lender_limits?.interest_rate || limits.default_rate

    // Calculate net monthly income
    const netMonthlyIncome = input.employment.combined_income

    // Calculate existing EMI obligations
    const existingEMI = input.credit.total_monthly_emi

    // Calculate FOIR (Fixed Obligation to Income Ratio)
    const currentFOIR = netMonthlyIncome > 0 ? (existingEMI / netMonthlyIncome) * 100 : 0

    // Calculate available income for new EMI
    const maxAllowedFOIR = limits.max_foir
    const maxAllowedNewEMI = netMonthlyIncome > 0
      ? (netMonthlyIncome * maxAllowedFOIR / 100) - existingEMI
      : 0
    const availableIncomeForEMI = Math.max(0, maxAllowedNewEMI)

    // Calculate maximum eligible amount based on EMI capacity
    const maxEligibleFromIncome = this.calculateMaxLoanFromEMI(
      availableIncomeForEMI,
      interestRate,
      tenure
    )

    // Calculate LTV-based limit (for secured loans)
    let maxEligibleFromLTV: number | null = null
    let ltv: number | null = null
    let ltvStatus: EligibilityCalculation['ltv_status'] = 'NOT_APPLICABLE'

    if (input.collateral_value && limits.max_ltv) {
      maxEligibleFromLTV = input.collateral_value * (limits.max_ltv / 100)
      ltv = input.requested_amount > 0
        ? (input.requested_amount / input.collateral_value) * 100
        : 0

      if (ltv <= limits.max_ltv * 0.9) ltvStatus = 'WITHIN_LIMIT'
      else if (ltv <= limits.max_ltv) ltvStatus = 'NEAR_LIMIT'
      else ltvStatus = 'EXCEEDED'
    }

    // Final maximum eligible amount
    let maxEligibleAmount = maxEligibleFromIncome
    if (maxEligibleFromLTV !== null) {
      maxEligibleAmount = Math.min(maxEligibleFromIncome, maxEligibleFromLTV)
    }
    if (input.lender_limits?.max_loan_amount) {
      maxEligibleAmount = Math.min(maxEligibleAmount, input.lender_limits.max_loan_amount)
    }

    // Round to nearest lakh for cleaner numbers
    maxEligibleAmount = Math.floor(maxEligibleAmount / 100000) * 100000

    // Determine recommended amount and terms
    const { recommendedAmount, recommendedTenure, recommendedRate } = this.calculateRecommendedTerms(
      input.requested_amount,
      maxEligibleAmount,
      tenure,
      interestRate,
      input.lender_limits?.max_tenure_months
    )

    // Calculate estimated EMI for recommended amount
    const estimatedEMI = this.calculateEMI(recommendedAmount, recommendedRate, recommendedTenure)

    // Calculate post-loan metrics
    const newTotalEMI = existingEMI + estimatedEMI
    const postLoanFOIR = netMonthlyIncome > 0 ? (newTotalEMI / netMonthlyIncome) * 100 : 0
    const postLoanDTI = this.calculateDTI(
      input.credit.total_outstanding + recommendedAmount,
      netMonthlyIncome * 12
    )
    const postLoanNetSurplus = netMonthlyIncome - newTotalEMI

    // Determine eligibility
    const { isEligible, eligibilityReasons, ineligibilityReasons } = this.determineEligibility(
      input,
      limits,
      maxEligibleAmount,
      postLoanFOIR,
      postLoanDTI
    )

    // FOIR status
    let foirStatus: EligibilityCalculation['foir_status']
    if (postLoanFOIR <= limits.max_foir * 0.9) foirStatus = 'WITHIN_LIMIT'
    else if (postLoanFOIR <= limits.max_foir) foirStatus = 'NEAR_LIMIT'
    else foirStatus = 'EXCEEDED'

    // DTI status
    const currentDTI = this.calculateDTI(input.credit.total_outstanding, netMonthlyIncome * 12)
    let dtiStatus: EligibilityCalculation['dti_status']
    if (postLoanDTI <= limits.max_dti * 0.9) dtiStatus = 'WITHIN_LIMIT'
    else if (postLoanDTI <= limits.max_dti) dtiStatus = 'NEAR_LIMIT'
    else dtiStatus = 'EXCEEDED'

    return {
      is_eligible: isEligible,
      eligibility_reasons: eligibilityReasons,
      ineligibility_reasons: ineligibilityReasons,

      foir: Math.round(currentFOIR * 10) / 10,
      foir_limit: limits.max_foir,
      foir_status: foirStatus,

      dti: Math.round(currentDTI * 10) / 10,
      dti_limit: limits.max_dti,
      dti_status: dtiStatus,

      ltv: ltv !== null ? Math.round(ltv * 10) / 10 : null,
      ltv_limit: limits.max_ltv,
      ltv_status: ltvStatus,

      net_monthly_income: netMonthlyIncome,
      existing_emi: existingEMI,
      max_allowed_new_emi: Math.round(availableIncomeForEMI),
      available_income_for_emi: Math.round(availableIncomeForEMI),

      requested_amount: input.requested_amount,
      max_eligible_amount: maxEligibleAmount,
      recommended_amount: recommendedAmount,
      recommended_tenure_months: recommendedTenure,
      recommended_interest_rate: recommendedRate,
      estimated_emi: Math.round(estimatedEMI),

      post_loan_foir: Math.round(postLoanFOIR * 10) / 10,
      post_loan_dti: Math.round(postLoanDTI * 10) / 10,
      post_loan_net_surplus: Math.round(postLoanNetSurplus),
    }
  }

  private getLimits(loanType: string, overrides?: EligibilityInput['lender_limits']) {
    const normalized = loanType.toUpperCase().replace(/[\s-]+/g, '_')
    const defaults = DEFAULT_LIMITS[normalized] || DEFAULT_LIMITS['PERSONAL_LOAN']

    return {
      max_foir: overrides?.max_foir || defaults.max_foir,
      max_dti: overrides?.max_dti || defaults.max_dti,
      max_ltv: overrides?.max_ltv || defaults.max_ltv,
      default_tenure: defaults.default_tenure,
      default_rate: defaults.default_rate,
    }
  }

  /**
   * Calculate EMI using standard formula
   * EMI = P × r × (1 + r)^n / ((1 + r)^n - 1)
   */
  calculateEMI(principal: number, annualRate: number, tenureMonths: number): number {
    if (principal <= 0 || tenureMonths <= 0) return 0
    if (annualRate <= 0) return principal / tenureMonths

    const monthlyRate = annualRate / 12 / 100
    const factor = Math.pow(1 + monthlyRate, tenureMonths)

    return (principal * monthlyRate * factor) / (factor - 1)
  }

  /**
   * Calculate maximum loan amount from available EMI
   * Reverse of EMI formula
   */
  private calculateMaxLoanFromEMI(
    availableEMI: number,
    annualRate: number,
    tenureMonths: number
  ): number {
    if (availableEMI <= 0 || tenureMonths <= 0) return 0
    if (annualRate <= 0) return availableEMI * tenureMonths

    const monthlyRate = annualRate / 12 / 100
    const factor = Math.pow(1 + monthlyRate, tenureMonths)

    return (availableEMI * (factor - 1)) / (monthlyRate * factor)
  }

  private calculateDTI(totalDebt: number, annualIncome: number): number {
    if (annualIncome <= 0) return 0
    return (totalDebt / annualIncome) * 100
  }

  private calculateRecommendedTerms(
    requestedAmount: number,
    maxEligible: number,
    requestedTenure: number,
    rate: number,
    maxTenure?: number
  ): {
    recommendedAmount: number
    recommendedTenure: number
    recommendedRate: number
  } {
    let recommendedAmount: number
    let recommendedTenure = requestedTenure

    if (requestedAmount <= maxEligible) {
      // Can provide full requested amount
      recommendedAmount = requestedAmount
    } else if (requestedAmount <= maxEligible * 1.2) {
      // Within 20% - recommend max eligible
      recommendedAmount = maxEligible
    } else {
      // Significantly higher - try longer tenure first
      if (maxTenure && requestedTenure < maxTenure) {
        const extendedTenure = Math.min(maxTenure, requestedTenure * 1.5)
        const extendedMax = this.calculateMaxLoanFromEMI(
          maxEligible * rate / 12 / 100 * Math.pow(1 + rate / 12 / 100, requestedTenure) /
          (Math.pow(1 + rate / 12 / 100, requestedTenure) - 1),
          rate,
          extendedTenure
        )

        if (extendedMax >= requestedAmount) {
          recommendedAmount = requestedAmount
          recommendedTenure = Math.ceil(extendedTenure)
        } else {
          recommendedAmount = maxEligible
        }
      } else {
        recommendedAmount = maxEligible
      }
    }

    // Round amount to nearest lakh
    recommendedAmount = Math.floor(recommendedAmount / 100000) * 100000

    return {
      recommendedAmount,
      recommendedTenure,
      recommendedRate: rate,
    }
  }

  private determineEligibility(
    input: EligibilityInput,
    limits: ReturnType<typeof this.getLimits>,
    maxEligible: number,
    postLoanFOIR: number,
    postLoanDTI: number
  ): {
    isEligible: boolean
    eligibilityReasons: string[]
    ineligibilityReasons: string[]
  } {
    const eligibilityReasons: string[] = []
    const ineligibilityReasons: string[] = []

    // Check minimum criteria
    const minCreditScore = input.lender_limits?.min_credit_score || 600

    // Income check
    if (input.employment.combined_income >= 25000) {
      eligibilityReasons.push(`Monthly income ₹${input.employment.combined_income.toLocaleString()} meets minimum criteria`)
    } else {
      ineligibilityReasons.push(`Monthly income ₹${input.employment.combined_income.toLocaleString()} below minimum ₹25,000`)
    }

    // Credit score check
    if (input.credit.credit_score === null) {
      // NTC - may or may not be eligible depending on lender
      eligibilityReasons.push('New to credit - limited credit history products available')
    } else if (input.credit.credit_score >= minCreditScore) {
      eligibilityReasons.push(`Credit score ${input.credit.credit_score} meets criteria`)
    } else {
      ineligibilityReasons.push(`Credit score ${input.credit.credit_score} below minimum ${minCreditScore}`)
    }

    // FOIR check
    if (postLoanFOIR <= limits.max_foir) {
      eligibilityReasons.push(`FOIR ${postLoanFOIR.toFixed(1)}% within limit of ${limits.max_foir}%`)
    } else {
      ineligibilityReasons.push(`FOIR ${postLoanFOIR.toFixed(1)}% exceeds limit of ${limits.max_foir}%`)
    }

    // DTI check (if significant debt)
    if (input.credit.total_outstanding > 0) {
      if (postLoanDTI <= limits.max_dti) {
        eligibilityReasons.push(`DTI ${postLoanDTI.toFixed(1)}% within limit`)
      } else {
        ineligibilityReasons.push(`DTI ${postLoanDTI.toFixed(1)}% exceeds limit of ${limits.max_dti}%`)
      }
    }

    // Amount eligibility
    if (maxEligible >= input.requested_amount) {
      eligibilityReasons.push(`Eligible for requested amount ₹${input.requested_amount.toLocaleString()}`)
    } else if (maxEligible >= input.requested_amount * 0.8) {
      eligibilityReasons.push(`Eligible for ₹${maxEligible.toLocaleString()} (${Math.round(maxEligible / input.requested_amount * 100)}% of requested)`)
    } else if (maxEligible > 0) {
      ineligibilityReasons.push(`Maximum eligible ₹${maxEligible.toLocaleString()} significantly below requested ₹${input.requested_amount.toLocaleString()}`)
    } else {
      ineligibilityReasons.push('No eligibility based on current income and obligations')
    }

    // Write-offs/settlements
    if (input.credit.has_write_offs) {
      ineligibilityReasons.push('Written off accounts in credit history')
    }
    if (input.credit.max_dpd_24_months >= 90) {
      ineligibilityReasons.push('Severe delinquency (90+ DPD) in last 24 months')
    }

    // Employment stability
    if (input.employment.income_stability_score >= 70) {
      eligibilityReasons.push('Good income stability')
    } else if (input.employment.income_stability_score < 40) {
      ineligibilityReasons.push('Low income stability')
    }

    // Determine overall eligibility
    const isEligible =
      ineligibilityReasons.length === 0 ||
      (maxEligible >= input.requested_amount * 0.7 && !input.credit.has_write_offs)

    return { isEligible, eligibilityReasons, ineligibilityReasons }
  }

  /**
   * Calculate eligibility for multiple amounts/tenures
   * Useful for showing options to BDE
   */
  calculateScenarios(input: EligibilityInput): Array<{
    amount: number
    tenure_months: number
    emi: number
    foir: number
    eligible: boolean
  }> {
    const scenarios: Array<{
      amount: number
      tenure_months: number
      emi: number
      foir: number
      eligible: boolean
    }> = []

    const limits = this.getLimits(input.loan_type, input.lender_limits)
    const rate = input.lender_limits?.interest_rate || limits.default_rate

    // Amount variations
    const amounts = [
      Math.floor(input.requested_amount * 0.5 / 100000) * 100000,
      Math.floor(input.requested_amount * 0.75 / 100000) * 100000,
      input.requested_amount,
      Math.floor(input.requested_amount * 1.25 / 100000) * 100000,
    ].filter(a => a > 0)

    // Tenure variations
    const tenures = [
      limits.default_tenure * 0.5,
      limits.default_tenure,
      Math.min(limits.default_tenure * 1.5, input.lender_limits?.max_tenure_months || 360),
    ].filter(t => t > 0)

    const netIncome = input.employment.combined_income
    const existingEMI = input.credit.total_monthly_emi

    for (const amount of amounts) {
      for (const tenure of tenures) {
        const emi = this.calculateEMI(amount, rate, tenure)
        const totalEMI = existingEMI + emi
        const foir = netIncome > 0 ? (totalEMI / netIncome) * 100 : 100
        const eligible = foir <= limits.max_foir

        scenarios.push({
          amount,
          tenure_months: Math.round(tenure),
          emi: Math.round(emi),
          foir: Math.round(foir * 10) / 10,
          eligible,
        })
      }
    }

    return scenarios.sort((a, b) => {
      // Sort by eligibility first, then by amount descending
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1
      return b.amount - a.amount
    })
  }
}

export const eligibilityCalculatorModule = new EligibilityCalculatorModule()
