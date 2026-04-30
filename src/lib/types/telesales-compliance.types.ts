// =====================================================
// TELESALES DND & COMPLIANCE TYPES
// =====================================================

// =====================================================
// DND REGISTRY
// =====================================================

export type TSDNDType = 'FULL' | 'PARTIAL'
export type TSDNDSource = 'MANUAL' | 'API' | 'BULK_UPLOAD' | 'CUSTOMER_REQUEST' | 'TRAI_SYNC'

export interface TSDNDRegistryEntry {
  id: string
  phone_number: string
  phone_normalized: string
  is_dnd: boolean
  dnd_type: TSDNDType
  allowed_categories?: string[]
  source: TSDNDSource
  verified_at?: string
  verification_source?: string
  registered_at: string
  deregistered_at?: string
  last_checked: string
  created_at: string
  updated_at: string
}

// =====================================================
// DND VERIFICATION
// =====================================================

export type TSDNDAction = 'ALLOWED' | 'BLOCKED' | 'OVERRIDE' | 'WARNING_SHOWN'
export type TSDNDVerificationSource = 'CACHE' | 'DATABASE' | 'API' | 'MANUAL'

export interface TSDNDVerificationLog {
  id: string
  sales_executive_id: string
  phone_number: string
  is_dnd: boolean
  dnd_type?: TSDNDType
  action_taken: TSDNDAction
  override_reason?: string
  call_id?: string
  lead_id?: string
  verification_source: TSDNDVerificationSource
  response_time_ms?: number
  created_at: string
}

export interface TSDNDCheckResult {
  phone_number: string
  is_dnd: boolean
  dnd_type?: TSDNDType
  allowed_categories?: string[]
  can_call: boolean
  reason?: string
  warning?: string
  last_verified?: string
}

// =====================================================
// CALL TIME RESTRICTIONS
// =====================================================

