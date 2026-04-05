/**
 * Credit Bureau Integration Types
 * Types for credit bureau data fetching and storage
 */

// Payment status for each month in payment history
export type PaymentStatus = 'ON_TIME' | 'LATE' | 'MISSED' | 'NOT_DUE' | 'NO_DATA';

// Monthly payment history entry (enhanced with full details)
export interface PaymentHistoryEntry {
  month: number; // 1-12
  year: number;
  status: PaymentStatus;
  dpd: number; // Days past due
  amount_due?: number; // EMI amount due for this month
  amount_paid?: number; // Actual amount paid
  payment_date?: string; // When payment was made
  is_partial?: boolean; // Partial payment flag
}

// Payment history summary (computed from full history)
export interface PaymentHistorySummary {
  total_payments_expected: number;
  total_payments_made: number;
  total_on_time_payments: number;
  total_late_payments: number;
  total_missed_payments: number;
  on_time_percentage: number;
  worst_dpd_ever: number;
  worst_dpd_date: string | null;
  current_payment_streak: number; // Consecutive on-time payments
  longest_payment_streak: number;
  first_payment_date: string | null;
  last_payment_date: string | null;
}

// Loan types from credit bureaus
export type BureauLoanType =
  | 'HOME'
  | 'PERSONAL'
  | 'AUTO'
  | 'CREDIT_CARD'
  | 'BUSINESS'
  | 'GOLD'
  | 'EDUCATION'
  | 'LAP' // Loan Against Property
  | 'OVERDRAFT'
  | 'TWO_WHEELER'
  | 'CONSUMER_DURABLE'
  | 'AGRICULTURE'
  | 'OTHER';

// Account status from credit bureaus
export type AccountStatus =
  | 'ACTIVE'
  | 'CLOSED'
  | 'WRITTEN_OFF'
  | 'SETTLED'
  | 'RESTRUCTURED';

// Credit bureau providers
export type BureauName = 'CIBIL' | 'EXPERIAN' | 'EQUIFAX' | 'CRIF';

// What triggered the fetch
export type FetchTrigger = 'PAN_UPLOAD' | 'MANUAL_REFRESH' | 'SCHEDULED';

// Fetch status
export type FetchStatus = 'SUCCESS' | 'FAILED' | 'PENDING';

// Credit bureau loan record (stored in database)
export interface CreditBureauLoan {
  id: string;
  customer_id: string;
  pan_number: string;

  // Source info
  bureau_name: BureauName;
  bureau_account_id: string | null;

  // Loan details
  lender_name: string;
  loan_type: BureauLoanType;
  account_number: string | null;
  sanctioned_amount: number | null;
  current_balance: number | null;
  emi_amount: number | null;
  tenure_months: number | null;
  interest_rate: number | null;

  // Dates
  disbursement_date: string | null;
  last_payment_date: string | null;
  closure_date: string | null;

  // Status
  account_status: AccountStatus;
  overdue_amount: number;
  dpd_days: number;

  // FULL Payment history from loan inception (NOT limited to 24 months)
  payment_history: PaymentHistoryEntry[];

  // Payment history summary (computed fields)
  payment_history_summary?: PaymentHistorySummary;

  // Multi-profile support
  profile_id?: string | null; // Individual profile ID
  entity_id?: string | null; // Entity profile ID

  // Metadata
  fetched_at: string;
  raw_response?: object;

  created_at: string;
  updated_at: string;
}

// Enhanced loan details with computed fields for UI display
export interface EnhancedLoanDetails extends CreditBureauLoan {
  // Computed progress fields
  loan_progress_percentage: number;
  total_paid: number;
  total_remaining: number;
  total_interest_paid: number;
  principal_paid: number;

  // Tenure progress
  months_elapsed: number;
  months_remaining: number;

  // Estimated dates
  estimated_closure_date: string | null;
  next_emi_date: string | null;
  days_until_next_emi: number | null;

  // Amortization schedule (optional, loaded on demand)
  amortization_schedule?: AmortizationEntry[];
}

// Amortization schedule entry
export interface AmortizationEntry {
  emi_number: number;
  month: number;
  year: number;
  emi_date: string;
  opening_balance: number;
  emi_amount: number;
  principal_component: number;
  interest_component: number;
  closing_balance: number;
  status: 'PAID' | 'DUE' | 'OVERDUE' | 'FUTURE';
  actual_payment_date?: string;
  actual_amount_paid?: number;
}

