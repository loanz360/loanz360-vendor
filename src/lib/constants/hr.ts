// ============================================================================
// HR Module Shared Constants
// Centralized constants for all HR sub-role pages
// ============================================================================

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
] as const

// ---------- Status Color Maps ----------

export const HR_STATUS_COLORS: Record<string, string> = {
  // General statuses
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  approved: 'bg-green-500/20 text-green-400 border-green-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  processing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  paid: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  disputed: 'bg-red-500/20 text-red-400 border-red-500/30',
  withdrawn: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  on_hold: 'bg-orange-500/20 text-orange-400 border-orange-500/30',

  // PIP statuses
  active: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  extended: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  terminated: 'bg-red-500/20 text-red-400 border-red-500/30',
  successful: 'bg-green-500/20 text-green-400 border-green-500/30',

  // Document statuses
  verified: 'bg-green-500/20 text-green-400 border-green-500/30',
  expired: 'bg-red-500/20 text-red-400 border-red-500/30',

  // Ticket statuses
  open: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  resolved: 'bg-green-500/20 text-green-400 border-green-500/30',
  closed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  reopened: 'bg-orange-500/20 text-orange-400 border-orange-500/30',

  // Milestone statuses
  missed: 'bg-red-500/20 text-red-400 border-red-500/30',

  // Review statuses
  acknowledged: 'bg-purple-500/20 text-purple-400 border-purple-500/30',

  // Payroll statuses
  draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  processed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',

  // Default
  default: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

// Dot-style status colors (for badges with dots)
export const HR_STATUS_DOT_COLORS: Record<string, string> = {
  pending: 'bg-yellow-400',
  approved: 'bg-green-400',
  rejected: 'bg-red-400',
  completed: 'bg-green-400',
  in_progress: 'bg-blue-400',
  processing: 'bg-blue-400',
  paid: 'bg-emerald-400',
  active: 'bg-blue-400',
  terminated: 'bg-red-400',
  successful: 'bg-green-400',
  extended: 'bg-orange-400',
  verified: 'bg-green-400',
  expired: 'bg-red-400',
  open: 'bg-blue-400',
  resolved: 'bg-green-400',
  closed: 'bg-gray-400',
  default: 'bg-gray-400',
}

// ---------- Review Type Colors ----------

export const REVIEW_TYPE_COLORS: Record<string, string> = {
  quarterly: 'bg-blue-500/20 text-blue-400',
  annual: 'bg-purple-500/20 text-purple-400',
  probation: 'bg-orange-500/20 text-orange-400',
  promotion: 'bg-green-500/20 text-green-400',
}

// ---------- Holiday Type Colors ----------

export const HOLIDAY_TYPE_COLORS: Record<string, string> = {
  national: 'border-blue-500',
  festival: 'border-purple-500',
  company: 'border-green-500',
  optional: 'border-yellow-500',
}

export const HOLIDAY_BADGE_COLORS: Record<string, string> = {
  national: 'bg-blue-500/20 text-blue-400',
  festival: 'bg-purple-500/20 text-purple-400',
  company: 'bg-green-500/20 text-green-400',
  optional: 'bg-yellow-500/20 text-yellow-400',
}

// ---------- Exit Type Labels ----------

export const EXIT_TYPE_LABELS: Record<string, string> = {
  resignation: 'Resignation',
  termination: 'Termination',
  retirement: 'Retirement',
  contract_end: 'Contract End',
}

// ---------- Reason Category Labels ----------

export const REASON_CATEGORY_LABELS: Record<string, string> = {
  better_opportunity: 'Better Opportunity',
  personal: 'Personal Reasons',
  relocation: 'Relocation',
  career_change: 'Career Change',
  health: 'Health Issues',
  higher_studies: 'Higher Studies',
  other: 'Other',
}

// ---------- Document Type Config ----------

export const DOCUMENT_TYPES = ['contract', 'id_proof', 'education', 'offer_letter', 'policy', 'form', 'other'] as const

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  contract: 'Contract',
  id_proof: 'ID Proof',
  education: 'Education',
  offer_letter: 'Offer Letter',
  policy: 'Policy',
  form: 'Form',
  other: 'Other',
}

// ---------- PIP Statuses ----------

export const PIP_STATUSES = ['active', 'completed', 'extended', 'terminated', 'successful'] as const

// ---------- Ticket Priority Colors ----------

export const TICKET_PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-500/20 text-gray-400',
  medium: 'bg-blue-500/20 text-blue-400',
  high: 'bg-orange-500/20 text-orange-400',
  urgent: 'bg-red-500/20 text-red-400',
}

// ---------- Payment Modes ----------

export const PAYMENT_MODES = [
  { value: 'bank_transfer', label: 'Bank Transfer (NEFT/RTGS)' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'upi', label: 'UPI' },
  { value: 'cash', label: 'Cash' },
] as const

// ---------- Default Page Size ----------

export const HR_PAGE_SIZE = 10
