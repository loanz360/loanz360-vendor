/**
 * Sales Pipeline Shared Constants
 * Single source of truth for statuses, stages, colors, and utilities
 * Used across all CRO portal Sales Pipeline modules
 */

// ============================================================================
// CONTACT STATUSES
// ============================================================================

export const CONTACT_STATUSES = [
  'new',
  'contacted',
  'called',
  'follow_up',
  'not_interested',
  'positive',
  'converted',
  'invalid',
] as const

export type ContactStatusValue = typeof CONTACT_STATUSES[number]

export const CONTACT_STATUS_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  called: 'Called',
  follow_up: 'Follow Up',
  not_interested: 'Not Interested',
  positive: 'Positive',
  converted: 'Converted',
  invalid: 'Invalid',
}

// ============================================================================
// LEAD STATUSES & STAGES
// ============================================================================

export const LEAD_STATUSES = ['active', 'follow_up', 'converted', 'dropped'] as const
export type LeadStatusValue = typeof LEAD_STATUSES[number]

export const LEAD_STAGES = [
  'new',
  'contacted',
  'qualified',
  'docs_pending',
  'ready_to_convert',
] as const
export type LeadStageValue = typeof LEAD_STAGES[number]

export const LEAD_STAGE_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  docs_pending: 'Docs Pending',
  ready_to_convert: 'Ready to Convert',
}

// ============================================================================
// DEAL STATUSES & STAGES
// ============================================================================

export const DEAL_STATUSES = ['in_progress', 'sanctioned', 'dropped', 'disbursed'] as const
export type DealStatusValue = typeof DEAL_STATUSES[number]

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
export type DealStageValue = typeof DEAL_STAGES[number]

export const DEAL_STAGE_LABELS: Record<string, string> = {
  docs_collected: 'Docs Collected',
  finalized_bank: 'Bank Finalized',
  login_complete: 'Login Done',
  post_login_pending_cleared: 'Post-Login Cleared',
  process_started_at_bank: 'Bank Processing',
  case_assessed_by_banker: 'Banker Assessment',
  pd_complete: 'PD Complete',
  sanctioned: 'Sanctioned',
  disbursed: 'Disbursed',
  dropped: 'Dropped',
}

// ============================================================================
// FOLLOW-UP STATUSES
// ============================================================================

export const FOLLOWUP_STATUSES = ['Pending', 'Completed', 'Cancelled', 'Rescheduled'] as const
export type FollowupStatusValue = typeof FOLLOWUP_STATUSES[number]

// ============================================================================
// CONSISTENT COLOR SYSTEM (Used across all cards, badges, pipelines)
// ============================================================================

export interface BadgeColors {
  bg: string
  text: string
  border: string
  dot?: string
}

/** Unified status colors for contacts, leads, and general statuses */
export const STATUS_COLORS: Record<string, BadgeColors> = {
  // Contact & Lead statuses
  new: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', dot: 'bg-blue-400' },
  contacted: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30', dot: 'bg-cyan-400' },
  called: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30', dot: 'bg-cyan-400' },
  follow_up: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', dot: 'bg-amber-400' },
  qualified: { bg: 'bg-violet-500/20', text: 'text-violet-400', border: 'border-violet-500/30', dot: 'bg-violet-400' },
  docs_pending: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30', dot: 'bg-orange-400' },
  ready_to_convert: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
  positive: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', dot: 'bg-green-400' },
  converted: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
  not_interested: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', dot: 'bg-red-400' },
  invalid: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', dot: 'bg-gray-400' },
  lost: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', dot: 'bg-red-400' },
  active: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', dot: 'bg-blue-400' },
  dropped: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', dot: 'bg-red-400' },
  // Follow-up statuses
  pending: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', dot: 'bg-amber-400' },
  in_progress: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', dot: 'bg-blue-400' },
  completed: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', dot: 'bg-green-400' },
  overdue: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', dot: 'bg-red-400' },
  cancelled: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', dot: 'bg-gray-400' },
  rescheduled: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', border: 'border-indigo-500/30', dot: 'bg-indigo-400' },
}

