/**
 * Timezone Utilities
 * Handles timezone conversions for multi-timezone support
 */

import { format, formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz'
import { parseISO, isValid } from 'date-fns'

// Default timezone (Asia/Kolkata for India)
export const DEFAULT_TIMEZONE = 'Asia/Kolkata'

// Common Indian timezones
export const INDIAN_TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'India Standard Time (IST)', offset: '+05:30' },
]

// All supported timezones (expandable)
export const SUPPORTED_TIMEZONES = [
  ...INDIAN_TIMEZONES,
  { value: 'UTC', label: 'Coordinated Universal Time (UTC)', offset: '+00:00' },
  { value: 'America/New_York', label: 'Eastern Time (ET)', offset: '-05:00' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', offset: '-08:00' },
  { value: 'Europe/London', label: 'British Time (GMT/BST)', offset: '+00:00' },
  { value: 'Asia/Dubai', label: 'Gulf Standard Time (GST)', offset: '+04:00' },
  { value: 'Asia/Singapore', label: 'Singapore Time (SGT)', offset: '+08:00' },
]

/**
 * Convert UTC date to user's timezone
 */
export function utcToUserTimezone(
  utcDate: Date | string,
  timezone: string = DEFAULT_TIMEZONE
): Date {
  try {
    const date = typeof utcDate === 'string' ? parseISO(utcDate) : utcDate

    if (!isValid(date)) {
      throw new Error('Invalid date provided')
    }

    return toZonedTime(date, timezone)
  } catch (error) {
    console.error('Error converting UTC to user timezone:', error)
    return new Date() // Fallback to current date
  }
}

/**
 * Convert user's timezone to UTC
 */
export function userTimezoneToUtc(
  localDate: Date | string,
  timezone: string = DEFAULT_TIMEZONE
): Date {
  try {
    const date = typeof localDate === 'string' ? parseISO(localDate) : localDate

    if (!isValid(date)) {
      throw new Error('Invalid date provided')
    }

    return fromZonedTime(date, timezone)
  } catch (error) {
    console.error('Error converting user timezone to UTC:', error)
    return new Date() // Fallback to current date
  }
}

/**
 * Format date in user's timezone
 */
export function formatInUserTimezone(
  date: Date | string,
  formatStr: string = 'PPpp', // e.g., "Apr 29, 2023, 9:30 AM"
  timezone: string = DEFAULT_TIMEZONE
): string {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date

    if (!isValid(dateObj)) {
      return 'Invalid date'
    }

    return formatInTimeZone(dateObj, timezone, formatStr)
  } catch (error) {
    console.error('Error formatting date in timezone:', error)
    return 'Invalid date'
  }
}

/**
 * Get current time in user's timezone
 */
export function getCurrentTimeInTimezone(timezone: string = DEFAULT_TIMEZONE): Date {
  return toZonedTime(new Date(), timezone)
}

/**
 * Convert contest dates for display
 * Returns both formatted strings and Date objects
 */
export function formatContestDates(
  startDate: string | Date,
  endDate: string | Date,
  timezone: string = DEFAULT_TIMEZONE
) {
  const start = utcToUserTimezone(startDate, timezone)
  const end = utcToUserTimezone(endDate, timezone)

  return {
    startDate: start,
    endDate: end,
    formattedStartDate: formatInUserTimezone(startDate, 'PPP', timezone), // e.g., "April 29, 2023"
    formattedEndDate: formatInUserTimezone(endDate, 'PPP', timezone),
    formattedStartDateTime: formatInUserTimezone(startDate, 'PPpp', timezone), // e.g., "Apr 29, 2023, 9:30 AM"
    formattedEndDateTime: formatInUserTimezone(endDate, 'PPpp', timezone),
    timezoneName: timezone,
    timezoneAbbr: getTimezoneAbbreviation(timezone),
  }
}

/**
 * Get timezone abbreviation (e.g., "IST" for "Asia/Kolkata")
 */
export function getTimezoneAbbreviation(timezone: string): string {
  const tz = SUPPORTED_TIMEZONES.find((t) => t.value === timezone)
  if (tz) {
    // Extract abbreviation from label (text in parentheses)
    const match = tz.label.match(/\(([^)]+)\)/)
    if (match) {
      return match[1]
    }
  }
  return timezone.split('/').pop() || timezone
}

