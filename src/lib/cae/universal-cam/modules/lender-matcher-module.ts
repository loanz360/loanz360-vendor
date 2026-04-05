/**
 * Lender Matcher Module
 * Matches customer profiles to best lenders from database
 * Core intelligence of Loanz360 platform
 */

import type {
  LenderRecommendation,
  ApplicantProfile,
  EmploymentIncome,
  CreditAnalysis,
  RiskAssessment,
} from '../types'
import { eligibilityCalculatorModule } from './eligibility-calculator-module'

interface Lender {
  id: string
  code: string
  name: string
  type: 'BANK' | 'NBFC' | 'HFC' | 'SMALL_FINANCE_BANK'
  logo_url?: string
  is_active: boolean
  supported_states?: string[]
  supported_cities?: string[]
}

interface LenderEligibilityRule {
  id: string
  lender_id: string
  loan_type: string
  is_active: boolean

  // Amount limits
  min_loan_amount: number
  max_loan_amount: number

  // Tenure limits
  min_tenure_months: number
  max_tenure_months: number

  // Credit criteria
  min_credit_score?: number
  max_credit_score?: number
  accept_ntc: boolean

  // Income criteria
  min_monthly_income: number
  employment_types: string[]

  // Age criteria
  min_age: number
  max_age: number

  // Risk criteria
  max_foir: number
  max_dti?: number
  max_ltv?: number

  // Rate and fees
  roi_min: number
  roi_max: number
  processing_fee_percent: number
  processing_fee_min?: number
  processing_fee_max?: number

  // Processing
  avg_processing_days: number
  fast_track_available: boolean
}

interface MatchingInput {
  applicant: ApplicantProfile
  employment: EmploymentIncome
  credit: CreditAnalysis
  risk: RiskAssessment
  loan_type: string
  requested_amount: number
  requested_tenure_months?: number
  collateral_value?: number
  preferred_lenders?: string[]
  location?: {
    state: string
    city?: string
  }
}

interface MatchResult {
  lender: Lender
  rule: LenderEligibilityRule
  match_score: number
  approval_probability: number
  eligible_amount: number
  interest_rate: number
  tenure_months: number
  emi: number
  matching_factors: LenderRecommendation['matching_factors']
  disqualification_reason?: string
}

export class LenderMatcherModule {
  /**
   * Find and rank lenders for given customer profile
   */
  async findMatches(
    input: MatchingInput,
    lenders: Lender[],
    rules: LenderEligibilityRule[],
    maxResults: number = 10
  ): Promise<LenderRecommendation[]> {
    const results: MatchResult[] = []

    // Filter active lenders with rules for this loan type
    const relevantRules = rules.filter(r =>
      r.is_active &&
      r.loan_type === input.loan_type
    )

    const lenderMap = new Map(lenders.filter(l => l.is_active).map(l => [l.id, l]))

    for (const rule of relevantRules) {
      const lender = lenderMap.get(rule.lender_id)
      if (!lender) continue

      // Check location eligibility
      if (input.location && !this.checkLocationEligibility(lender, input.location)) {
        continue
      }

      const matchResult = this.evaluateLenderMatch(input, lender, rule)
      if (matchResult) {
        results.push(matchResult)
      }
    }

    // Sort by match score and approval probability
    results.sort((a, b) => {
      // Prioritize eligible matches
      if (a.disqualification_reason && !b.disqualification_reason) return 1
      if (!a.disqualification_reason && b.disqualification_reason) return -1

      // Then by match score
      const scoreA = a.match_score * 0.6 + a.approval_probability * 0.4
      const scoreB = b.match_score * 0.6 + b.approval_probability * 0.4
      return scoreB - scoreA
    })

    // Take top results
    const topResults = results.slice(0, maxResults)

    // Build recommendations
    return topResults.map((result, index) => this.buildRecommendation(result, index + 1))
  }