// Credit bureau fetch log (stored in database)
export interface CreditBureauFetchLog {
  id: string;
  customer_id: string;
  pan_number: string;
  bureau_name: BureauName;

  fetch_status: FetchStatus;
  error_message: string | null;
  loans_count: number;
  credit_score: number | null;

  request_id: string | null;
  response_time_ms: number | null;

  triggered_by: FetchTrigger;

  created_at: string;
}

// Provider configuration from cae_providers table
export interface CreditBureauProviderConfig {
  id: string;
  provider_code: BureauName;
  provider_type: string;
  provider_name: string;
  api_endpoint: string | null;
  api_key_encrypted: string | null;
  api_secret_encrypted: string | null;
  config_json: object | null;
  is_active: boolean;
  is_mock: boolean;
  priority: number;
  rate_limit_per_minute: number | null;
  rate_limit_per_day: number | null;
  cost_per_call: number | null;
}

// Raw credit report from provider
export interface CreditReport {
  credit_score: number;
  score_date: string;
  loans: CreditBureauLoanRaw[];
  enquiries?: CreditEnquiry[];
  raw_response: object;
}

// Raw loan data from provider (before database transformation)
export interface CreditBureauLoanRaw {
  bureau_account_id: string;
  lender_name: string;
  loan_type: string;
  account_number?: string;
  sanctioned_amount?: number;
  current_balance?: number;
  emi_amount?: number;
  tenure_months?: number;
  interest_rate?: number;
  disbursement_date?: string;
  last_payment_date?: string;
  closure_date?: string;
  account_status: string;
  overdue_amount?: number;
  dpd_days?: number;
  payment_history?: PaymentHistoryEntry[];
}

// Credit enquiry (when someone checks credit)
export interface CreditEnquiry {
  enquiry_date: string;
  enquirer_name: string;
  enquiry_purpose: string;
  amount_requested?: number;
}

// Provider interface
export interface ICreditBureauProvider {
  name: BureauName;
  fetchCreditReport(pan: string, config: CreditBureauProviderConfig): Promise<CreditReport>;
}

// Response from loans API
export interface LoansApiResponse {
  success: boolean;
  data?: {
    loanz360_loans: Loanz360Loan[];
    bureau_loans: CreditBureauLoan[];
    last_fetched_at: string | null;
    credit_score: number | null;
    credit_score_updated_at: string | null;
    next_refresh_allowed_at: string | null;
  };
  error?: string;
}

// Loanz360 internal loan (from loan_applications/loan_accounts tables)
export interface Loanz360Loan {
  id: string;
  application_number: string;
  loan_type: string;
  loan_purpose: string | null;
  requested_amount: number;
  approved_amount: number | null;
  tenure_months: number | null;
  interest_rate: number | null;
  emi_amount: number | null;
  status: string;
  disbursement_date: string | null;
  next_emi_date: string | null;
  outstanding_principal: number | null;
  paid_emis: number | null;
  total_emis: number | null;
  created_at: string;
}

// Refresh bureau response
export interface RefreshBureauResponse {
  success: boolean;
  message: string;
  loans_found?: number;
  credit_score?: number;
  next_refresh_allowed_at?: string;
  error?: string;
}

// ============================================
// CREDIT SCORE TYPES
// ============================================

// Credit score rating categories
export type CreditScoreRating = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'VERY_POOR' | 'NO_HISTORY';

// Score factor impact type
export type ScoreImpactType = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';

// Credit score with details
export interface CreditScore {
  id: string;
  customer_id: string;
  profile_id: string | null;
  entity_id: string | null;
  pan_number: string;
  bureau_name: BureauName;

  score: number | null;
  score_range: { min: number; max: number };
  rating: CreditScoreRating;
  rating_description: string;

  // Score factors
  factors: ScoreFactor[];

  // Timestamps
  fetched_at: string;
  next_refresh_at: string | null;
  created_at: string;
}

// Individual score factor
export interface ScoreFactor {
  factor_name: string;
  factor_code: string;
  impact_type: ScoreImpactType;
  impact_score: number; // -100 to +100
  weight_percentage: number; // How much this factor affects score
  current_value: string | number;
  optimal_value?: string | number;
  description: string;
  recommendation?: string;
}

// Credit score history for trend tracking
export interface CreditScoreHistory {
  id: string;
  customer_id: string;
  profile_id: string | null;
  entity_id: string | null;
  pan_number: string;
  bureau_name: BureauName;
  score: number;
  score_date: string;
  change_from_previous: number | null;
  created_at: string;
}

// ============================================
// CREDIT ENQUIRY TYPES
// ============================================

