/**
 * EMI Calculator Types - Enterprise-grade Financial Calculator System
 *
 * Comprehensive type definitions for the EMI Calculator module
 * supporting loan calculations, comparisons, and financial planning
 */

// ============================================================================
// CORE EMI TYPES
// ============================================================================

/**
 * Loan types supported by the EMI Calculator
 */
export type LoanType =
  | 'home_loan'
  | 'personal_loan'
  | 'car_loan'
  | 'business_loan'
  | 'education_loan'
  | 'gold_loan'
  | 'loan_against_property'
  | 'two_wheeler_loan'
  | 'consumer_durable_loan'
  | 'overdraft'

/**
 * Tenure unit type
 */
export type TenureType = 'months' | 'years'

/**
 * Interest calculation method
 */
export type InterestCalculationMethod =
  | 'reducing_balance_monthly'
  | 'reducing_balance_yearly'
  | 'reducing_balance_daily'
  | 'flat_rate'

/**
 * Customer income range categories
 */
export type IncomeRange =
  | 'below_3L'
  | '3L_5L'
  | '5L_10L'
  | '10L_15L'
  | '15L_25L'
  | '25L_50L'
  | 'above_50L'

/**
 * Credit score range categories
 */
export type CreditScoreRange =
  | 'poor' // 300-549
  | 'fair' // 550-649
  | 'good' // 650-749
  | 'very_good' // 750-799
  | 'excellent' // 800-900

/**
 * Inquiry status workflow
 */
export type InquiryStatus =
  | 'inquiry'
  | 'shared'
  | 'interested'
  | 'lead_created'
  | 'application_started'
  | 'application_submitted'
  | 'under_review'
  | 'approved'
  | 'disbursed'
  | 'lost'
  | 'on_hold'

/**
 * Follow-up outcome types
 */
export type FollowUpOutcome = 'positive' | 'negative' | 'neutral' | 'converted' | 'callback_requested'

/**
 * Share method types
 */
export type ShareMethod = 'whatsapp' | 'email' | 'sms' | 'link'

// ============================================================================
// EMI CALCULATION INTERFACES
// ============================================================================

/**
 * Input parameters for EMI calculation
 */
export interface EMICalculationInput {
  principalAmount: number
  interestRate: number // Annual interest rate in percentage
  tenureMonths: number
  calculationMethod?: InterestCalculationMethod
  processingFeePercentage?: number
  processingFeeFlat?: number
  insurancePremium?: number
  otherCharges?: number
  /**
   * Promotional "No-Cost EMI" scheme flag (typical of retailer/appliance
   * partnerships where the bank absorbs interest and the merchant covers fees).
   * When true AND interestRate is 0, processing fee / insurance / other charges
   * are overridden to 0 in the result — matching the customer-facing promise.
   * Default: false (normal loans pay fees even at 0% promotional rate).
   */
  isPromoNoCostEmi?: boolean
}

/**
 * EMI calculation result
 */
export interface EMICalculationResult {
  monthlyEMI: number
  totalInterest: number
  totalAmount: number
  principalAmount: number
  interestRate: number
  tenureMonths: number
  effectiveInterestRate?: number // APR including all fees
  processingFee?: number
  totalCostOfLoan?: number // Principal + Interest + All Fees
  /**
   * Average true monthly burden = totalCostOfLoan / tenureMonths.
   * Differs from monthlyEMI when there are upfront fees / insurance — useful
   * for transparent customer disclosure ("your EMI is X, your real monthly
   * equivalent cost including fees is Y").
   */
  amortizedMonthlyCost?: number
}

/**
 * Amortization schedule row
 */
export interface AmortizationRow {
  month: number
  year: number
  emi: number
  principalPaid: number
  interestPaid: number
  balance: number
  cumulativePrincipal: number
  cumulativeInterest: number
  paymentDate?: string
}

/**
 * Full amortization schedule
 */
export interface AmortizationSchedule {
  rows: AmortizationRow[]
  summary: {
    totalEMIPaid: number
    totalPrincipalPaid: number
    totalInterestPaid: number
    yearWiseSummary: YearWiseSummary[]
  }
}

/**
 * Year-wise payment summary
 */