/**
 * Check if date is in the past (in user's timezone)
 */
export function isDateInPast(
  date: Date | string,
  timezone: string = DEFAULT_TIMEZONE
): boolean {
  const dateInTimezone = utcToUserTimezone(date, timezone)
  const now = getCurrentTimeInTimezone(timezone)
  return dateInTimezone < now
}

/**
 * Check if date is in the future (in user's timezone)
 */
export function isDateInFuture(
  date: Date | string,
  timezone: string = DEFAULT_TIMEZONE
): boolean {
  return !isDateInPast(date, timezone)
}

/**
 * Get days remaining until a date
 */
export function getDaysRemaining(
  targetDate: Date | string,
  timezone: string = DEFAULT_TIMEZONE
): number {
  const target = utcToUserTimezone(targetDate, timezone)
  const now = getCurrentTimeInTimezone(timezone)

  const diffInMs = target.getTime() - now.getTime()
  const diffInDays = Math.ceil(diffInMs / (1000 * 60 * 60 * 24))

  return Math.max(0, diffInDays)
}

/**
 * Get hours remaining until a date
 */
export function getHoursRemaining(
  targetDate: Date | string,
  timezone: string = DEFAULT_TIMEZONE
): number {
  const target = utcToUserTimezone(targetDate, timezone)
  const now = getCurrentTimeInTimezone(timezone)

  const diffInMs = target.getTime() - now.getTime()
  const diffInHours = Math.ceil(diffInMs / (1000 * 60 * 60))

  return Math.max(0, diffInHours)
}

/**
 * Format contest status with timezone-aware dates
 */
export function getContestStatusWithTimezone(
  startDate: Date | string,
  endDate: Date | string,
  timezone: string = DEFAULT_TIMEZONE
): {
  status: 'upcoming' | 'active' | 'ended'
  message: string
  daysRemaining?: number
} {
  const now = getCurrentTimeInTimezone(timezone)
  const start = utcToUserTimezone(startDate, timezone)
  const end = utcToUserTimezone(endDate, timezone)

  if (now < start) {
    const daysUntilStart = getDaysRemaining(start, timezone)
    return {
      status: 'upcoming',
      message: `Starts in ${daysUntilStart} ${daysUntilStart === 1 ? 'day' : 'days'}`,
      daysRemaining: daysUntilStart,
    }
  } else if (now >= start && now <= end) {
    const daysRemaining = getDaysRemaining(end, timezone)
    return {
      status: 'active',
      message: `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} remaining`,
      daysRemaining,
    }
  } else {
    return {
      status: 'ended',
      message: 'Contest ended',
    }
  }
}

/**
 * Validate timezone string
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone })
    return true
  } catch (error) {
    return false
  }
}

/**
 * Get user's browser timezone
 */
export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch (error) {
    return DEFAULT_TIMEZONE
  }
}

// ==========================================
// Consistent Date Formatting Helpers
// ==========================================

/**
 * Common date format patterns
 */
export const DATE_FORMATS = {
  // Short formats
  SHORT_DATE: 'dd/MM/yyyy', // 25/11/2024
  SHORT_DATE_TIME: 'dd/MM/yyyy HH:mm', // 25/11/2024 14:30
  SHORT_TIME: 'HH:mm', // 14:30

  // Medium formats
  MEDIUM_DATE: 'd MMM yyyy', // 25 Nov 2024
  MEDIUM_DATE_TIME: 'd MMM yyyy, h:mm a', // 25 Nov 2024, 2:30 PM

  // Long formats
  LONG_DATE: 'd MMMM yyyy', // 25 November 2024
  LONG_DATE_TIME: 'd MMMM yyyy, h:mm a', // 25 November 2024, 2:30 PM

  // Display formats
  MONTH_YEAR: 'MMMM yyyy', // November 2024
  MONTH_YEAR_SHORT: 'MMM yyyy', // Nov 2024
  DAY_MONTH: 'd MMM', // 25 Nov
  RELATIVE_DATE: 'relative', // "2 days ago", "in 3 hours"

  // ISO format
  ISO: "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
} as const

/**
 * Format date for display with consistent formatting
 * @param date - Date to format (Date object or ISO string)
 * @param formatType - One of the predefined format types or a custom format string
 * @param timezone - Timezone to use (defaults to IST)
 */