// Enquiry type
export type EnquiryType = 'HARD' | 'SOFT';

// Enhanced credit enquiry
export interface CreditEnquiryEnhanced {
  id: string;
  customer_id: string;
  profile_id: string | null;
  entity_id: string | null;
  pan_number: string;
  bureau_name: BureauName;

  enquiry_date: string;
  enquirer_name: string;
  enquiry_purpose: string;
  enquiry_type: EnquiryType;
  amount_requested: number | null;

  // Outcome (if known)
  enquiry_outcome?: 'APPROVED' | 'REJECTED' | 'PENDING' | 'UNKNOWN';

  // Impact on score
  estimated_score_impact: number; // Negative number

  created_at: string;
}

// Enquiry summary
export interface EnquirySummary {
  total_enquiries: number;
  hard_enquiries: number;
  soft_enquiries: number;
  enquiries_last_30_days: number;
  enquiries_last_90_days: number;
  enquiries_last_6_months: number;
  enquiries_last_12_months: number;
  estimated_total_impact: number;
  enquiries: CreditEnquiryEnhanced[];
}

// ============================================
// UPCOMING EMI TYPES
// ============================================

// Upcoming EMI entry
export interface UpcomingEMI {
  id: string;
  loan_id: string;
  loan_type: BureauLoanType;
  lender_name: string;
  account_number: string | null;

  due_date: string;
  emi_amount: number;

  // Status
  is_overdue: boolean;
  days_until_due: number; // Negative if overdue
  overdue_amount?: number;

  // Source
  source: 'LOANZ360' | 'BUREAU';

  // Reminder settings
  reminder_enabled: boolean;
  reminder_days: number[]; // Days before due date
}

// Monthly EMI summary
export interface MonthlyEMISummary {
  month: number;
  year: number;
  month_name: string;
  total_emi_amount: number;
  total_loans: number;
  overdue_count: number;
  overdue_amount: number;
  emis: UpcomingEMI[];
}

// EMI calendar data
export interface EMICalendarData {
  year: number;
  month: number;
  days: EMICalendarDay[];
}

export interface EMICalendarDay {
  date: string;
  day: number;
  has_emi: boolean;
  emis: UpcomingEMI[];
  total_amount: number;
  status: 'PAID' | 'DUE' | 'OVERDUE' | 'FUTURE' | 'NONE';
}

// ============================================
// CREDIT HEALTH & INSIGHTS TYPES
// ============================================

// Credit health category
export type CreditHealthCategory = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';

// Credit health assessment
export interface CreditHealthAssessment {
  customer_id: string;
  profile_id: string | null;
  entity_id: string | null;
  assessment_date: string;

  // Overall health score (0-100)
  health_score: number;
  health_category: CreditHealthCategory;
  health_description: string;

  // Individual factor scores (0-100 each)
  factor_scores: {
    payment_history_score: number;
    credit_utilization_score: number;
    credit_age_score: number;
    credit_mix_score: number;
    recent_activity_score: number;
  };

  // Detailed analysis
  strengths: string[];
  weaknesses: string[];

  // Actionable recommendations
  recommendations: CreditRecommendation[];

  // Alerts
  alerts: CreditAlert[];
}

// Credit recommendation
export interface CreditRecommendation {
  id: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'UTILIZATION' | 'PAYMENT' | 'ENQUIRIES' | 'CREDIT_MIX' | 'CREDIT_AGE' | 'GENERAL';
  title: string;
  description: string;
  potential_score_impact: string; // e.g., "+20-30 points"
  action_steps: string[];
  difficulty: 'EASY' | 'MODERATE' | 'HARD';
  time_to_impact: string; // e.g., "1-2 months"
}

// Credit alert
export interface CreditAlert {
  id: string;
  type: 'SCORE_CHANGE' | 'NEW_ENQUIRY' | 'ACCOUNT_CHANGE' | 'PAYMENT_DUE' | 'PAYMENT_MISSED' | 'UNUSUAL_ACTIVITY' | 'HIGH_UTILIZATION';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  action_required?: string;
  related_loan_id?: string;
  created_at: string;
  read: boolean;
  dismissed: boolean;
}

// ============================================
// SCORE SIMULATOR TYPES
// ============================================

// Simulation action types
export type SimulationActionType =
  | 'PAY_OFF_LOAN'
  | 'CLOSE_CREDIT_CARD'
  | 'REDUCE_UTILIZATION'
  | 'MISS_PAYMENT'
  | 'NEW_LOAN_APPLICATION'
  | 'INCREASE_CREDIT_LIMIT'
  | 'BECOME_AUTHORIZED_USER'
  | 'DISPUTE_ERROR';