  private checkLocationEligibility(lender: Lender, location: { state: string; city?: string }): boolean {
    // If no restrictions, lender operates everywhere
    if (!lender.supported_states || lender.supported_states.length === 0) {
      return true
    }

    const stateMatch = lender.supported_states.some(s =>
      s.toLowerCase() === location.state.toLowerCase() || s === '*'
    )

    if (!stateMatch) return false

    // Check city if specified
    if (location.city && lender.supported_cities && lender.supported_cities.length > 0) {
      return lender.supported_cities.some(c =>
        c.toLowerCase() === location.city!.toLowerCase() || c === '*'
      )
    }

    return true
  }

  private evaluateLenderMatch(
    input: MatchingInput,
    lender: Lender,
    rule: LenderEligibilityRule
  ): MatchResult | null {
    const factors: LenderRecommendation['matching_factors'] = {
      credit_score_match: false,
      income_match: false,
      age_match: false,
      location_match: true, // Already filtered
      loan_type_match: true, // Already filtered
      employment_match: false,
    }

    let matchScore = 0
    let disqualificationReason: string | undefined

    // 1. Credit Score Check
    const creditScore = input.credit.credit_score
    if (creditScore === null) {
      // NTC case
      if (!rule.accept_ntc) {
        disqualificationReason = 'Lender does not accept New-to-Credit applicants'
      } else {
        factors.credit_score_match = true
        matchScore += 10 // Reduced score for NTC
      }
    } else {
      if (rule.min_credit_score && creditScore < rule.min_credit_score) {
        disqualificationReason = `Credit score ${creditScore} below minimum ${rule.min_credit_score}`
      } else if (rule.max_credit_score && creditScore > rule.max_credit_score) {
        // Some lenders have max score for specific products
        disqualificationReason = `Credit score ${creditScore} above maximum ${rule.max_credit_score}`
      } else {
        factors.credit_score_match = true
        // Higher score = better match
        if (creditScore >= 750) matchScore += 25
        else if (creditScore >= 700) matchScore += 20
        else if (creditScore >= 650) matchScore += 15
        else matchScore += 10
      }
    }

    // 2. Income Check
    const monthlyIncome = input.employment.combined_income
    if (monthlyIncome < rule.min_monthly_income) {
      if (!disqualificationReason) {
        disqualificationReason = `Monthly income ₹${monthlyIncome.toLocaleString()} below minimum ₹${rule.min_monthly_income.toLocaleString()}`
      }
    } else {
      factors.income_match = true
      // Income multiplier bonus
      const incomeMultiple = monthlyIncome / rule.min_monthly_income
      if (incomeMultiple >= 3) matchScore += 20
      else if (incomeMultiple >= 2) matchScore += 15
      else matchScore += 10
    }

    // 3. Age Check
    const age = input.applicant.age
    if (age !== null) {
      if (age < rule.min_age) {
        if (!disqualificationReason) {
          disqualificationReason = `Age ${age} below minimum ${rule.min_age}`
        }
      } else if (age > rule.max_age) {
        if (!disqualificationReason) {
          disqualificationReason = `Age ${age} above maximum ${rule.max_age}`
        }
      } else {
        factors.age_match = true
        // Ideal age range bonus
        if (age >= 25 && age <= 55) matchScore += 10
        else matchScore += 5
      }
    } else {
      // Age unknown - assume mid-range
      factors.age_match = true
      matchScore += 5
    }

    // 4. Employment Type Check
    const employmentType = input.employment.employment_type
    if (rule.employment_types.length > 0) {
      const typeMatch = rule.employment_types.some(t =>
        t.toUpperCase() === employmentType ||
        t.toUpperCase() === 'ALL'
      )

      if (!typeMatch && !disqualificationReason) {
        disqualificationReason = `Employment type ${employmentType} not supported`
      } else if (typeMatch) {
        factors.employment_match = true
        matchScore += 10
      }
    } else {
      factors.employment_match = true
      matchScore += 10
    }

    // 5. Amount Check
    if (input.requested_amount < rule.min_loan_amount) {
      if (!disqualificationReason) {
        disqualificationReason = `Requested amount ₹${input.requested_amount.toLocaleString()} below minimum ₹${rule.min_loan_amount.toLocaleString()}`
      }
    } else if (input.requested_amount > rule.max_loan_amount) {
      if (!disqualificationReason) {
        disqualificationReason = `Requested amount ₹${input.requested_amount.toLocaleString()} above maximum ₹${rule.max_loan_amount.toLocaleString()}`
      }
    } else {
      matchScore += 10
    }

    // 6. Risk Grade Check
    if (input.risk.risk_grade === 'E') {
      if (!disqualificationReason) {
        disqualificationReason = 'Risk grade E not acceptable'
      }
    } else if (input.risk.risk_grade === 'D') {
      matchScore -= 10 // Penalty for high risk
    } else if (input.risk.risk_grade === 'A') {
      matchScore += 10 // Bonus for low risk
    }

    // Calculate eligible amount using eligibility calculator
    const eligibility = eligibilityCalculatorModule.calculate({
      requested_amount: input.requested_amount,
      requested_tenure_months: input.requested_tenure_months,
      loan_type: input.loan_type,
      employment: input.employment,
      credit: input.credit,
      collateral_value: input.collateral_value,
      lender_limits: {
        max_foir: rule.max_foir,
        max_dti: rule.max_dti,
        max_ltv: rule.max_ltv,
        max_loan_amount: rule.max_loan_amount,
        max_tenure_months: rule.max_tenure_months,
        interest_rate: (rule.roi_min + rule.roi_max) / 2,
      },
    })

    // Determine interest rate based on profile
    const interestRate = this.calculateInterestRate(input, rule)

    // Calculate tenure
    const tenure = Math.min(
      input.requested_tenure_months || rule.max_tenure_months,
      rule.max_tenure_months
    )

    // Calculate EMI
    const eligibleAmount = Math.min(eligibility.max_eligible_amount, rule.max_loan_amount)
    const emi = eligibilityCalculatorModule.calculateEMI(eligibleAmount, interestRate, tenure)

    // Calculate approval probability
    const approvalProbability = this.calculateApprovalProbability(input, rule, disqualificationReason)

    // Check preferred lender bonus
    if (input.preferred_lenders?.includes(lender.id) || input.preferred_lenders?.includes(lender.code)) {
      matchScore += 15
    }

    // Normalize match score to 0-100
    matchScore = Math.min(100, Math.max(0, matchScore))

    return {
      lender,
      rule,
      match_score: matchScore,
      approval_probability: approvalProbability,
      eligible_amount: eligibleAmount,
      interest_rate: interestRate,
      tenure_months: tenure,
      emi: Math.round(emi),
      matching_factors: factors,
      disqualification_reason: disqualificationReason,
    }
  }

