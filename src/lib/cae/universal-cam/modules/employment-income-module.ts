/**
 * Employment & Income Module
 * Analyzes employment details and income from various verification sources
 */

import type { EmploymentIncome, SalariedDetails, BusinessDetails } from '../types'

interface GSTVerificationResult {
  gstin?: string
  legal_name?: string
  trade_name?: string
  registration_date?: string
  gst_status?: string
  filing_frequency?: string
  annual_turnover?: number
  monthly_turnovers?: { month: string; turnover: number }[]
  filing_status?: 'REGULAR' | 'IRREGULAR' | 'NOT_FILED'
  business_type?: string
  nature_of_business?: string
}

interface ITRVerificationResult {
  assessment_years?: string[]
  incomes?: { year: string; gross: number; net: number }[]
  filing_status?: 'FILED' | 'NOT_FILED' | 'PENDING'
  total_income_latest?: number
  business_income?: number
  salary_income?: number
  other_income?: number
  profession?: string
}

interface BankStatementAnalysis {
  salary_credits?: {
    employer_name?: string
    average_amount: number
    credits_found: number
    regularity_score: number
  }
  average_monthly_balance?: number
  average_monthly_inflows?: number
  average_monthly_outflows?: number
}

interface EmploymentData {
  employment_type?: string

  // Salaried
  employer_name?: string
  employer_type?: string
  designation?: string
  department?: string
  employee_id?: string
  industry?: string
  gross_salary?: number
  net_salary?: number
  basic_salary?: number
  hra?: number
  pf_contribution?: number
  total_experience_years?: number
  current_job_years?: number
  salary_credit_mode?: string

  // Business
  business_name?: string
  business_type?: string
  nature_of_business?: string
  registration_type?: string
  registration_number?: string
  date_of_incorporation?: string
  udyam_number?: string
  msme_category?: string
  annual_turnover?: number
  monthly_profit?: number

  // Income
  other_income?: number
  other_income_source?: string
  co_applicant_income?: number
}

// Employer categories mapping (Cat A = Top employers, Cat D = Others)
const CAT_A_EMPLOYERS = [
  'google', 'microsoft', 'amazon', 'apple', 'meta', 'facebook', 'tcs', 'infosys', 'wipro', 'hcl',
  'reliance', 'tata', 'hdfc', 'icici', 'sbi', 'kotak', 'axis', 'accenture', 'cognizant', 'tech mahindra',
  'deloitte', 'pwc', 'kpmg', 'ey', 'mckinsey', 'bcg', 'bain', 'goldman sachs', 'morgan stanley', 'jp morgan',
  'hsbc', 'citibank', 'barclays', 'deutsche bank', 'ubs', 'credit suisse', 'ibm', 'oracle', 'sap', 'salesforce'
]

const CAT_B_EMPLOYERS = [
  'larsen', 'toubro', 'l&t', 'mahindra', 'bajaj', 'birla', 'adani', 'godrej', 'vedanta', 'hindustan unilever',
  'nestle', 'itc', 'britannia', 'dabur', 'marico', 'asian paints', 'berger', 'pidilite', 'havells', 'polycab',
  'voltas', 'whirlpool', 'samsung', 'lg', 'sony', 'panasonic', 'philips', 'siemens', 'abb', 'honeywell'
]