export interface YearWiseSummary {
  year: number
  totalEMI: number
  totalPrincipal: number
  totalInterest: number
  openingBalance: number
  closingBalance: number
}

// ============================================================================
// PREPAYMENT CALCULATION INTERFACES
// ============================================================================

/**
 * Prepayment calculation input
 */
export interface PrepaymentInput {
  currentOutstanding: number
  currentEMI: number
  remainingTenureMonths: number
  interestRate: number
  prepaymentAmount: number
  prepaymentType: 'reduce_emi' | 'reduce_tenure'
  prepaymentMonth?: number // Month number when prepayment is made
}

/**
 * Prepayment calculation result
 */
export interface PrepaymentResult {
  newEMI: number
  newTenureMonths: number
  interestSaved: number
  newTotalInterest: number
  tenureReduction: number
  emiReduction: number
  effectiveDate?: string
  revisedSchedule?: AmortizationRow[]
}

/**
 * Multiple prepayments scenario
 */
export interface PrepaymentScenario {
  id: string
  name: string
  prepayments: {
    month: number
    amount: number
    type: 'reduce_emi' | 'reduce_tenure'
  }[]
  totalPrepayment: number
  totalInterestSaved: number
  finalTenureMonths: number
  finalEMI: number
}

// ============================================================================
// LOAN COMPARISON INTERFACES
// ============================================================================

/**
 * Single loan scenario for comparison
 */
export interface LoanScenario {
  id: string
  name: string
  bankName?: string
  loanType: LoanType
  principalAmount: number
  interestRate: number
  tenureMonths: number
  processingFeePercentage: number
  processingFeeFlat: number
  insuranceRequired: boolean
  insurancePremium: number
  otherCharges: number
  // Calculated fields
  monthlyEMI?: number
  totalInterest?: number
  totalAmount?: number
  totalCost?: number // Including all fees
  effectiveRate?: number
}

/**
 * Comparison result between scenarios
 */
export interface LoanComparisonResult {
  scenarios: LoanScenario[]
  bestForLowestEMI: string // scenario id
  bestForLowestInterest: string
  bestForLowestTotalCost: string
  savings: {
    fromScenarioId: string
    toScenarioId: string
    emiDifference: number
    interestDifference: number
    totalCostDifference: number
  }[]
}

// ============================================================================
// ELIGIBILITY CALCULATION INTERFACES
// ============================================================================

/**
 * Eligibility calculation input
 */
export interface EligibilityInput {
  monthlyIncome: number
  existingEMIs: number
  age: number
  retirementAge?: number // Default 60
  loanType: LoanType
  interestRate: number
  maxFOIR?: number // Fixed Obligation to Income Ratio (default 50%)
  maxLTV?: number // Loan to Value ratio for secured loans
  propertyValue?: number // For home loan / LAP
  creditScore?: CreditScoreRange
  employmentType: 'salaried' | 'self_employed' | 'professional'
  employerCategory?: 'government' | 'psu' | 'mnc' | 'private' | 'startup'
}

/**
 * Eligibility calculation result
 */
export interface EligibilityResult {
  maxLoanAmount: number
  maxEMIAffordable: number
  maxTenureMonths: number
  suggestedLoanAmount: number
  suggestedTenure: number
  suggestedEMI: number
  foirUsed: number
  availableFOIR: number
  factors: {
    incomeBasedMax: number
    ageBasedMax: number
    ltvBasedMax?: number
    creditScoreImpact: string
  }
  recommendations: string[]
  warnings: string[]
}

// ============================================================================
// TAX BENEFIT CALCULATION INTERFACES
// ============================================================================

/**
 * Tax benefit calculation input
 */
export interface TaxBenefitInput {
  loanType: LoanType
  principalAmount: number
  interestRate: number
  tenureMonths: number
  financialYear: string
  isFirstHomeLoan: boolean
  isPropertyUnderConstruction: boolean
  constructionCompletionYear?: number
  borrowerType: 'individual' | 'co_borrower'
  ownershipPercentage?: number // For co-borrowers
  taxRegime: 'old' | 'new'
  incomeSlabRate: number // 5, 10, 15, 20, 30
}

/**
 * Tax benefit calculation result
 */
