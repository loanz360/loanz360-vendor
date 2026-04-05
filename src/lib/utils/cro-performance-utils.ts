/**
 * CRO Performance & Rewards - UI Utility Functions
 * =================================================
 * Single source of truth for all formatting, color, and display utilities
 * used across the CRO Performance & Rewards module.
 *
 * This file consolidates duplicated helpers from individual tab components
 * (Overview, KPIs, Leaderboard, Incentives, Goals, History) into one
 * canonical location. Import from here instead of defining inline.
 *
 * @module cro-performance-utils
 */

// ---------------------------------------------------------------------------
// Currency Formatting
// ---------------------------------------------------------------------------

/**
 * Format a number as compact Indian Rupee notation.
 *
 * - >= 1 Cr  -> `₹X.XCr`
 * - >= 1 L   -> `₹X.XL`
 * - >= 1 K   -> `₹X.XK`
 * - otherwise -> `₹X,XX,XXX` (en-IN locale)
 *
 * @param amount - Numeric amount in INR
 * @returns Formatted currency string
 */
export function formatINR(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`
  return `₹${amount.toLocaleString('en-IN')}`
}

// ---------------------------------------------------------------------------
// Date / Month / Duration Formatting
// ---------------------------------------------------------------------------

/**
 * Format a `YYYY-MM` month string into full month + year (e.g. "March 2026").
 *
 * @param month - Month string in `YYYY-MM` format
 * @returns Long-form month label
 */
export function formatMonth(month: string): string {
  const [year, monthNum] = month.split('-')
  const date = new Date(parseInt(year), parseInt(monthNum) - 1)
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

/**
 * Format a `YYYY-MM` month string into abbreviated month + year (e.g. "Mar 2026").
 *
 * @param month - Month string in `YYYY-MM` format
 * @returns Short-form month label
 */
export function formatMonthShort(month: string): string {
  const [year, monthNum] = month.split('-')
  const date = new Date(parseInt(year), parseInt(monthNum) - 1)
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

/**
 * Format a date string into `day short-month` (e.g. "22 Mar").
 *
 * @param dateStr - Any `Date`-parseable string
 * @returns Formatted date label
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/**
 * Format a date string into `short-month day` (e.g. "Mar 22").
 *
 * @param dateStr - Any `Date`-parseable string
 * @returns Formatted short date label
 */
export function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
}

/**
 * Format a duration in seconds as `M:SS` (e.g. "3:05").
 *
 * @param seconds - Duration in seconds
 * @returns Formatted duration string
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Metric Value Formatting
// ---------------------------------------------------------------------------

/**
 * Format a numeric metric value with its unit.
 *
 * Handles currency (`₹`), percentages (`%`), time (`min`), ratings (`/5`),
 * durations (`days`), and generic numeric units.
 *
 * @param value - The numeric metric value
 * @param unit  - The unit string (`₹`, `%`, `min`, `/5`, `days`, or custom)
 * @returns Formatted metric string
 */
export function formatMetricValue(value: number, unit: string): string {
  if (unit === '₹') return formatINR(value)
  if (unit === '%') return `${value.toFixed(1)}%`
  if (unit === 'min') return `${value.toFixed(1)} min`
  if (unit === '/5') return `${value.toFixed(1)}/5`
  if (unit === 'days') return `${value.toFixed(1)} days`
  return `${value.toLocaleString('en-IN')} ${unit}`
}

// ---------------------------------------------------------------------------
// Progress / Achievement Color Helpers
// ---------------------------------------------------------------------------

/**
 * Return a Tailwind `bg-*` class for a progress bar based on achievement %.
 *
 * | Achievement | Color        |
 * |-------------|--------------|
 * | >= 100%     | green-500    |
 * | >= 75%      | blue-500     |
 * | >= 50%      | yellow-500   |
 * | < 50%       | orange-500   |
 *
 * @param achievement - Achievement percentage (0-100+)
 * @returns Tailwind background class
 */
export function getProgressColor(achievement: number): string {
  if (achievement >= 100) return 'bg-green-500'
  if (achievement >= 75) return 'bg-blue-500'
  if (achievement >= 50) return 'bg-yellow-500'
  return 'bg-orange-500'
}

/**
 * Return a Tailwind `text-*` class matching the progress color scheme.
 *
 * @param achievement - Achievement percentage (0-100+)
 * @returns Tailwind text color class
 */
export function getProgressTextColor(achievement: number): string {
  if (achievement >= 100) return 'text-green-400'
  if (achievement >= 75) return 'text-blue-400'
  if (achievement >= 50) return 'text-yellow-400'
  return 'text-orange-400'
}

/** Shape returned by badge helpers. */
export interface BadgeInfo {
  /** Display label */
  text: string
  /** Tailwind class string (typically bg + text color) */
  className: string
}

/**
 * Return a badge label and color based on achievement percentage.
 *
 * @param achievement - Achievement percentage (0-100+)
 * @returns Badge text and Tailwind class
 */
export function getAchievementBadge(achievement: number): BadgeInfo {
  if (achievement >= 100) return { text: 'Achieved', className: 'bg-green-500/20 text-green-400' }
  if (achievement >= 75) return { text: 'On Track', className: 'bg-blue-500/20 text-blue-400' }
  if (achievement >= 50) return { text: 'Needs Push', className: 'bg-yellow-500/20 text-yellow-400' }
  return { text: 'Behind', className: 'bg-red-500/20 text-red-400' }
}

/**
 * Return a Tailwind class string for a performance grade letter.
 *
 * @param grade - Grade string (e.g. "A+", "B", "C-", "D")
 * @returns Tailwind bg + text class
 */
export function getGradeColor(grade: string): string {
  if (grade.startsWith('A')) return 'bg-green-500/20 text-green-400'
  if (grade.startsWith('B')) return 'bg-blue-500/20 text-blue-400'
  if (grade.startsWith('C')) return 'bg-yellow-500/20 text-yellow-400'
  return 'bg-red-500/20 text-red-400'
}

/**
 * Return a badge label and color for an incentive / goal status.
 *
 * @param status - Status key (e.g. `achieved`, `in_progress`, `eligible`, `expired`)
 * @returns Badge text and Tailwind class
 */
export function getStatusBadge(status: string): BadgeInfo {
  switch (status) {
    case 'achieved': return { text: 'Achieved!', className: 'bg-green-500/20 text-green-400' }
    case 'in_progress': return { text: 'In Progress', className: 'bg-blue-500/20 text-blue-400' }
    case 'eligible': return { text: 'Eligible', className: 'bg-gray-500/20 text-gray-400' }
    case 'expired': return { text: 'Expired', className: 'bg-red-500/20 text-red-400' }
    default: return { text: status.replace(/_/g, ' '), className: 'bg-gray-500/20 text-gray-400' }
  }
}

// ---------------------------------------------------------------------------
// Theme Color Constants
// ---------------------------------------------------------------------------

/** Accent color set for a quick-stat card or category. */
export interface AccentColorSet {
  /** Tailwind background class (e.g. `bg-orange-500/10`) */
  bg: string
  /** Tailwind text class (e.g. `text-orange-400`) */
  text: string
  /** Tailwind border class (e.g. `border-orange-500/20`) */
  border: string
}

/** Rank display colors for the leaderboard podium. */
export interface RankColorSet {
  /** Tailwind text class for the icon / medal */
  icon: string
  /** Tailwind background class */
  bg: string
}

/**
 * Consistent card accent and category colors used across the
 * CRO Performance & Rewards module.
 */
export const PERFORMANCE_COLORS = {
  // Quick stat card colors
  overall: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' } as AccentColorSet,
  rank: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' } as AccentColorSet,
  target: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' } as AccentColorSet,
  insights: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' } as AccentColorSet,

  // Metric category text colors
  calls: 'text-blue-400',
  leads: 'text-green-400',
  deals: 'text-purple-400',
  revenue: 'text-orange-400',
  quality: 'text-yellow-400',

  // Graph / chart line hex colors
  graphLines: {
    calls_made: '#3B82F6',
    leads_converted: '#10B981',
    cases_sanctioned: '#F59E0B',
    cases_disbursed: '#8B5CF6',
    revenue: '#FF6700',
  },

  // Trend indicator text colors
  trendUp: 'text-green-400',
  trendDown: 'text-red-400',
  trendStable: 'text-gray-400',
} as const

/**
 * Leaderboard podium rank colors (1st, 2nd, 3rd place).
 */
export const RANK_COLORS: Record<number, RankColorSet> = {
  1: { icon: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  2: { icon: 'text-gray-300', bg: 'bg-gray-500/20' },
  3: { icon: 'text-amber-600', bg: 'bg-amber-500/20' },
} as const
