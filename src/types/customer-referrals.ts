/**
 * Type definitions for Customer Referrals Module
 * Includes types for referrals, points, and tracking
 */

// ============================================================================
// ENUMS
// ============================================================================

export type ReferralFormStatus = 'PENDING' | 'OPENED' | 'FILLED' | 'SUBMITTED'
export type ReferralStatus = 'NEW' | 'LINK_OPENED' | 'REGISTERED' | 'APPLIED' | 'CONVERTED'
export type PointsTransactionType = 'EARNED' | 'REDEEMED' | 'EXPIRED' | 'BONUS'
export type PointsReferenceType = 'REFERRAL_REGISTRATION' | 'REFERRAL_APPLICATION' | 'REFERRAL_CONVERSION' | 'CONTEST' | 'REDEMPTION'

export type LoanType =
  | 'Home Loan'
  | 'Personal Loan'
  | 'Business Loan'
  | 'Loan Against Property'
  | 'Vehicle Loan'
  | 'Education Loan'
  | 'Gold Loan'
  | 'Car Loan'
  | 'Property Loan'
  | 'Working Capital Loan'
  | 'Other'

// ============================================================================
// DATABASE MODELS
// ============================================================================

/**
 * Customer Referral Model (customer_referrals table)
 */
export interface CustomerReferral {
  id: string // UUID

  // Referrer information
  referrer_customer_id: string // UUID
  referrer_user_id: string // UUID

  // Referral identification
  referral_id: string // e.g., 'CR-2025-000001'

  // Referred person information
  referred_name: string | null
  referred_mobile: string
  referred_email: string | null
  referred_city: string | null

  // Loan details
  loan_type: string | null
  required_loan_amount: number | null

  // Form submission tracking
  form_status: ReferralFormStatus
  form_submitted_at: string | null // ISO timestamp

  // Link tracking
  short_link: string | null
  short_code: string | null
  trace_token: string

  // WhatsApp tracking
  shared_via_whatsapp: boolean
  whatsapp_sent_count: number
  last_whatsapp_sent_at: string | null // ISO timestamp

  // Referral status
  referral_status: ReferralStatus

  // Conversion tracking
  converted: boolean
  converted_to_customer_id: string | null
  converted_at: string | null // ISO timestamp

  // Points tracking
  points_awarded: number
  points_awarded_at: string | null // ISO timestamp

  // Metadata
  remarks: string | null

  // Timestamps
  created_at: string // ISO timestamp
  updated_at: string // ISO timestamp
}

/**
 * Customer Referral Points Model (customer_referral_points table)
 */
export interface CustomerReferralPoints {
  id: string // UUID
  customer_id: string // UUID
  user_id: string // UUID
  points_balance: number
  total_points_earned: number
  total_points_redeemed: number
  created_at: string // ISO timestamp
  updated_at: string // ISO timestamp
}

/**
 * Points Transaction Model (customer_points_transactions table)
 */
export interface PointsTransaction {
  id: string // UUID
  customer_id: string // UUID
  user_id: string // UUID
  transaction_type: PointsTransactionType
  points: number
  balance_after: number
  reference_type: PointsReferenceType | null
  reference_id: string | null // UUID
  description: string | null
  created_at: string // ISO timestamp
}

/**
 * Points Configuration Model (referral_points_config table)
 */
