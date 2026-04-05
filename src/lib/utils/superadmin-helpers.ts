/**
 * Shared utility functions for Super Admin portal
 * Replaces 200+ duplicate implementations across modules
 */

// ─── Status Color Mapping ─────────────────────────────────────────────
export type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'orange'

export interface StatusColorResult {
  bg: string
  text: string
  border: string
  dot: string
  badge: string
}

const STATUS_COLOR_MAP: Record<StatusVariant, StatusColorResult> = {
  success: {
    bg: 'bg-green-900/30',
    text: 'text-green-400',
    border: 'border-green-500/30',
    dot: 'bg-green-400',
    badge: 'bg-green-900/30 text-green-400 border-green-500/30',
  },
  warning: {
    bg: 'bg-yellow-900/30',
    text: 'text-yellow-400',
    border: 'border-yellow-500/30',
    dot: 'bg-yellow-400',
    badge: 'bg-yellow-900/30 text-yellow-400 border-yellow-500/30',
  },
  error: {
    bg: 'bg-red-900/30',
    text: 'text-red-400',
    border: 'border-red-500/30',
    dot: 'bg-red-400',
    badge: 'bg-red-900/30 text-red-400 border-red-500/30',
  },
  info: {
    bg: 'bg-blue-900/30',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    dot: 'bg-blue-400',
    badge: 'bg-blue-900/30 text-blue-400 border-blue-500/30',
  },
  neutral: {
    bg: 'bg-gray-800/50',
    text: 'text-gray-400',
    border: 'border-gray-600/30',
    dot: 'bg-gray-400',
    badge: 'bg-gray-800/50 text-gray-400 border-gray-600/30',
  },
  orange: {
    bg: 'bg-orange-900/30',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
    dot: 'bg-orange-400',
    badge: 'bg-orange-900/30 text-orange-400 border-orange-500/30',
  },
}

/**
 * Maps a status string to a color variant
 * Handles all common status values across the application
 */
export function getStatusVariant(status: string | null | undefined): StatusVariant {
  if (!status) return 'neutral'
  const s = status.toLowerCase().replace(/[_-]/g, '')

  // Success statuses
  if (['active', 'enabled', 'approved', 'completed', 'verified', 'paid', 'live', 'published', 'success', 'open', 'resolved'].includes(s)) {
    return 'success'
  }

  // Warning statuses
  if (['pending', 'pendingapproval', 'pendingreview', 'review', 'inprogress', 'processing', 'draft', 'probation', 'onleave', 'warning', 'partial', 'scheduled'].includes(s)) {
    return 'warning'
  }

  // Error statuses
  if (['inactive', 'disabled', 'rejected', 'failed', 'suspended', 'terminated', 'blocked', 'expired', 'closed', 'cancelled', 'error', 'deleted'].includes(s)) {
    return 'error'
  }

  // Info statuses
  if (['info', 'new', 'created', 'invited', 'onboarding', 'transferred'].includes(s)) {
    return 'info'
  }

  return 'neutral'
}

/**
 * Get color classes for a status string
 * Returns StatusColorResult with bg, text, border, dot, badge classes
 */
export function getStatusColor(status: string | null | undefined): StatusColorResult {
  return STATUS_COLOR_MAP[getStatusVariant(status)]
}

/**
 * Get color classes by variant directly
 */
export function getColorByVariant(variant: StatusVariant): StatusColorResult {
  return STATUS_COLOR_MAP[variant]
}

// ─── Category Color Mapping ──────────────────────────────────────────

const CATEGORY_COLOR_MAP: Record<string, string> = {
  blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  green: 'bg-green-500/20 text-green-400 border-green-500/30',
  orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  cyan: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  pink: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
}

/**
 * Get color classes for a named color (used by income categories, profiles, etc.)
 * Returns Tailwind class string for background, text, and border.
 */
export function getCategoryColorClasses(color: string | null | undefined): string {
  return CATEGORY_COLOR_MAP[color || 'blue'] || CATEGORY_COLOR_MAP.blue
}

// ─── Date Formatting ──────────────────────────────────────────────────

/**
 * Format a date string or Date object to a human-readable format
 */