export interface TaxBenefitResult {
  section80C: {
    eligible: boolean
    maxDeduction: number
    actualDeduction: number
    taxSaved: number
  }
  section24b: {
    eligible: boolean
    maxDeduction: number
    actualDeduction: number
    taxSaved: number
    note?: string
  }
  section80EE?: {
    eligible: boolean
    maxDeduction: number
    actualDeduction: number
    taxSaved: number
  }
  section80EEA?: {
    eligible: boolean
    maxDeduction: number
    actualDeduction: number
    taxSaved: number
  }
  totalTaxBenefit: number
  effectiveInterestRate: number // After tax benefit
  yearWiseBenefits: {
    year: number
    principalDeduction: number
    interestDeduction: number
    totalTaxSaved: number
  }[]
}

// ============================================================================
// CUSTOMER INQUIRY INTERFACES
// ============================================================================

/**
 * Customer information for inquiry
 */
export interface CustomerInfo {
  name?: string
  phone?: string
  email?: string
  incomeRange?: IncomeRange
  creditScoreRange?: CreditScoreRange
  occupation?: string
  company?: string
  city?: string
}

/**
 * EMI Inquiry record
 */
export interface EMIInquiry {
  id: string
  inquiryNumber: string
  createdByEmployeeId: string
  employeeName: string
  employeeRole: string
  employeeCode?: string
  employeeDepartment?: string

  // Customer details
  customer: CustomerInfo

  // Loan details
  loanType: LoanType
  principalAmount: number
  interestRate: number
  tenureMonths: number

  // Calculated values
  monthlyEMI: number
  totalInterest: number
  totalAmount: number

  // CRM fields
  customerRequirements?: string
  customerConcerns?: string
  internalNotes?: string
  status: InquiryStatus
  hotLead: boolean
  tags: string[]

  // Follow-up
  nextFollowUpDate?: string
  followUpPriority?: 'low' | 'medium' | 'high' | 'urgent'
  lastActivityAt?: string

  // Competition tracking
  competitorName?: string
  competitorRateOffered?: number
  lostReason?: string

  // Conversion tracking
  leadId?: string
  loanApplicationId?: string
  estimatedCommission?: number
  probabilityScore?: number

  // Sharing
  sharedVia: ShareMethod[]
  totalShares: number
  totalViews: number

  // Metadata
  inquirySource: string
  meetingType: 'online' | 'offline' | 'call'
  customerConsentGiven: boolean
  dataRetentionUntil: string
  archivedAt?: string

  // Timestamps
  createdAt: string
  updatedAt: string
}

/**
 * Inquiry share record
 */
export interface InquiryShare {
  id: string
  inquiryId: string
  sharedByEmployeeId: string
  shareMethod: ShareMethod
  recipientPhone?: string
  recipientEmail?: string
  recipientName?: string
  customMessage?: string
  includeAmortization: boolean
  includeComparison: boolean
  shareToken: string
  shareLink: string
  linkExpiresAt: string
  deliveryStatus: 'pending' | 'sent' | 'delivered' | 'failed' | 'opened'
  deliveryTimestamp?: string
  openedAt?: string
  viewCount: number
  createdAt: string
}

/**
 * Follow-up record
 */
export interface InquiryFollowUp {
  id: string
  inquiryId: string
  followedUpByEmployeeId: string
  followUpType: 'initial_call' | 'follow_up' | 'document_collection' | 'meeting' | 'closure'
  contactMethod: 'call' | 'whatsapp' | 'email' | 'in_person' | 'video_call'
  callDurationSeconds?: number
  conversationSummary?: string
  customerResponse?: string
  customerInterestLevel?: 'very_high' | 'high' | 'medium' | 'low' | 'not_interested'
  customerConcerns?: string
  actionTaken?: string
  nextActionRequired?: string
  nextFollowUpScheduledAt?: string
  outcome?: FollowUpOutcome
  competitorMentioned?: string
  competitorRateOffered?: number
  reminderSet: boolean
  createdAt: string
}

/**
 * Audit log entry
 */
export interface InquiryAuditLog {
  id: string
  inquiryId: string
  actionType: string
  actionByEmployeeId: string
  actionMetadata: Record<string, unknown>
  createdAt: string
}