export interface ReferralPointsConfig {
  id: string // UUID
  config_key: string
  points_value: number
  description: string | null
  is_active: boolean
  created_at: string // ISO timestamp
  updated_at: string // ISO timestamp
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Request to generate a customer referral link
 */
export interface GenerateReferralLinkRequest {
  referred_mobile: string
  referred_name?: string
  loan_type?: LoanType
  required_loan_amount?: number
  remarks?: string
}

/**
 * Response from generate referral link API
 */
export interface GenerateReferralLinkResponse {
  success: boolean
  data?: {
    referral_id: string
    short_link: string
    short_code: string
    whatsapp_url: string
    referral: CustomerReferral
  }
  error?: string
}

/**
 * Response from get referrals API
 */
export interface GetReferralsResponse {
  success: boolean
  data?: CustomerReferral[]
  error?: string
  pagination?: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

/**
 * Response from get single referral API
 */
export interface GetReferralResponse {
  success: boolean
  data?: CustomerReferral
  error?: string
}

/**
 * Referral statistics
 */
export interface CustomerReferralStats {
  total_referrals: number
  pending_referrals: number
  opened_referrals: number
  registered_referrals: number
  applied_referrals: number
  converted_referrals: number
  total_points_earned: number
  points_balance: number
  conversion_rate: number
}

/**
 * Response from referral stats API
 */
export interface ReferralStatsResponse {
  success: boolean
  data?: CustomerReferralStats
  error?: string
}

/**
 * Response from points balance API
 */
export interface PointsBalanceResponse {
  success: boolean
  data?: {
    balance: CustomerReferralPoints
    recent_transactions: PointsTransaction[]
    config: ReferralPointsConfig[]
  }
  error?: string
}

// ============================================================================
// FILTER & SORTING TYPES
// ============================================================================

/**
 * Referral filters for listing
 */
export interface ReferralFilters {
  form_status?: ReferralFormStatus | ReferralFormStatus[]
  referral_status?: ReferralStatus | ReferralStatus[]
  loan_type?: LoanType | LoanType[]
  converted?: boolean
  date_from?: string
  date_to?: string
  search?: string // Search in referred_name, referred_mobile, referred_email
}

/**
 * Referral sorting options
 */
export interface ReferralSortOptions {
  field: 'created_at' | 'updated_at' | 'form_submitted_at' | 'required_loan_amount' | 'referral_status'
  direction: 'asc' | 'desc'
}

/**
 * Referral list query parameters
 */
export interface ReferralListQuery {
  page?: number
  limit?: number
  filters?: ReferralFilters
  sort?: ReferralSortOptions
}

// ============================================================================
// UI COMPONENT TYPES
// ============================================================================

/**
 * Referral table row data
 */
export interface ReferralTableRow {
  id: string
  referral_id: string
  referred_name: string | null
  referred_mobile: string
  loan_type: string | null
  required_loan_amount: number | null
  form_status: ReferralFormStatus
  referral_status: ReferralStatus
  whatsapp_sent_count: number
  created_at: string
  short_link: string | null
  points_awarded: number
}

/**
 * Referral status badge variant
 */
export type ReferralStatusBadgeVariant = 'info' | 'success' | 'warning' | 'error' | 'default'

/**
 * Points history item for display
 */
export interface PointsHistoryItem {
  id: string
  type: PointsTransactionType
  points: number
  description: string
  date: string
  balanceAfter: number
}

// ============================================================================
// TRACE TOKEN TYPES
// ============================================================================

/**
 * Customer trace token structure
 */
export interface CustomerTraceToken {
  role: 'CUSTOMER'
  userId: string
  customerId: string
  timestamp: number
  randomKey: string
}

// ============================================================================
// WHATSAPP MESSAGE TYPES
// ============================================================================

/**
 * WhatsApp message template for customer referral
 */
export interface CustomerWhatsAppMessage {
  to: string // Phone number
  message: string // Pre-filled message
  link: string // Short link to include in message
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Partial referral for creation
 */
export type CreateReferralInput = Pick<
  CustomerReferral,
  | 'referred_name'
  | 'referred_mobile'
  | 'referred_email'
  | 'referred_city'
  | 'loan_type'
  | 'required_loan_amount'
  | 'remarks'
>

/**
 * Referral with referrer details for admin view
 */
export interface ReferralWithReferrer extends CustomerReferral {
  referrer?: {
    customer_id: string
    full_name: string
    mobile: string
    email: string | null
  }
}