export class EmploymentIncomeModule {
  /**
   * Build employment and income section from various data sources
   */
  build(
    employmentData: EmploymentData,
    gstResult?: GSTVerificationResult,
    itrResult?: ITRVerificationResult,
    bankAnalysis?: BankStatementAnalysis
  ): EmploymentIncome {
    const employmentType = this.normalizeEmploymentType(employmentData.employment_type)

    // Build type-specific details
    const salariedDetails = employmentType === 'SALARIED'
      ? this.buildSalariedDetails(employmentData, bankAnalysis)
      : null

    const businessDetails = ['SELF_EMPLOYED', 'BUSINESS'].includes(employmentType)
      ? this.buildBusinessDetails(employmentData, gstResult)
      : null

    // Calculate income values
    const grossMonthlyIncome = this.calculateGrossMonthlyIncome(employmentType, salariedDetails, businessDetails, employmentData)
    const netMonthlyIncome = this.calculateNetMonthlyIncome(employmentType, salariedDetails, businessDetails, employmentData)
    const otherIncome = employmentData.other_income || 0
    const totalMonthlyIncome = netMonthlyIncome + otherIncome
    const coApplicantIncome = employmentData.co_applicant_income || null
    const combinedIncome = totalMonthlyIncome + (coApplicantIncome || 0)

    // ITR analysis
    const itrAnalysis = this.analyzeITR(itrResult)

    // Determine income verification source and status
    const { incomeVerified, verificationSource } = this.determineIncomeVerification(
      employmentType,
      itrResult,
      gstResult,
      bankAnalysis,
      salariedDetails
    )

    // Calculate income stability score
    const incomeStabilityScore = this.calculateIncomeStability(
      employmentType,
      salariedDetails,
      businessDetails,
      bankAnalysis,
      itrResult
    )

    return {
      employment_type: employmentType,
      salaried_details: salariedDetails,
      business_details: businessDetails,

      gross_monthly_income: grossMonthlyIncome,
      net_monthly_income: netMonthlyIncome,
      other_income: otherIncome,
      other_income_source: employmentData.other_income_source || null,
      total_monthly_income: totalMonthlyIncome,
      annual_income: totalMonthlyIncome * 12,

      co_applicant_income: coApplicantIncome,
      combined_income: combinedIncome,

      income_verified: incomeVerified,
      income_verification_source: verificationSource,
      income_stability_score: incomeStabilityScore,

      itr_filed: itrAnalysis.filed,
      itr_years: itrAnalysis.years,
      itr_amounts: itrAnalysis.amounts,
      itr_average: itrAnalysis.average,
    }
  }

  private normalizeEmploymentType(type: string | undefined): EmploymentIncome['employment_type'] {
    if (!type) return 'OTHER'

    const normalized = type.toUpperCase().replace(/[\s_-]+/g, '_')

    if (normalized.includes('SALAR') || normalized.includes('EMPLOY')) return 'SALARIED'
    if (normalized.includes('SELF') || normalized.includes('FREELAN') || normalized.includes('CONSULT')) return 'SELF_EMPLOYED'
    if (normalized.includes('BUSINESS') || normalized.includes('PROPRIET') || normalized.includes('ENTREPRENEUR')) return 'BUSINESS'
    if (normalized.includes('RETIRE') || normalized.includes('PENSION')) return 'RETIRED'
    if (normalized.includes('HOUSE') || normalized.includes('HOME')) return 'HOUSEWIFE'
    if (normalized.includes('STUDENT')) return 'STUDENT'

    return 'OTHER'
  }

  private buildSalariedDetails(
    data: EmploymentData,
    bankAnalysis?: BankStatementAnalysis
  ): SalariedDetails {
    const grossSalary = data.gross_salary || bankAnalysis?.salary_credits?.average_amount || 0
    const netSalary = data.net_salary || grossSalary * 0.85 // Estimate 15% deductions if not provided

    const totalExperienceMonths = (data.total_experience_years || 0) * 12
    const currentJobMonths = (data.current_job_years || 0) * 12

    const employerName = data.employer_name || bankAnalysis?.salary_credits?.employer_name || 'Unknown'
    const employerType = this.normalizeEmployerType(data.employer_type)
    const employerCategory = this.categorizeEmployer(employerName, employerType)

    const jobStabilityScore = this.calculateJobStability(currentJobMonths, totalExperienceMonths, employerCategory)

    return {
      employer_name: employerName,
      employer_type: employerType,
      employer_category: employerCategory,
      industry: data.industry || null,
      designation: data.designation || null,
      department: data.department || null,
      employee_id: data.employee_id || null,

      total_experience_months: totalExperienceMonths,
      current_job_months: currentJobMonths,
      job_stability_score: jobStabilityScore,

      gross_salary: grossSalary,
      basic_salary: data.basic_salary || grossSalary * 0.4, // Estimate basic as 40% of gross
      hra: data.hra || grossSalary * 0.2, // Estimate HRA as 20% of gross
      special_allowance: grossSalary * 0.25, // Estimate
      pf_contribution: data.pf_contribution || grossSalary * 0.12 * 0.4, // 12% of basic
      net_salary: netSalary,
      salary_credit_mode: this.normalizeSalaryCreditMode(data.salary_credit_mode),
    }
  }