export function formatDate(
  date: Date | string | null | undefined,
  formatType: keyof typeof DATE_FORMATS | string = 'MEDIUM_DATE',
  timezone: string = DEFAULT_TIMEZONE
): string {
  if (!date) return '-'

  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date

    if (!isValid(dateObj)) {
      return 'Invalid date'
    }

    // Get the format string
    const formatStr = DATE_FORMATS[formatType as keyof typeof DATE_FORMATS] || formatType

    // Handle relative date format
    if (formatStr === 'relative') {
      return formatRelativeDate(dateObj, timezone)
    }

    return formatInTimeZone(dateObj, timezone, formatStr)
  } catch (error) {
    console.error('Error formatting date:', error)
    return 'Invalid date'
  }
}

/**
 * Format date as relative time (e.g., "2 days ago", "in 3 hours")
 */
export function formatRelativeDate(
  date: Date | string,
  timezone: string = DEFAULT_TIMEZONE
): string {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date

    if (!isValid(dateObj)) {
      return 'Invalid date'
    }

    const now = getCurrentTimeInTimezone(timezone)
    const targetDate = utcToUserTimezone(dateObj, timezone)

    const diffInMs = targetDate.getTime() - now.getTime()
    const diffInSecs = Math.abs(diffInMs / 1000)
    const diffInMins = Math.floor(diffInSecs / 60)
    const diffInHours = Math.floor(diffInMins / 60)
    const diffInDays = Math.floor(diffInHours / 24)
    const diffInWeeks = Math.floor(diffInDays / 7)
    const diffInMonths = Math.floor(diffInDays / 30)

    const isPast = diffInMs < 0

    const formatUnit = (value: number, unit: string): string => {
      const plural = value !== 1 ? 's' : ''
      if (isPast) {
        return `${value} ${unit}${plural} ago`
      }
      return `in ${value} ${unit}${plural}`
    }

    if (diffInSecs < 60) return isPast ? 'just now' : 'in a moment'
    if (diffInMins < 60) return formatUnit(diffInMins, 'minute')
    if (diffInHours < 24) return formatUnit(diffInHours, 'hour')
    if (diffInDays < 7) return formatUnit(diffInDays, 'day')
    if (diffInWeeks < 4) return formatUnit(diffInWeeks, 'week')
    if (diffInMonths < 12) return formatUnit(diffInMonths, 'month')

    // Fall back to absolute date for very old dates
    return formatDate(date, 'MEDIUM_DATE', timezone)
  } catch (error) {
    console.error('Error formatting relative date:', error)
    return 'Invalid date'
  }
}

/**
 * Format registration/created date with "X days ago" helper
 */
export function formatDateWithRelative(
  date: Date | string | null | undefined,
  timezone: string = DEFAULT_TIMEZONE
): { formatted: string; relative: string; daysAgo: number } {
  if (!date) {
    return { formatted: '-', relative: '-', daysAgo: 0 }
  }

  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date

    if (!isValid(dateObj)) {
      return { formatted: 'Invalid date', relative: '-', daysAgo: 0 }
    }

    const now = getCurrentTimeInTimezone(timezone)
    const targetDate = utcToUserTimezone(dateObj, timezone)
    const diffInMs = now.getTime() - targetDate.getTime()
    const daysAgo = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

    return {
      formatted: formatInTimeZone(dateObj, timezone, DATE_FORMATS.MEDIUM_DATE),
      relative: daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`,
      daysAgo,
    }
  } catch (error) {
    console.error('Error formatting date with relative:', error)
    return { formatted: 'Invalid date', relative: '-', daysAgo: 0 }
  }
}

/**
 * Format month and year for headers (e.g., "November 2024")
 */
export function formatMonthYear(
  date: Date | string | null | undefined = new Date(),
  timezone: string = DEFAULT_TIMEZONE
): string {
  return formatDate(date, 'MONTH_YEAR', timezone)
}

/**
 * Format currency amount in Indian format
 */
export function formatCurrencyINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format large numbers in Indian format (e.g., 10L, 1Cr)
 */
export function formatCompactNumber(value: number): string {
  if (value >= 10000000) {
    return `${(value / 10000000).toFixed(2)}Cr`
  }
  if (value >= 100000) {
    return `${(value / 100000).toFixed(2)}L`
  }
  if (value >= 1000) {
    return value.toLocaleString('en-IN')
  }
  return value.toString()
}