export interface TSCallTimeRestriction {
  id: string
  name: string
  description?: string
  allowed_start_time: string // HH:MM format
  allowed_end_time: string
  allowed_days: number[] // 0=Sunday, 1=Monday, etc.
  blocked_dates?: string[]
  region?: string
  category?: string
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TSCallTimeCheckResult {
  can_call: boolean
  reason?: string
  current_time: string
  allowed_start: string
  allowed_end: string
  next_allowed_time?: string
  is_holiday?: boolean
}

// =====================================================
// CUSTOMER CONSENT
// =====================================================

export type TSConsentType = 'OPT_IN' | 'OPT_OUT' | 'PARTIAL'
export type TSConsentChannel = 'SMS' | 'EMAIL' | 'VERBAL' | 'WEBSITE' | 'APP' | 'IVR' | 'PHYSICAL_FORM'

export interface TSCustomerConsent {
  id: string
  phone_number: string
  customer_id?: string
  lead_id?: string
  consent_type: TSConsentType
  consent_channel: TSConsentChannel
  consent_categories?: string[]
  consented_at: string
  expires_at?: string
  revoked_at?: string
  recorded_by?: string
  ip_address?: string
  user_agent?: string
  consent_proof?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TSConsentCheckResult {
  has_consent: boolean
  consent_type?: TSConsentType
  consent_channel?: TSConsentChannel
  categories?: string[]
  expires_at?: string
  is_expired: boolean
  reason?: string
}

// =====================================================
// COMPLIANCE VIOLATIONS
// =====================================================

export type TSViolationType =
  | 'DND_CALL'
  | 'TIME_VIOLATION'
  | 'NO_CONSENT'
  | 'HARASSMENT'
  | 'FREQUENCY_VIOLATION'
  | 'MISREPRESENTATION'

export type TSViolationSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type TSViolationStatus = 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED' | 'ESCALATED' | 'DISMISSED'

export interface TSComplianceViolation {
  id: string
  sales_executive_id: string
  violation_type: TSViolationType
  severity: TSViolationSeverity
  phone_number?: string
  call_id?: string
  description: string
  evidence?: unknown; status: TSViolationStatus
  resolved_at?: string
  resolved_by?: string
  resolution_notes?: string
  penalty_points: number
  warning_issued: boolean
  created_at: string
  updated_at: string
}

// =====================================================
// COMPLIANCE DASHBOARD
// =====================================================

export interface TSComplianceDashboard {
  dnd_stats: {
    total_checks_today: number
    blocked_calls: number
    override_count: number
    compliance_rate: number
  }
  time_restriction_stats: {
    calls_within_hours: number
    calls_outside_hours: number
    compliance_rate: number
  }
  consent_stats: {
    total_with_consent: number
    total_without_consent: number
    pending_consent: number
  }
  violation_stats: {
    total_violations: number
    pending_violations: number
    resolved_violations: number
    by_type: Record<TSViolationType, number>
  }
  recent_violations: TSComplianceViolation[]
  compliance_score: number // 0-100
}

// =====================================================
// API REQUEST/RESPONSE TYPES
// =====================================================

export interface TSDNDCheckRequest {
  phone_number: string
  lead_id?: string
  call_id?: string
  category?: string
}

export interface TSDNDCheckResponse {
  success: boolean
  data?: TSDNDCheckResult
  error?: string
}

export interface TSCallTimeCheckRequest {
  region?: string
  category?: string
}

export interface TSCallTimeCheckResponse {
  success: boolean
  data?: TSCallTimeCheckResult
  error?: string
}

export interface TSRecordConsentRequest {
  phone_number: string
  customer_id?: string
  lead_id?: string
  consent_type: TSConsentType
  consent_channel: TSConsentChannel
  consent_categories?: string[]
  expires_at?: string
  consent_proof?: string
}

export interface TSRecordConsentResponse {
  success: boolean
  data?: TSCustomerConsent
  error?: string
}

export interface TSPreCallCheckRequest {
  phone_number: string
  lead_id?: string
  category?: string
  region?: string
}

export interface TSPreCallCheckResponse {
  success: boolean
  data?: {
    can_call: boolean
    dnd_check: TSDNDCheckResult
    time_check: TSCallTimeCheckResult
    consent_check: TSConsentCheckResult
    warnings: string[]
    blockers: string[]
  }
  error?: string
}

// =====================================================
// CONSTANTS
// =====================================================

export const TS_VIOLATION_TYPE_LABELS: Record<TSViolationType, string> = {
  DND_CALL: 'DND Number Called',
  TIME_VIOLATION: 'Called Outside Hours',
  NO_CONSENT: 'No Consent Recorded',
  HARASSMENT: 'Customer Harassment',
  FREQUENCY_VIOLATION: 'Excessive Call Frequency',
  MISREPRESENTATION: 'Misrepresentation'
}

export const TS_VIOLATION_SEVERITY_COLORS: Record<TSViolationSeverity, { bg: string; text: string }> = {
  LOW: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  MEDIUM: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  HIGH: { bg: 'bg-red-500/20', text: 'text-red-400' },
  CRITICAL: { bg: 'bg-red-600/30', text: 'text-red-300' }
}

export const TS_CONSENT_CHANNEL_LABELS: Record<TSConsentChannel, string> = {
  SMS: 'SMS',
  EMAIL: 'Email',
  VERBAL: 'Verbal (Recorded)',
  WEBSITE: 'Website Form',
  APP: 'Mobile App',
  IVR: 'IVR System',
  PHYSICAL_FORM: 'Physical Form'
}

export const TS_ALLOWED_CALL_CATEGORIES = [
  'BANKING',
  'INSURANCE',
  'INVESTMENT',
  'REAL_ESTATE',
  'EDUCATION',
  'HEALTH',
  'TELECOM',
  'CONSUMER_GOODS'
] as const

export type TSCallCategory = typeof TS_ALLOWED_CALL_CATEGORIES[number]