  private buildBusinessDetails(
    data: EmploymentData,
    gstResult?: GSTVerificationResult
  ): BusinessDetails {
    // Calculate business vintage
    let businessVintageMonths = 0
    const incorporationDate = data.date_of_incorporation || gstResult?.registration_date
    if (incorporationDate) {
      const incDate = new Date(incorporationDate)
      const today = new Date()
      businessVintageMonths = Math.floor((today.getTime() - incDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
    }

    // Use GST data if available
    const annualTurnover = gstResult?.annual_turnover || data.annual_turnover || null
    const avgMonthlyTurnover = annualTurnover ? annualTurnover / 12 : null

    const gstFilingStatus = gstResult?.filing_status ||
      (gstResult?.gstin ? 'REGULAR' : 'NOT_APPLICABLE')

    return {
      business_name: data.business_name || gstResult?.trade_name || gstResult?.legal_name || 'Unknown',
      business_type: this.normalizeBusinessType(data.business_type),
      industry: data.industry || null,
      nature_of_business: data.nature_of_business || gstResult?.nature_of_business || null,

      registration_type: data.registration_number ? 'REGISTERED' : 'UNREGISTERED',
      registration_number: data.registration_number || null,
      date_of_incorporation: incorporationDate || null,
      business_vintage_months: businessVintageMonths,

      gst_registered: !!gstResult?.gstin,
      gst_number: gstResult?.gstin || null,
      gst_filing_status: gstFilingStatus as BusinessDetails['gst_filing_status'],
      annual_turnover: annualTurnover,
      average_monthly_turnover: avgMonthlyTurnover,

      udyam_registered: !!data.udyam_number,
      udyam_number: data.udyam_number || null,
      msme_category: this.normalizeMSMECategory(data.msme_category),

      net_profit_margin: annualTurnover ? (data.monthly_profit ? (data.monthly_profit * 12 / annualTurnover * 100) : 10) : null,
      average_monthly_profit: data.monthly_profit || (avgMonthlyTurnover ? avgMonthlyTurnover * 0.1 : null), // Estimate 10% margin
    }
  }

  private normalizeEmployerType(type: string | undefined): SalariedDetails['employer_type'] {
    if (!type) return 'OTHER'

    const normalized = type.toUpperCase().replace(/[\s_-]+/g, '_')

    if (normalized.includes('GOVERNMENT') || normalized.includes('GOVT') || normalized.includes('CENTRAL') || normalized.includes('STATE')) return 'GOVERNMENT'
    if (normalized.includes('PSU') || normalized.includes('PUBLIC_SECTOR')) return 'PSU'
    if (normalized.includes('MNC') || normalized.includes('MULTI')) return 'MNC'
    if (normalized.includes('PRIVATE') && normalized.includes('LTD')) return 'PRIVATE_LTD'
    if (normalized.includes('PARTNER')) return 'PARTNERSHIP'
    if (normalized.includes('PROPRIET')) return 'PROPRIETORSHIP'
    if (normalized.includes('PRIVATE')) return 'PRIVATE_LTD'

    return 'OTHER'
  }

  private categorizeEmployer(name: string, type: SalariedDetails['employer_type']): SalariedDetails['employer_category'] {
    const nameLower = name.toLowerCase()

    // Government and PSU are always CAT_A
    if (type === 'GOVERNMENT' || type === 'PSU') return 'CAT_A'

    // Check against known employer lists
    if (CAT_A_EMPLOYERS.some(e => nameLower.includes(e))) return 'CAT_A'
    if (CAT_B_EMPLOYERS.some(e => nameLower.includes(e))) return 'CAT_B'

    // MNCs are typically CAT_B
    if (type === 'MNC') return 'CAT_B'

    // Private Ltd companies are CAT_C
    if (type === 'PRIVATE_LTD') return 'CAT_C'

    // Others are CAT_D
    return 'CAT_D'
  }

  private normalizeBusinessType(type: string | undefined): BusinessDetails['business_type'] {
    if (!type) return 'OTHER'

    const normalized = type.toUpperCase().replace(/[\s_-]+/g, '_')

    if (normalized.includes('PROPRIET')) return 'PROPRIETORSHIP'
    if (normalized.includes('LLP')) return 'LLP'
    if (normalized.includes('PRIVATE') && normalized.includes('LTD')) return 'PRIVATE_LTD'
    if (normalized.includes('PUBLIC') && normalized.includes('LTD')) return 'PUBLIC_LTD'
    if (normalized.includes('PARTNER')) return 'PARTNERSHIP'

    return 'OTHER'
  }

  private normalizeMSMECategory(category: string | undefined): BusinessDetails['msme_category'] {
    if (!category) return null

    const normalized = category.toUpperCase()

    if (normalized.includes('MICRO')) return 'MICRO'
    if (normalized.includes('SMALL')) return 'SMALL'
    if (normalized.includes('MEDIUM')) return 'MEDIUM'

    return null
  }

  private normalizeSalaryCreditMode(mode: string | undefined): SalariedDetails['salary_credit_mode'] {
    if (!mode) return 'BANK_TRANSFER'

    const normalized = mode.toUpperCase()

    if (normalized.includes('CHEQUE') || normalized.includes('CHECK')) return 'CHEQUE'
    if (normalized.includes('CASH')) return 'CASH'

    return 'BANK_TRANSFER'
  }

  private calculateGrossMonthlyIncome(
    type: EmploymentIncome['employment_type'],
    salaried: SalariedDetails | null,
    business: BusinessDetails | null,
    data: EmploymentData
  ): number {
    if (type === 'SALARIED' && salaried) {
      return salaried.gross_salary
    }

    if (['SELF_EMPLOYED', 'BUSINESS'].includes(type) && business) {
      // For business, use average monthly turnover or profit
      return business.average_monthly_profit ||
             (business.average_monthly_turnover ? business.average_monthly_turnover * 0.15 : 0) // Estimate 15% profit margin
    }

    return data.gross_salary || 0
  }

  private calculateNetMonthlyIncome(
    type: EmploymentIncome['employment_type'],
    salaried: SalariedDetails | null,
    business: BusinessDetails | null,
    data: EmploymentData
  ): number {
    if (type === 'SALARIED' && salaried) {
      return salaried.net_salary
    }

    if (['SELF_EMPLOYED', 'BUSINESS'].includes(type) && business) {
      return business.average_monthly_profit || 0
    }

    return data.net_salary || (data.gross_salary ? data.gross_salary * 0.85 : 0)
  }

  private calculateJobStability(
    currentJobMonths: number,
    totalExperienceMonths: number,
    employerCategory: SalariedDetails['employer_category']
  ): number {
    let score = 50 // Base score

    // Current job tenure (max +25)
    if (currentJobMonths >= 60) score += 25 // 5+ years
    else if (currentJobMonths >= 36) score += 20 // 3+ years
    else if (currentJobMonths >= 24) score += 15 // 2+ years
    else if (currentJobMonths >= 12) score += 10 // 1+ year
    else if (currentJobMonths >= 6) score += 5 // 6+ months
    else score -= 10 // Less than 6 months

    // Total experience (max +15)
    if (totalExperienceMonths >= 120) score += 15 // 10+ years
    else if (totalExperienceMonths >= 60) score += 10 // 5+ years
    else if (totalExperienceMonths >= 24) score += 5 // 2+ years

    // Employer category (max +10)
    switch (employerCategory) {
      case 'CAT_A': score += 10; break
      case 'CAT_B': score += 7; break
      case 'CAT_C': score += 4; break
      default: break
    }

    return Math.min(100, Math.max(0, score))
  }

  private analyzeITR(itrResult?: ITRVerificationResult): {
    filed: boolean
    years: number
    amounts: number[]
    average: number
  } {
    if (!itrResult || !itrResult.incomes || itrResult.incomes.length === 0) {
      return {
        filed: false,
        years: 0,
        amounts: [],
        average: 0,
      }
    }

    const amounts = itrResult.incomes.map(i => i.net || i.gross)
    const average = amounts.reduce((a, b) => a + b, 0) / amounts.length

    return {
      filed: true,
      years: itrResult.incomes.length,
      amounts,
      average,
    }
  }

  private determineIncomeVerification(
    type: EmploymentIncome['employment_type'],
    itrResult?: ITRVerificationResult,
    gstResult?: GSTVerificationResult,
    bankAnalysis?: BankStatementAnalysis,
    salariedDetails?: SalariedDetails | null
  ): {
    incomeVerified: boolean
    verificationSource: EmploymentIncome['income_verification_source']
  } {
    // Priority: ITR > GST > Bank Statement > Salary Slip > Self Declared

    // Check ITR
    if (itrResult?.incomes && itrResult.incomes.length > 0) {
      return { incomeVerified: true, verificationSource: 'ITR' }
    }

    // Check GST (for business)
    if (['SELF_EMPLOYED', 'BUSINESS'].includes(type) && gstResult?.annual_turnover) {
      return { incomeVerified: true, verificationSource: 'GST' }
    }

    // Check Bank Statement
    if (bankAnalysis?.salary_credits && bankAnalysis.salary_credits.regularity_score >= 70) {
      return { incomeVerified: true, verificationSource: 'BANK_STATEMENT' }
    }

    // Check Salary Slip (for salaried)
    if (type === 'SALARIED' && salariedDetails && salariedDetails.gross_salary > 0) {
      return { incomeVerified: true, verificationSource: 'SALARY_SLIP' }
    }

    return { incomeVerified: false, verificationSource: 'SELF_DECLARED' }
  }

  private calculateIncomeStability(
    type: EmploymentIncome['employment_type'],
    salaried?: SalariedDetails | null,
    business?: BusinessDetails | null,
    bankAnalysis?: BankStatementAnalysis,
    itrResult?: ITRVerificationResult
  ): number {
    let score = 50 // Base score

    // Job/Business stability
    if (type === 'SALARIED' && salaried) {
      score = Math.max(score, salaried.job_stability_score)
    } else if (business) {
      // Business vintage contributes to stability
      if (business.business_vintage_months >= 60) score += 20
      else if (business.business_vintage_months >= 36) score += 15
      else if (business.business_vintage_months >= 24) score += 10
      else if (business.business_vintage_months >= 12) score += 5

      // GST filing regularity
      if (business.gst_filing_status === 'REGULAR') score += 10
      else if (business.gst_filing_status === 'IRREGULAR') score -= 5
    }

    // Bank statement regularity
    if (bankAnalysis?.salary_credits) {
      const regularityBonus = Math.floor(bankAnalysis.salary_credits.regularity_score / 10)
      score += regularityBonus
    }

    // ITR filing consistency
    if (itrResult?.incomes && itrResult.incomes.length >= 2) {
      score += 10

      // Check if income is growing
      const amounts = itrResult.incomes.map(i => i.net || i.gross)
      const isGrowing = amounts.every((v, i) => i === 0 || v >= amounts[i - 1])
      if (isGrowing) score += 5
    }

    return Math.min(100, Math.max(0, score))
  }
}

export const employmentIncomeModule = new EmploymentIncomeModule()
