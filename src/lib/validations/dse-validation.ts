/**
 * DSE Business Module - Shared Validation & Helper Utilities
 * Used across My Pipeline, Customer Database, and My Proposals
 */

// ============================================================
// PAGINATION VALIDATION
// ============================================================

export function validatePagination(pageStr: string | null, limitStr: string | null, maxLimit = 100) {
  const page = Math.max(1, parseInt(pageStr || '1') || 1)
  const limit = Math.min(Math.max(1, parseInt(limitStr || '20') || 20), maxLimit)
  const offset = (page - 1) * limit
  return { page, limit, offset }
}

// ============================================================
// UUID VALIDATION
// ============================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value)
}

// ============================================================
// DATE VALIDATION
// ============================================================

export function isValidISODate(value: string): boolean {
  const date = new Date(value)
  return !isNaN(date.getTime())
}

export function isValidDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && isValidISODate(value)
}

export function isValidTimeString(value: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value)
}

// ============================================================
// PHONE VALIDATION (Indian)
// ============================================================

export function isValidIndianMobile(value: string): boolean {
  const cleaned = value.replace(/[\s\-+]/g, '')
  // Allow 10-digit starting with 6-9, or with +91/91 prefix
  return /^(\+?91)?[6-9]\d{9}$/.test(cleaned)
}

export function formatMobileForStorage(value: string): string {
  const cleaned = value.replace(/[\s\-+]/g, '')
  // Store as 10-digit number
  if (cleaned.length === 12 && cleaned.startsWith('91')) return cleaned.slice(2)
  if (cleaned.length === 13 && cleaned.startsWith('91')) return cleaned.slice(3)
  return cleaned.slice(-10)
}

// ============================================================
// EMAIL VALIDATION
// ============================================================

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254
}

// ============================================================
// SORT COLUMN VALIDATION
// ============================================================

export function validateSortColumn(
  sortBy: string | null,
  validColumns: string[],
  defaultColumn: string
): string {
  return validColumns.includes(sortBy || '') ? sortBy! : defaultColumn
}

// ============================================================
// LEAD STAGE CONFIGURATION
// ============================================================

export const LEAD_STAGES = [
  'New',
  'Contacted',
  'Qualified',
  'Proposal Sent',
  'Negotiation',
  'Won',
  'Lost',
  'On Hold',
  'Nurturing',
] as const

export type LeadStage = typeof LEAD_STAGES[number]

/**
 * Stage Transition Rules - defines allowed transitions
 * Key = current stage, Value = allowed next stages
 */
export const STAGE_TRANSITIONS: Record<string, string[]> = {
  'New': ['Contacted', 'Lost', 'On Hold'],
  'Contacted': ['Qualified', 'Lost', 'On Hold', 'Nurturing'],
  'Qualified': ['Proposal Sent', 'Lost', 'On Hold', 'Nurturing'],
  'Proposal Sent': ['Negotiation', 'Won', 'Lost', 'On Hold'],
  'Negotiation': ['Won', 'Lost', 'On Hold'],
  'Won': [], // Terminal state
  'Lost': ['New', 'Nurturing'], // Can reopen
  'On Hold': ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation'],
  'Nurturing': ['Contacted', 'Qualified', 'Lost'],
}

/**
 * Required fields per stage - stage cannot be entered without these
 */
export const STAGE_REQUIRED_FIELDS: Record<string, string[]> = {
  'New': ['customer_name', 'mobile'],
  'Contacted': ['customer_name', 'mobile'],
  'Qualified': ['customer_name', 'mobile', 'lead_type', 'estimated_value'],
  'Proposal Sent': ['customer_name', 'mobile', 'lead_type', 'estimated_value'],
  'Negotiation': ['customer_name', 'mobile', 'lead_type', 'estimated_value'],
  'Won': ['customer_name', 'mobile', 'lead_type', 'estimated_value'],
  'Lost': ['customer_name', 'mobile'],
  'On Hold': ['customer_name', 'mobile'],
  'Nurturing': ['customer_name', 'mobile'],
}

/**
 * Stage SLA hours - maximum time a lead should stay in each stage
 */