/** Unified deal status colors */
export const DEAL_STATUS_COLORS: Record<string, BadgeColors> = {
  in_progress: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', dot: 'bg-blue-400' },
  sanctioned: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', dot: 'bg-green-400' },
  dropped: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', dot: 'bg-red-400' },
  disbursed: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
}

/** Unified deal stage colors (consistent across list and detail views) */
export const DEAL_STAGE_COLORS: Record<string, BadgeColors> = {
  docs_collected: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', dot: 'bg-blue-400' },
  finalized_bank: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', border: 'border-indigo-500/30', dot: 'bg-indigo-400' },
  login_complete: { bg: 'bg-violet-500/20', text: 'text-violet-400', border: 'border-violet-500/30', dot: 'bg-violet-400' },
  post_login_pending_cleared: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30', dot: 'bg-purple-400' },
  process_started_at_bank: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30', dot: 'bg-cyan-400' },
  case_assessed_by_banker: { bg: 'bg-teal-500/20', text: 'text-teal-400', border: 'border-teal-500/30', dot: 'bg-teal-400' },
  pd_complete: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', dot: 'bg-amber-400' },
  sanctioned: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', dot: 'bg-green-400' },
  disbursed: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
  dropped: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', dot: 'bg-red-400' },
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/** Get badge colors for any status, with fallback */
export function getStatusBadgeColors(status: string): BadgeColors {
  const key = status.toLowerCase().replace(/\s+/g, '_')
  return STATUS_COLORS[key] || { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', dot: 'bg-gray-400' }
}

/** Get badge colors for deal status */
export function getDealStatusColors(status: string): BadgeColors {
  return DEAL_STATUS_COLORS[status.toLowerCase()] || getStatusBadgeColors(status)
}

/** Get badge colors for deal stage */
export function getDealStageColors(stage: string): BadgeColors {
  return DEAL_STAGE_COLORS[stage] || getStatusBadgeColors(stage)
}

/** Format stage name for display */
export function formatStageName(stage: string): string {
  return DEAL_STAGE_LABELS[stage] || LEAD_STAGE_LABELS[stage] || stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/** Format status name for display */
export function formatStatusName(status: string): string {
  return CONTACT_STATUS_LABELS[status] || status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/** Allowed sort columns for leads (whitelist for security) */
export const LEAD_SORT_WHITELIST = [
  'created_at', 'updated_at', 'customer_name', 'loan_amount',
  'status', 'stage', 'lead_score', 'phone',
] as const

/** Allowed sort columns for deals */
export const DEAL_SORT_WHITELIST = [
  'created_at', 'updated_at', 'customer_name', 'loan_amount',
  'status', 'stage', 'deal_value',
] as const

/** Validate a sort column against a whitelist */
export function isValidSortColumn(col: string, whitelist: readonly string[]): boolean {
  return whitelist.includes(col)
}

// ============================================================================
// WHATSAPP & PHONE UTILITIES
// ============================================================================

/**
 * Format a phone number for WhatsApp API links
 * Ensures Indian country code (91) is prepended
 */
export function formatWhatsAppLink(phone: string | null | undefined): string {
  if (!phone) return '#'
  const cleaned = phone.replace(/[^0-9]/g, '')
  // If 10 digits (Indian local), prepend 91
  if (cleaned.length === 10) return `https://wa.me/91${cleaned}`
  // If already has country code (12 digits starting with 91)
  if (cleaned.length === 12 && cleaned.startsWith('91')) return `https://wa.me/${cleaned}`
  // If 11 digits starting with 0, strip leading 0 and prepend 91
  if (cleaned.length === 11 && cleaned.startsWith('0')) return `https://wa.me/91${cleaned.slice(1)}`
  // Fallback: use as-is
  return `https://wa.me/${cleaned}`
}

/**
 * Format a phone number for tel: links
 */
export function formatTelLink(phone: string | null | undefined): string {
  if (!phone) return '#'
  const cleaned = phone.replace(/[^0-9+]/g, '')
  return `tel:${cleaned}`
}

/**
 * Clean a phone number (digits only)
 */
export function cleanPhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '')
}

/**
 * Safely copy text to clipboard with fallback
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
    // Fallback for insecure contexts
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const success = document.execCommand('copy')
    document.body.removeChild(textarea)
    return success
  } catch {
    return false
  }
}

// ============================================================================
// SEARCH SANITIZATION
// ============================================================================

/**
 * Sanitize search input for use in PostgREST .or() filters
 * Prevents filter injection by escaping special characters
 */
export function sanitizeSearchForPostgrest(search: string): string {
  // Remove characters that could break PostgREST filter syntax
  return search
    .replace(/[,.()\[\]{}|\\]/g, '')
    .replace(/['";]/g, '')
    .trim()
    .slice(0, 100)
}

// ============================================================================
// DATE HELPERS (IST-consistent)
// ============================================================================

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

/** Get today's start in IST as ISO string */
export function getTodayStartIST(): string {
  const now = new Date()
  const istNow = new Date(now.getTime() + IST_OFFSET_MS)
  istNow.setUTCHours(0, 0, 0, 0)
  return new Date(istNow.getTime() - IST_OFFSET_MS).toISOString()
}

/** Get week start (7 days ago) in IST as ISO string */
export function getWeekStartIST(): string {
  const now = new Date()
  const istNow = new Date(now.getTime() + IST_OFFSET_MS)
  istNow.setUTCHours(0, 0, 0, 0)
  istNow.setUTCDate(istNow.getUTCDate() - 7)
  return new Date(istNow.getTime() - IST_OFFSET_MS).toISOString()
}

/** Get month start in IST as ISO string */
export function getMonthStartIST(): string {
  const now = new Date()
  const istNow = new Date(now.getTime() + IST_OFFSET_MS)
  istNow.setUTCHours(0, 0, 0, 0)
  istNow.setUTCDate(1)
  return new Date(istNow.getTime() - IST_OFFSET_MS).toISOString()
}

/** Add end-of-day time to a date string for inclusive date range queries */
export function toEndOfDay(dateStr: string): string {
  return `${dateStr}T23:59:59.999Z`
}

/** Get local datetime string for datetime-local inputs (IST) */
export function getLocalDateTimeMin(): string {
  const now = new Date()
  const istNow = new Date(now.getTime() + IST_OFFSET_MS)
  return istNow.toISOString().slice(0, 16)
}

// ============================================================================
// LOAN TYPES
// ============================================================================

export const LOAN_TYPES = [
  'Home Loan',
  'Business Loan',
  'Personal Loan',
  'Loan Against Property',
  'Car Loan',
  'Education Loan',
  'Gold Loan',
  'Working Capital Loan',
  'MSME Loan',
  'Bill Discounting',
  'Overdraft',
  'Commercial Vehicle Loan',
  'Construction Finance',
  'Lease Rental Discounting',
  'Balance Transfer',
  'Top Up Loan',
] as const

// ============================================================================
// API FIELD MAPPINGS (canonical field names)
// ============================================================================

/** Maps client-side field names to database column names for leads */
export const LEAD_FIELD_MAPPING: Record<string, string> = {
  customer_name: 'customer_name',
  name: 'customer_name',
  phone: 'phone',
  customer_mobile: 'phone',
  email: 'email',
  loan_type: 'loan_type',
  loan_amount: 'loan_amount',
  loan_purpose: 'loan_purpose',
  purpose: 'loan_purpose',
  monthly_income: 'monthly_income',
  employment_type: 'employment_type',
  business_name: 'business_name',
  city: 'city',
  state: 'state',
  status: 'status',
  stage: 'stage',
  lead_score: 'lead_score',
  notes: 'notes',
  cro_id: 'cro_id',
  assigned_to: 'cro_id',
}

/** Maps client-side field names to database column names for deals */
export const DEAL_FIELD_MAPPING: Record<string, string> = {
  customer_name: 'customer_name',
  phone: 'phone',
  loan_type: 'loan_type',
  loan_amount: 'loan_amount',
  deal_value: 'deal_value',
  expected_bank: 'expected_bank',
  finalized_bank: 'finalized_bank',
  stage: 'stage',
  status: 'status',
  notes: 'notes',
  assigned_to_bde: 'assigned_to_bde',
  assigned_at: 'assigned_at',
}