  private calculateInterestRate(input: MatchingInput, rule: LenderEligibilityRule): number {
    // Base rate is midpoint of range
    let rate = (rule.roi_min + rule.roi_max) / 2

    // Adjust based on credit score
    const creditScore = input.credit.credit_score
    if (creditScore !== null) {
      if (creditScore >= 800) rate = rule.roi_min
      else if (creditScore >= 750) rate = rule.roi_min + (rule.roi_max - rule.roi_min) * 0.2
      else if (creditScore >= 700) rate = rule.roi_min + (rule.roi_max - rule.roi_min) * 0.4
      else if (creditScore >= 650) rate = rule.roi_min + (rule.roi_max - rule.roi_min) * 0.6
      else rate = rule.roi_min + (rule.roi_max - rule.roi_min) * 0.8
    } else {
      // NTC gets higher rate
      rate = rule.roi_min + (rule.roi_max - rule.roi_min) * 0.7
    }

    // Adjust based on employment
    if (input.employment.employment_type === 'SALARIED') {
      if (input.employment.salaried_details?.employer_category === 'CAT_A') {
        rate -= 0.25
      } else if (input.employment.salaried_details?.employer_category === 'CAT_B') {
        rate -= 0.15
      }
    }

    // Ensure within bounds
    rate = Math.max(rule.roi_min, Math.min(rule.roi_max, rate))

    return Math.round(rate * 100) / 100
  }