export const STAGE_SLA_HOURS: Record<string, number> = {
  'New': 4,
  'Contacted': 48,
  'Qualified': 72,
  'Proposal Sent': 48,
  'Negotiation': 120,
  'On Hold': 168,
  'Nurturing': 336,
}

export function isStageTransitionAllowed(fromStage: string, toStage: string): boolean {
  const allowed = STAGE_TRANSITIONS[fromStage]
  if (!allowed) return false
  return allowed.includes(toStage)
}

export function getMissingRequiredFields(
  stage: string,
  data: Record<string, unknown>
): string[] {
  const required = STAGE_REQUIRED_FIELDS[stage] || []
  return required.filter(field => !data[field])
}

// ============================================================
// DEAL STAGE CONFIGURATION
// ============================================================

export const DEAL_STAGES = [
  'docs_collected',
  'finalized_bank',
  'login_complete',
  'post_login_pending_cleared',
  'process_started_at_bank',
  'case_assessed_by_banker',
  'pd_complete',
  'sanctioned',
  'disbursed',
  'dropped',
] as const

export type DealStage = typeof DEAL_STAGES[number]

export const DEAL_STAGE_ORDER: Record<string, number> = {
  docs_collected: 1,
  finalized_bank: 2,
  login_complete: 3,
  post_login_pending_cleared: 4,
  process_started_at_bank: 5,
  case_assessed_by_banker: 6,
  pd_complete: 7,
  sanctioned: 8,
  disbursed: 9,
  dropped: 10,
}

export const DEAL_STATUSES = ['in_progress', 'sanctioned', 'disbursed', 'dropped'] as const
export type DealStatus = typeof DEAL_STATUSES[number]

// ============================================================
// LEAD SCORING ENGINE
// ============================================================

export interface LeadScoringInput {
  // Profile completeness
  has_name: boolean
  has_mobile: boolean
  has_email: boolean
  has_location: boolean
  has_employment_details: boolean
  has_documents: boolean

  // Engagement
  response_time_hours: number | null
  total_interactions: number
  customer_initiated_contact: boolean
  document_submission_speed_days: number | null

  // Financial fit
  loan_amount: number | null
  product_min_amount: number | null
  product_max_amount: number | null

  // Source quality
  source_type: string

  // Recency
  days_since_creation: number
}

export function calculateLeadScore(input: LeadScoringInput): number {
  let score = 0

  // Profile Completeness (0-20)
  if (input.has_name && input.has_mobile) score += 5
  if (input.has_email && input.has_location) score += 5
  if (input.has_employment_details) score += 5
  if (input.has_documents) score += 5

  // Engagement Score (0-25)
  if (input.response_time_hours !== null) {
    if (input.response_time_hours <= 1) score += 10
    else if (input.response_time_hours <= 4) score += 7
    else if (input.response_time_hours <= 24) score += 4
    else score += 1
  }
  if (input.total_interactions >= 3) score += 5
  else if (input.total_interactions >= 1) score += 2
  if (input.customer_initiated_contact) score += 5
  if (input.document_submission_speed_days !== null) {
    if (input.document_submission_speed_days <= 1) score += 5
    else if (input.document_submission_speed_days <= 3) score += 3
    else score += 1
  }

  // Financial Fit (0-30)
  if (input.loan_amount && input.product_min_amount && input.product_max_amount) {
    if (input.loan_amount >= input.product_min_amount && input.loan_amount <= input.product_max_amount) {
      score += 10
    } else {
      score += 3 // Still some value, may be adjustable
    }
  }
  // Additional 20 points can come from credit score integration (Phase 2)

  // Source Quality (0-15)
  const sourceScores: Record<string, number> = {
    referral: 15,
    partner: 13,
    walk_in: 10,
    website: 8,
    social_media: 7,
    cold_call: 5,
    DSE: 10,
    other: 5,
  }
  score += sourceScores[input.source_type] || 5

  // Recency Factor (0-10)
  if (input.days_since_creation <= 1) score += 10
  else if (input.days_since_creation <= 7) score += 7
  else if (input.days_since_creation <= 30) score += 4
  else score += 1

  return Math.min(100, Math.max(0, score))
}

// ============================================================
// CUSTOMER HEALTH SCORE
// ============================================================

export interface CustomerHealthInput {
  days_since_last_contact: number
  total_interactions: number
  deal_value: number
  has_active_deal: boolean
  response_rate: number // 0-1
}