// ============================================================================
// ANALYTICS INTERFACES
// ============================================================================

/**
 * EMI Calculator statistics
 */
export interface EMIStats {
  periodDays: number
  overview: {
    totalInquiries: number
    inquiriesInPeriod: number
    hotLeads: number
    followUpsDueToday: number
    followUpsDueThisWeek: number
  }
  statusBreakdown: Record<InquiryStatus, number>
  sharing: {
    totalShares: number
    sharesInPeriod: number
    totalViews: number
    shareViewRate: number
    openedShares: number
  }
  conversions: {
    convertedToLeads: number
    convertedToApplications: number
    approvedLoans: number
    inquiryToLeadRate: number
    inquiryToApplicationRate: number
    inquiryToApprovalRate: number
  }
  loanTypes: Record<LoanType, number>
  financialMetrics: {
    totalLoanAmountInquiries: number
    totalLoanAmountDisbursed: number
    averageInquiryAmount: number
    averageInterestRate: number
    averageTenureMonths: number
  }
  recentInquiries: Array<{
    id: string
    inquiryNumber: string
    customerName?: string
    principalAmount: number
    status: InquiryStatus
    createdAt: string
  }>
}

// ============================================================================
// FORM VALIDATION INTERFACES
// ============================================================================

/**
 * Validation error structure
 */
export interface EMIValidationErrors {
  principal?: string
  interestRate?: string
  tenure?: string
  loanType?: string
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  submit?: string
  prepayment?: string
}

/**
 * Phone validation result
 */
export interface PhoneValidationResult {
  isValid: boolean
  formatted: string
  error?: string
  countryCode?: string
  nationalNumber?: string
}

// ============================================================================
// CALCULATION HISTORY INTERFACES
// ============================================================================

/**
 * Stored calculation for history
 */
export interface EMICalculationHistory {
  id: string
  principal: number
  interestRate: number
  tenure: number
  tenureType: TenureType
  loanType: LoanType
  emi: number
  totalInterest: number
  totalAmount: number
  timestamp: string
  notes?: string
}

// ============================================================================
// COMPONENT PROPS INTERFACES
// ============================================================================

/**
 * EMI Calculator component props
 */
export interface EMICalculatorProps {
  variant?: 'basic' | 'advanced' | 'employee'
  defaultLoanType?: LoanType
  defaultValues?: Partial<EMICalculationInput>
  showHistory?: boolean
  showTerminology?: boolean
  showComparison?: boolean
  showPrepayment?: boolean
  showTaxBenefit?: boolean
  showEligibility?: boolean
  onCalculate?: (result: EMICalculationResult) => void
  onSave?: (inquiry: Partial<EMIInquiry>) => Promise<void>
  onShare?: (method: ShareMethod, data: EMICalculationResult) => Promise<void>
  className?: string
}

/**
 * Amortization table component props
 */
export interface AmortizationTableProps {
  schedule: AmortizationRow[]
  showYearSeparators?: boolean
  highlightPrepayments?: number[] // Month numbers with prepayments
  maxVisibleRows?: number
  showPagination?: boolean
  className?: string
}

/**
 * EMI comparison component props
 */
