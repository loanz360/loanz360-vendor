/**
 * Universal CAM Module
 * Complete Credit Appraisal Memo generation system for Loanz360
 *
 * This module provides:
 * - 9-section comprehensive CAM generation
 * - Lender matching against 50+ banks/NBFCs
 * - Risk assessment and scoring
 * - Eligibility calculation
 * - Document status tracking
 * - Auto-assignment readiness
 */

// Types
export * from './types'

// Individual Modules
export {
  ApplicantProfileModule,
  applicantProfileModule,
} from './modules/applicant-profile-module'

export {
  EmploymentIncomeModule,
  employmentIncomeModule,
} from './modules/employment-income-module'

export {
  CreditAnalysisModule,
  creditAnalysisModule,
} from './modules/credit-analysis-module'

export {
  FinancialAnalysisModule,
  financialAnalysisModule,
} from './modules/financial-analysis-module'

export {
  RiskAssessmentModule,
  riskAssessmentModule,
} from './modules/risk-assessment-module'

export {
  EligibilityCalculatorModule,
  eligibilityCalculatorModule,
} from './modules/eligibility-calculator-module'

export {
  LenderMatcherModule,
  lenderMatcherModule,
} from './modules/lender-matcher-module'

// Main Generator
export {
  UniversalCAMGenerator,
  createUniversalCAMGenerator,
} from './modules/universal-cam-generator'