  private calculateApprovalProbability(
    input: MatchingInput,
    rule: LenderEligibilityRule,
    disqualificationReason?: string
  ): number {
    if (disqualificationReason) return 0

    let probability = 70 // Base probability

    // Credit score impact
    const creditScore = input.credit.credit_score
    if (creditScore !== null) {
      if (creditScore >= 750) probability += 20
      else if (creditScore >= 700) probability += 10
      else if (creditScore >= 650) probability += 0
      else probability -= 15
    } else {
      probability -= 10 // NTC
    }

    // Income cushion
    const incomeMultiple = input.employment.combined_income / rule.min_monthly_income
    if (incomeMultiple >= 2) probability += 10
    else if (incomeMultiple >= 1.5) probability += 5

    // Risk grade impact
    switch (input.risk.risk_grade) {
      case 'A': probability += 10; break
      case 'B': probability += 5; break
      case 'C': break
      case 'D': probability -= 15; break
      case 'E': probability -= 30; break
    }

    // Delinquency impact
    if (input.credit.has_write_offs) probability -= 30
    if (input.credit.has_settlements) probability -= 15
    if (input.credit.max_dpd_24_months >= 60) probability -= 20

    // Employment stability
    if (input.employment.income_stability_score >= 80) probability += 5
    else if (input.employment.income_stability_score < 50) probability -= 10

    // KYC status
    if (input.applicant.kyc_status === 'COMPLETE') probability += 5
    else if (input.applicant.kyc_status === 'PENDING') probability -= 10

    return Math.min(95, Math.max(5, probability))
  }

  private buildRecommendation(result: MatchResult, rank: number): LenderRecommendation {
    const processingFee = this.calculateProcessingFee(
      result.eligible_amount,
      result.rule.processing_fee_percent,
      result.rule.processing_fee_min,
      result.rule.processing_fee_max
    )

    return {
      rank,
      lender_id: result.lender.id,
      lender_code: result.lender.code,
      lender_name: result.lender.name,
      lender_type: result.lender.type,
      lender_logo_url: result.lender.logo_url || null,

      max_eligible_amount: result.eligible_amount,
      offered_interest_rate: result.interest_rate,
      offered_tenure_months: result.tenure_months,
      estimated_emi: result.emi,
      processing_fee: processingFee,
      processing_fee_percent: result.rule.processing_fee_percent,

      match_score: result.match_score,
      approval_probability: result.approval_probability,

      matching_factors: result.matching_factors,

      is_best_match: rank === 1,
      fast_track_eligible: result.rule.fast_track_available && result.match_score >= 80,
      pre_approved: result.approval_probability >= 90,

      avg_processing_days: result.rule.avg_processing_days,
    }
  }

  private calculateProcessingFee(
    amount: number,
    percent: number,
    min?: number,
    max?: number
  ): number {
    let fee = amount * (percent / 100)

    if (min && fee < min) fee = min
    if (max && fee > max) fee = max

    // Round to nearest 100
    return Math.round(fee / 100) * 100
  }

  /**
   * Get summary stats for all matched lenders
   */
  getSummary(recommendations: LenderRecommendation[]): {
    total_lenders: number
    eligible_lenders: number
    best_rate: number
    best_amount: number
    avg_approval_probability: number
    banks: number
    nbfcs: number
  } {
    const eligible = recommendations.filter(r => r.approval_probability > 0)

    return {
      total_lenders: recommendations.length,
      eligible_lenders: eligible.length,
      best_rate: eligible.length > 0
        ? Math.min(...eligible.map(r => r.offered_interest_rate))
        : 0,
      best_amount: eligible.length > 0
        ? Math.max(...eligible.map(r => r.max_eligible_amount))
        : 0,
      avg_approval_probability: eligible.length > 0
        ? Math.round(eligible.reduce((sum, r) => sum + r.approval_probability, 0) / eligible.length)
        : 0,
      banks: recommendations.filter(r => r.lender_type === 'BANK').length,
      nbfcs: recommendations.filter(r => ['NBFC', 'HFC'].includes(r.lender_type)).length,
    }
  }
}

export const lenderMatcherModule = new LenderMatcherModule()