export interface EMIComparisonProps {
  scenarios: LoanScenario[]
  onAddScenario?: (scenario: LoanScenario) => void
  onRemoveScenario?: (id: string) => void
  onUpdateScenario?: (id: string, updates: Partial<LoanScenario>) => void
  maxScenarios?: number
  className?: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Loan type configurations
 */
export const LOAN_TYPE_CONFIG: Record<
  LoanType,
  {
    label: string
    shortLabel: string
    icon: string
    minTenure: number // months
    maxTenure: number // months
    minRate: number // percentage
    maxRate: number // percentage
    minAmount: number
    maxAmount: number
    processingFeeRange: [number, number] // percentage
    hasCollateral: boolean
    taxBenefitEligible: boolean
  }
> = {
  home_loan: {
    label: 'Home Loan',
    shortLabel: 'Home',
    icon: 'Home',
    minTenure: 12,
    maxTenure: 360,
    minRate: 7.0,
    maxRate: 15.0,
    minAmount: 100000,
    maxAmount: 100000000,
    processingFeeRange: [0.25, 1.0],
    hasCollateral: true,
    taxBenefitEligible: true,
  },
  personal_loan: {
    label: 'Personal Loan',
    shortLabel: 'Personal',
    icon: 'User',
    minTenure: 12,
    maxTenure: 84,
    minRate: 10.0,
    maxRate: 24.0,
    minAmount: 25000,
    maxAmount: 4000000,
    processingFeeRange: [1.0, 3.0],
    hasCollateral: false,
    taxBenefitEligible: false,
  },
  car_loan: {
    label: 'Car Loan / Vehicle Loan',
    shortLabel: 'Car',
    icon: 'Car',
    minTenure: 12,
    maxTenure: 84,
    minRate: 7.0,
    maxRate: 14.0,
    minAmount: 100000,
    maxAmount: 10000000,
    processingFeeRange: [0.5, 2.0],
    hasCollateral: true,
    taxBenefitEligible: false,
  },
  business_loan: {
    label: 'Business Loan',
    shortLabel: 'Business',
    icon: 'Briefcase',
    minTenure: 12,
    maxTenure: 60,
    minRate: 11.0,
    maxRate: 24.0,
    minAmount: 50000,
    maxAmount: 20000000,
    processingFeeRange: [1.0, 3.0],
    hasCollateral: false,
    taxBenefitEligible: false,
  },
  education_loan: {
    label: 'Education Loan',
    shortLabel: 'Education',
    icon: 'GraduationCap',
    minTenure: 36,
    maxTenure: 180,
    minRate: 8.0,
    maxRate: 14.0,
    minAmount: 50000,
    maxAmount: 7500000,
    processingFeeRange: [0, 1.0],
    hasCollateral: false,
    taxBenefitEligible: true,
  },
  gold_loan: {
    label: 'Gold Loan',
    shortLabel: 'Gold',
    icon: 'Gem',
    minTenure: 3,
    maxTenure: 36,
    minRate: 7.0,
    maxRate: 14.0,
    minAmount: 10000,
    maxAmount: 5000000,
    processingFeeRange: [0.5, 1.5],
    hasCollateral: true,
    taxBenefitEligible: false,
  },
  loan_against_property: {
    label: 'Loan Against Property',
    shortLabel: 'LAP',
    icon: 'Building',
    minTenure: 12,
    maxTenure: 180,
    minRate: 9.0,
    maxRate: 16.0,
    minAmount: 500000,
    maxAmount: 50000000,
    processingFeeRange: [0.5, 1.5],
    hasCollateral: true,
    taxBenefitEligible: false,
  },
  two_wheeler_loan: {
    label: 'Two Wheeler Loan',
    shortLabel: 'Two Wheeler',
    icon: 'Bike',
    minTenure: 6,
    maxTenure: 48,
    minRate: 8.0,
    maxRate: 18.0,
    minAmount: 20000,
    maxAmount: 500000,
    processingFeeRange: [1.0, 3.0],
    hasCollateral: true,
    taxBenefitEligible: false,
  },
  consumer_durable_loan: {
    label: 'Consumer Durable Loan',
    shortLabel: 'Consumer',
    icon: 'Tv',
    minTenure: 3,
    maxTenure: 24,
    minRate: 0,
    maxRate: 24.0,
    minAmount: 5000,
    maxAmount: 500000,
    processingFeeRange: [0, 2.0],
    hasCollateral: false,
    taxBenefitEligible: false,
  },
  overdraft: {
    label: 'Overdraft Facility',
    shortLabel: 'OD',
    icon: 'CreditCard',
    minTenure: 12,
    maxTenure: 12,
    minRate: 10.0,
    maxRate: 18.0,
    minAmount: 50000,
    maxAmount: 5000000,
    processingFeeRange: [0.5, 1.5],
    hasCollateral: false,
    taxBenefitEligible: false,
  },
}

/**
 * Income range configurations
 */
export const INCOME_RANGE_CONFIG: Record<
  IncomeRange,
  { label: string; min: number; max: number | null; eligibilityMultiplier: number }
> = {
  below_3L: { label: 'Below ₹3 Lakhs', min: 0, max: 300000, eligibilityMultiplier: 3 },
  '3L_5L': { label: '₹3-5 Lakhs', min: 300000, max: 500000, eligibilityMultiplier: 4 },
  '5L_10L': { label: '₹5-10 Lakhs', min: 500000, max: 1000000, eligibilityMultiplier: 5 },
  '10L_15L': { label: '₹10-15 Lakhs', min: 1000000, max: 1500000, eligibilityMultiplier: 5.5 },
  '15L_25L': { label: '₹15-25 Lakhs', min: 1500000, max: 2500000, eligibilityMultiplier: 6 },
  '25L_50L': { label: '₹25-50 Lakhs', min: 2500000, max: 5000000, eligibilityMultiplier: 6.5 },
  above_50L: { label: 'Above ₹50 Lakhs', min: 5000000, max: null, eligibilityMultiplier: 7 },
}

/**
 * Credit score configurations
 */
export const CREDIT_SCORE_CONFIG: Record<
  CreditScoreRange,
  { label: string; min: number; max: number; rateImpact: number; eligibilityImpact: number }
> = {
  poor: { label: 'Poor (300-549)', min: 300, max: 549, rateImpact: 3.0, eligibilityImpact: 0.5 },
  fair: { label: 'Fair (550-649)', min: 550, max: 649, rateImpact: 1.5, eligibilityImpact: 0.7 },
  good: { label: 'Good (650-749)', min: 650, max: 749, rateImpact: 0.5, eligibilityImpact: 0.9 },
  very_good: { label: 'Very Good (750-799)', min: 750, max: 799, rateImpact: 0, eligibilityImpact: 1.0 },
  excellent: { label: 'Excellent (800-900)', min: 800, max: 900, rateImpact: -0.25, eligibilityImpact: 1.1 },
}

/**
 * Tax deduction limits (FY 2024-25)
 */
export const TAX_DEDUCTION_LIMITS = {
  section80C: 150000,
  section24bSelfOccupied: 200000,
  section24bLetOut: Infinity, // No limit for let-out property
  section80EE: 50000, // First-time homebuyers
  section80EEA: 150000, // Affordable housing
  section80E: Infinity, // No limit for education loan interest
}

/**
 * Default FOIR limits by loan type
 */
export const DEFAULT_FOIR_LIMITS: Record<LoanType, number> = {
  home_loan: 0.5,
  personal_loan: 0.5,
  car_loan: 0.55,
  business_loan: 0.6,
  education_loan: 0.5,
  gold_loan: 0.65,
  loan_against_property: 0.5,
  two_wheeler_loan: 0.55,
  consumer_durable_loan: 0.55,
  overdraft: 0.5,
}

/**
 * Status display configuration
 */
export const INQUIRY_STATUS_CONFIG: Record<
  InquiryStatus,
  { label: string; color: string; bgColor: string; icon: string }
> = {
  inquiry: { label: 'New Inquiry', color: 'text-gray-400', bgColor: 'bg-gray-500/20', icon: 'FileText' },
  shared: { label: 'Shared', color: 'text-blue-400', bgColor: 'bg-blue-500/20', icon: 'Share2' },
  interested: { label: 'Interested', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', icon: 'Star' },
  lead_created: { label: 'Lead Created', color: 'text-purple-400', bgColor: 'bg-purple-500/20', icon: 'UserPlus' },
  application_started: { label: 'Application Started', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20', icon: 'FileEdit' },
  application_submitted: { label: 'Submitted', color: 'text-indigo-400', bgColor: 'bg-indigo-500/20', icon: 'Send' },
  under_review: { label: 'Under Review', color: 'text-orange-400', bgColor: 'bg-orange-500/20', icon: 'Clock' },
  approved: { label: 'Approved', color: 'text-green-400', bgColor: 'bg-green-500/20', icon: 'CheckCircle' },
  disbursed: { label: 'Disbursed', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', icon: 'Banknote' },
  lost: { label: 'Lost', color: 'text-red-400', bgColor: 'bg-red-500/20', icon: 'XCircle' },
  on_hold: { label: 'On Hold', color: 'text-amber-400', bgColor: 'bg-amber-500/20', icon: 'Pause' },
}