// Simulation action
export interface SimulationAction {
  type: SimulationActionType;
  loan_id?: string;
  amount?: number;
  target_utilization?: number;
  months_missed?: number;
  loan_type?: BureauLoanType;
}

// Simulation result
export interface SimulationResult {
  current_score: number;
  simulated_score: number;
  score_change: number;
  change_direction: 'INCREASE' | 'DECREASE' | 'NO_CHANGE';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';

  // Factor-by-factor breakdown
  factor_breakdown: SimulationFactorImpact[];

  // Warnings and recommendations
  warnings: string[];
  recommendations: string[];

  // Disclaimer
  disclaimer: string;
}

export interface SimulationFactorImpact {
  factor: string;
  current_value: number | string;
  simulated_value: number | string;
  score_impact: number;
  explanation: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

// Credit score API response
export interface CreditScoreApiResponse {
  success: boolean;
  data?: {
    primary_score: CreditScore | null;
    all_scores: CreditScore[];
    score_history: CreditScoreHistory[];
    factors: ScoreFactor[];
    last_fetched_at: string | null;
    next_refresh_at: string | null;
  };
  error?: string;
}

// Loan details API response
export interface LoanDetailsApiResponse {
  success: boolean;
  data?: {
    portfolio_summary: LoanPortfolioSummary;
    loans: EnhancedLoanDetails[];
  };
  error?: string;
}

export interface LoanPortfolioSummary {
  total_loans: number;
  active_loans: number;
  closed_loans: number;
  total_sanctioned: number;
  total_outstanding: number;
  total_monthly_emi: number;
  total_overdue: number;
  overdue_loan_count: number;
}

// Upcoming EMIs API response
export interface UpcomingEMIsApiResponse {
  success: boolean;
  data?: {
    current_month: MonthlyEMISummary;
    upcoming_months: MonthlyEMISummary[];
    total_upcoming_emi: number;
    overdue_total: number;
    calendar?: EMICalendarData;
  };
  error?: string;
}

// Payment history API response
export interface PaymentHistoryApiResponse {
  success: boolean;
  data?: {
    overall_health: {
      on_time_percentage: number;
      total_payments: number;
      on_time_count: number;
      late_count: number;
      missed_count: number;
    };
    payment_grid: PaymentHistoryGrid[];
    dpd_analysis: DPDAnalysis;
  };
  error?: string;
}

export interface PaymentHistoryGrid {
  loan_id: string;
  loan_type: string;
  lender_name: string;
  account_number: string | null;
  disbursement_date: string;
  closure_date: string | null;
  account_status: AccountStatus;
  months: PaymentHistoryEntry[];
}

export interface DPDAnalysis {
  current_0_dpd: number;
  dpd_1_30: number;
  dpd_31_60: number;
  dpd_61_90: number;
  dpd_90_plus: number;
  worst_dpd_ever: number;
  worst_dpd_loan: string | null;
  worst_dpd_date: string | null;
}

// Credit health API response
export interface CreditHealthApiResponse {
  success: boolean;
  data?: CreditHealthAssessment;
  error?: string;
}

// Enquiries API response
export interface EnquiriesApiResponse {
  success: boolean;
  data?: EnquirySummary;
  error?: string;
}

// Simulation API response
export interface SimulationApiResponse {
  success: boolean;
  data?: SimulationResult;
  error?: string;
}

// ============================================
// NOTIFICATION TYPES
// ============================================

// Notification channel
export type NotificationChannel = 'SMS' | 'EMAIL' | 'WHATSAPP' | 'PUSH';

// EMI reminder preferences
export interface EMIReminderPreferences {
  id: string;
  customer_id: string;
  profile_id: string | null;

  // Channel preferences
  sms_enabled: boolean;
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  push_enabled: boolean;

  // Timing preferences (days before due date)
  reminder_days: number[];

  // Contact details
  sms_number: string | null;
  email_address: string | null;
  whatsapp_number: string | null;

  created_at: string;
  updated_at: string;
}

// Reminder log entry
export interface EMIReminderLog {
  id: string;
  customer_id: string;
  profile_id: string | null;
  loan_id: string;

  channel: NotificationChannel;
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED';
  scheduled_at: string;
  sent_at: string | null;
  delivered_at: string | null;

  message_content: string;
  provider_response?: object;
  error_message?: string;

  created_at: string;
}