export function formatDate(
  date: string | Date | null | undefined,
  options?: {
    includeTime?: boolean
    relative?: boolean
    format?: 'short' | 'medium' | 'long'
  }
): string {
  if (!date) return '-'

  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '-'

  if (options?.relative) {
    return getRelativeTime(d)
  }

  const format = options?.format || 'medium'

  const dateOptions: Intl.DateTimeFormatOptions = {
    ...(format === 'short' && { day: '2-digit', month: 'short', year: '2-digit' }),
    ...(format === 'medium' && { day: 'numeric', month: 'short', year: 'numeric' }),
    ...(format === 'long' && { day: 'numeric', month: 'long', year: 'numeric', weekday: 'short' }),
  }

  if (options?.includeTime) {
    dateOptions.hour = '2-digit'
    dateOptions.minute = '2-digit'
    dateOptions.hour12 = true
  }

  return d.toLocaleDateString('en-IN', dateOptions)
}

/**
 * Format a date to relative time (e.g., "2 hours ago", "3 days ago")
 */
export function getRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHr / 24)

  if (diffSec < 60) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
  return `${Math.floor(diffDays / 365)}y ago`
}

/**
 * Format a date for datetime-local input values
 */
export function toDateInputValue(date: string | Date | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  return d.toISOString().split('T')[0]
}

// ─── Query Params Builder ─────────────────────────────────────────────

/**
 * Build URLSearchParams from a filter object, omitting falsy values
 */
export function buildQueryParams(
  filters: Record<string, string | number | boolean | null | undefined>
): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== null && value !== undefined && value !== '') {
      params.append(key, String(value))
    }
  }
  return params
}

// ─── Name & Label Formatting ──────────────────────────────────────────

/**
 * Format a snake_case or UPPER_SNAKE_CASE string to Title Case
 */
export function formatLabel(value: string | null | undefined): string {
  if (!value) return '-'
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim()
}

/**
 * Format a role key to display name
 */
export function formatRoleName(role: string | null | undefined): string {
  if (!role) return '-'
  return role
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

// ─── Validation Helpers ───────────────────────────────────────────────

/**
 * Validate email format with proper TLD check
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  return emailRegex.test(email) && email.length <= 254
}

/**
 * Validate Indian mobile number (10 digits, starts with 6-9)
 */
export function isValidIndianMobile(mobile: string): boolean {
  const cleaned = mobile.replace(/\D/g, '')
  return /^[6-9]\d{9}$/.test(cleaned)
}

/**
 * Validate UUID format
 */
export function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

/**
 * Validate date is not in the future
 */
export function isNotFutureDate(date: string | Date): boolean {
  const d = typeof date === 'string' ? new Date(date) : date
  return d <= new Date()
}

/**
 * Validate date A is before date B
 */
export function isDateBefore(dateA: string | Date, dateB: string | Date): boolean {
  const a = typeof dateA === 'string' ? new Date(dateA) : dateA
  const b = typeof dateB === 'string' ? new Date(dateB) : dateB
  return a < b
}

// ─── Sanitize Search Input ────────────────────────────────────────────

/**
 * Sanitize a search query for safe use in database queries
 */
export function sanitizeSearchQuery(query: string): string {
  if (!query || typeof query !== 'string') return ''
  return query
    .trim()
    .replace(/[%_'";\\\[\]{}()<>]/g, '')
    .slice(0, 200)
}

// ─── API Fetch Helpers ────────────────────────────────────────────────

export interface ApiResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
  meta?: Record<string, unknown>
}

/**
 * Standard fetch wrapper for SuperAdmin API calls
 */
export async function superAdminFetch<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: data.error || data.message || `Request failed with status ${response.status}`,
      }
    }

    return data as ApiResult<T>
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error'
    return { success: false, error: message }
  }
}

// ─── Constants ────────────────────────────────────────────────────────

export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  PER_PAGE: 20,
  MAX_PER_PAGE: 100,
} as const

export const BULK_IMPORT_LIMITS = {
  MAX_ROWS: 50,
  MAX_FILE_SIZE_MB: 5,
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024,
} as const

/**
 * Generate dynamic month options for the last N months
 */
export function getMonthOptions(count: number = 12): Array<{ value: string; label: string }> {
  const months: Array<{ value: string; label: string }> = []
  const now = new Date()

  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    })
  }

  return months
}
