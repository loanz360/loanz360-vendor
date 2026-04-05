/**
 * CRO Portal Shared Utilities
 * Common formatting, validation, and helper functions for the CRO portal
 */

// ============================================================================
// CURRENCY FORMATTING (Indian - Lakhs/Crores)
// ============================================================================

/**
 * Format a number as Indian currency (₹)
 * Uses Lakh (L) and Crore (Cr) notation
 */
export function formatINR(amount: number | null | undefined, compact = true): string {
  if (amount == null || isNaN(amount)) return '₹0'

  if (!compact) {
    return `₹${amount.toLocaleString('en-IN')}`
  }

  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(1)}Cr`
  }
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`
  }
  return `₹${amount.toLocaleString('en-IN')}`
}

/**
 * Format a number as compact Indian notation without ₹ symbol
 */
export function formatCompactINR(amount: number): string {
  if (amount >= 10000000) return `${(amount / 10000000).toFixed(1)}Cr`
  if (amount >= 100000) return `${(amount / 100000).toFixed(1)}L`
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`
  return amount.toString()
}

// ============================================================================
// DATE & TIME FORMATTING
// ============================================================================

/**
 * Format a date string to Indian locale
 */
export function formatDateIN(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Format a date to time only
 */
export function formatTimeIN(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Format a date as relative time ("2 hours ago", "Just now", etc.)
 */
export function formatTimeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDateIN(dateStr)
}

/**
 * Format call duration in seconds to MM:SS
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

// ============================================================================
// STRING FORMATTING
// ============================================================================

/**
 * Replace underscores with spaces and capitalize words
 */
export function formatStatus(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

/**
 * Mask a phone number for privacy (show last 4 digits)
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 4) return phone
  const clean = phone.replace(/[^0-9+]/g, '')
  return clean.slice(0, -4).replace(/\d/g, '*') + clean.slice(-4)
}

// ============================================================================
// LEAD SCORING HELPERS
// ============================================================================

/**
 * Get lead priority color based on score
 */
export function getLeadScoreColor(score: number): string {
  if (score >= 80) return 'text-green-400'
  if (score >= 60) return 'text-emerald-400'
  if (score >= 40) return 'text-yellow-400'
  if (score >= 20) return 'text-orange-400'
  return 'text-red-400'
}

/**
 * Get lead priority background color
 */
export function getLeadScoreBg(score: number): string {
  if (score >= 80) return 'bg-green-500/20'
  if (score >= 60) return 'bg-emerald-500/20'
  if (score >= 40) return 'bg-yellow-500/20'
  if (score >= 20) return 'bg-orange-500/20'
  return 'bg-red-500/20'
}

/**
 * Get status badge color for lead/contact statuses
 */
export function getStatusColor(status: string): { bg: string; text: string; border: string } {
  const statusMap: Record<string, { bg: string; text: string; border: string }> = {
    new: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
    contacted: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30' },
    called: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30' },
    follow_up: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
    qualified: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
    positive: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
    converted: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    not_interested: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
    lost: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
    pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
    in_progress: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
    completed: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
    overdue: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  }
  return statusMap[status.toLowerCase()] || { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' }
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate Indian phone number
 */
export function isValidIndianPhone(phone: string): boolean {
  const cleaned = phone.replace(/[^0-9+]/g, '')
  return /^(\+91)?[6-9]\d{9}$/.test(cleaned)
}

/**
 * Validate email
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * Escape CSV cell to prevent CSV injection
 */
export function escapeCSVCell(value: string): string {
  let escaped = value
  if (/^[=+\-@]/.test(escaped)) {
    escaped = "'" + escaped
  }
  return `"${escaped.replace(/"/g, '""')}"`
}

// ============================================================================
// CRO ROLE HELPERS
// ============================================================================

export const CRO_ALLOWED_ROLES = [
  'CRO',
  'CUSTOMER RELATIONSHIP OFFICER',
  'CRO_TEAM_LEADER',
  'CRO_STATE_MANAGER',
  'SUPER_ADMIN',
  'ADMIN',
] as const

/**
 * Check if a user role has CRO access
 */
export function hasCROAccess(role: string): boolean {
  return CRO_ALLOWED_ROLES.some(r => role.toUpperCase().includes(r))
}

/**
 * Check if user is a CRO manager (TL or SM)
 */
export function isCROManager(role: string): boolean {
  const upper = role.toUpperCase()
  return upper.includes('CRO_TEAM_LEADER') || upper.includes('CRO_STATE_MANAGER')
}