export function calculateCustomerHealthScore(input: CustomerHealthInput): number {
  let score = 0

  // Recency (0-40)
  if (input.days_since_last_contact <= 3) score += 40
  else if (input.days_since_last_contact <= 7) score += 30
  else if (input.days_since_last_contact <= 14) score += 20
  else if (input.days_since_last_contact <= 30) score += 10
  else score += 0

  // Frequency (0-25)
  if (input.total_interactions >= 10) score += 25
  else if (input.total_interactions >= 5) score += 18
  else if (input.total_interactions >= 3) score += 12
  else if (input.total_interactions >= 1) score += 5

  // Monetary (0-20)
  if (input.deal_value >= 5000000) score += 20
  else if (input.deal_value >= 1000000) score += 15
  else if (input.deal_value >= 500000) score += 10
  else if (input.deal_value > 0) score += 5

  // Activity (0-15)
  if (input.has_active_deal) score += 8
  score += Math.round(input.response_rate * 7)

  return Math.min(100, Math.max(0, score))
}

// ============================================================
// FOLLOW-UP SCHEDULING RULES
// ============================================================

export const FOLLOW_UP_RULES: Record<string, { delay_hours: number; type: string; priority: string }> = {
  lead_created: { delay_hours: 2, type: 'initial_contact', priority: 'high' },
  stage_contacted: { delay_hours: 48, type: 'qualification_followup', priority: 'medium' },
  stage_qualified: { delay_hours: 24, type: 'proposal_prep', priority: 'high' },
  stage_proposal_sent: { delay_hours: 48, type: 'proposal_followup', priority: 'high' },
  stage_negotiation: { delay_hours: 24, type: 'negotiation_check', priority: 'high' },
  meeting_completed: { delay_hours: 24, type: 'post_meeting', priority: 'medium' },
  document_received: { delay_hours: 4, type: 'document_verification', priority: 'medium' },
  customer_no_response: { delay_hours: 72, type: 'reengagement', priority: 'low' },
}

export function getNextFollowUpDate(triggerEvent: string, baseDate?: Date): Date {
  const rule = FOLLOW_UP_RULES[triggerEvent]
  const delay = rule?.delay_hours || 24
  const now = baseDate || new Date()
  return new Date(now.getTime() + delay * 60 * 60 * 1000)
}

// ============================================================
// COMMISSION CALCULATION
// ============================================================

export interface CommissionInput {
  loan_amount: number
  product_type: string
  monthly_conversions: number
}

const COMMISSION_TIERS = [
  { min_conversions: 0, max_conversions: 5, rate: 0.01 },
  { min_conversions: 6, max_conversions: 15, rate: 0.015 },
  { min_conversions: 16, max_conversions: Infinity, rate: 0.02 },
]

const PRODUCT_MULTIPLIERS: Record<string, number> = {
  'Home Loan': 1.0,
  'Business Loan': 1.2,
  'Personal Loan': 1.5,
  'Auto Loan': 1.0,
  'Education Loan': 0.8,
  'Mortgage': 1.1,
  'LAP': 1.3,
  'Gold Loan': 0.9,
}

export function calculateCommission(input: CommissionInput): {
  commission: number
  rate: number
  tier: string
  next_tier_in: number
} {
  const tier = COMMISSION_TIERS.find(
    t => input.monthly_conversions >= t.min_conversions && input.monthly_conversions <= t.max_conversions
  ) || COMMISSION_TIERS[0]

  const multiplier = PRODUCT_MULTIPLIERS[input.product_type] || 1.0
  const effectiveRate = tier.rate * multiplier
  const commission = input.loan_amount * effectiveRate

  const currentTierIndex = COMMISSION_TIERS.indexOf(tier)
  const nextTier = COMMISSION_TIERS[currentTierIndex + 1]
  const nextTierIn = nextTier ? nextTier.min_conversions - input.monthly_conversions : 0

  const tierNames = ['Bronze', 'Silver', 'Gold']

  return {
    commission: Math.round(commission),
    rate: effectiveRate,
    tier: tierNames[currentTierIndex] || 'Bronze',
    next_tier_in: Math.max(0, nextTierIn),
  }
}
