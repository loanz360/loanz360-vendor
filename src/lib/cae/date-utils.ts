/**
 * CAE Date Utilities
 * BUG FIX #11: Standardize date formatting across the CAE system
 *
 * Standards:
 * - API Responses: Always ISO 8601 (YYYY-MM-DDTHH:mm:ss.sssZ)
 * - Database Storage: Always UTC ISO 8601
 * - UI Display: Localized format (DD/MM/YYYY for India)
 * - Internal Processing: JavaScript Date objects or ISO strings
 */

/**
 * Format date to ISO 8601 string (for API responses and database)
 * BUG FIX #11: Standardized API date format
 *
 * @param date - Date to format (Date object, ISO string, or timestamp)
 * @returns ISO 8601 string in UTC (e.g., "2026-01-25T10:30:00.000Z")
 *
 * @example
 * toISOString(new Date()) // "2026-01-25T10:30:00.000Z"
 * toISOString("2026-01-25") // "2026-01-25T00:00:00.000Z"
 * toISOString(1706176200000) // "2026-01-25T10:30:00.000Z"
 */
export function toISOString(date: Date | string | number | null | undefined): string | null {
  if (!date) return null

  try {
    const dateObj = typeof date === 'object' ? date : new Date(date)

    if (isNaN(dateObj.getTime())) {
      console.warn(`[DATE_UTILS] Invalid date: ${date}`)
      return null
    }

    return dateObj.toISOString()
  } catch (error) {
    console.error(`[DATE_UTILS] Error formatting date to ISO:`, error)
    return null
  }
}

/**
 * Format date for Indian UI display (DD/MM/YYYY)
 * BUG FIX #11: Localized date display
 *
 * @param date - Date to format
 * @param includeTime - Include time in HH:mm format
 * @returns Formatted date string (e.g., "25/01/2026" or "25/01/2026 10:30")
 *
 * @example
 * formatIndianDate(new Date()) // "25/01/2026"
 * formatIndianDate(new Date(), true) // "25/01/2026 10:30"
 */
export function formatIndianDate(
  date: Date | string | number | null | undefined,
  includeTime: boolean = false
): string {
  if (!date) return '-'

  try {
    const dateObj = typeof date === 'object' ? date : new Date(date)

    if (isNaN(dateObj.getTime())) {
      return '-'
    }

    const day = String(dateObj.getDate()).padStart(2, '0')
    const month = String(dateObj.getMonth() + 1).padStart(2, '0')
    const year = dateObj.getFullYear()

    const dateStr = `${day}/${month}/${year}`

    if (includeTime) {
      const hours = String(dateObj.getHours()).padStart(2, '0')
      const minutes = String(dateObj.getMinutes()).padStart(2, '0')
      return `${dateStr} ${hours}:${minutes}`
    }

    return dateStr
  } catch (error) {
    console.error(`[DATE_UTILS] Error formatting Indian date:`, error)
    return '-'
  }
}

/**
 * Format date with month name for better readability
 * BUG FIX #11: User-friendly date display
 *
 * @param date - Date to format
 * @param format - Format type ('short' | 'long' | 'full')
 * @returns Formatted date string
 *
 * @example
 * formatReadableDate(new Date(), 'short') // "25 Jan 2026"
 * formatReadableDate(new Date(), 'long') // "25 January 2026"
 * formatReadableDate(new Date(), 'full') // "25 January 2026, 10:30 AM"
 */
export function formatReadableDate(
  date: Date | string | number | null | undefined,
  format: 'short' | 'long' | 'full' = 'short'
): string {
  if (!date) return '-'

  try {
    const dateObj = typeof date === 'object' ? date : new Date(date)

    if (isNaN(dateObj.getTime())) {
      return '-'
    }

    const day = dateObj.getDate()
    const monthNames = {
      short: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      long: [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ]
    }
    const month = format === 'short' ? monthNames.short[dateObj.getMonth()] : monthNames.long[dateObj.getMonth()]
    const year = dateObj.getFullYear()

    if (format === 'full') {
      const hours = dateObj.getHours()
      const minutes = String(dateObj.getMinutes()).padStart(2, '0')
      const ampm = hours >= 12 ? 'PM' : 'AM'
      const displayHours = hours % 12 || 12
      return `${day} ${month} ${year}, ${displayHours}:${minutes} ${ampm}`
    }

    return `${day} ${month} ${year}`
  } catch (error) {
    console.error(`[DATE_UTILS] Error formatting readable date:`, error)
    return '-'
  }
}

/**
 * Format date as relative time (e.g., "2 hours ago", "3 days ago")
 * BUG FIX #11: User-friendly relative time display
 *
 * @param date - Date to format
 * @returns Relative time string
 *
 * @example
 * formatRelativeTime(new Date(Date.now() - 5000)) // "just now"
 * formatRelativeTime(new Date(Date.now() - 3600000)) // "1 hour ago"
 * formatRelativeTime(new Date(Date.now() - 86400000)) // "1 day ago"
 */
export function formatRelativeTime(date: Date | string | number | null | undefined): string {
  if (!date) return '-'

  try {
    const dateObj = typeof date === 'object' ? date : new Date(date)

    if (isNaN(dateObj.getTime())) {
      return '-'
    }

    const now = Date.now()
    const diff = now - dateObj.getTime()

    // Less than 1 minute
    if (diff < 60000) {
      return 'just now'
    }

    // Less than 1 hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000)
      return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`
    }

    // Less than 24 hours
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000)
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
    }

    // Less than 30 days
    if (diff < 2592000000) {
      const days = Math.floor(diff / 86400000)
      return `${days} ${days === 1 ? 'day' : 'days'} ago`
    }

    // Less than 12 months
    if (diff < 31536000000) {
      const months = Math.floor(diff / 2592000000)
      return `${months} ${months === 1 ? 'month' : 'months'} ago`
    }

    // Years
    const years = Math.floor(diff / 31536000000)
    return `${years} ${years === 1 ? 'year' : 'years'} ago`
  } catch (error) {
    console.error(`[DATE_UTILS] Error formatting relative time:`, error)
    return '-'
  }
}

/**
 * Format date and time separately for display
 * BUG FIX #11: Separate date and time display
 *
 * @param date - Date to format
 * @returns Object with separate date and time strings
 *
 * @example
 * formatDateTime(new Date()) // { date: "25/01/2026", time: "10:30 AM" }
 */
export function formatDateTime(date: Date | string | number | null | undefined): {
  date: string
  time: string
} {
  if (!date) return { date: '-', time: '-' }

  try {
    const dateObj = typeof date === 'object' ? date : new Date(date)

    if (isNaN(dateObj.getTime())) {
      return { date: '-', time: '-' }
    }

    const day = String(dateObj.getDate()).padStart(2, '0')
    const month = String(dateObj.getMonth() + 1).padStart(2, '0')
    const year = dateObj.getFullYear()

    const hours = dateObj.getHours()
    const minutes = String(dateObj.getMinutes()).padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12

    return {
      date: `${day}/${month}/${year}`,
      time: `${displayHours}:${minutes} ${ampm}`
    }
  } catch (error) {
    console.error(`[DATE_UTILS] Error formatting date-time:`, error)
    return { date: '-', time: '-' }
  }
}

/**
 * Parse various date formats to JavaScript Date object
 * BUG FIX #11: Robust date parsing
 *
 * @param input - Date in any format
 * @returns Date object or null if invalid
 *
 * @example
 * parseDate("2026-01-25") // Date object
 * parseDate("25/01/2026") // Date object
 * parseDate("25-01-2026") // Date object
 */
export function parseDate(input: string | Date | number | null | undefined): Date | null {
  if (!input) return null

  try {
    // Already a Date object
    if (input instanceof Date) {
      return isNaN(input.getTime()) ? null : input
    }

    // Timestamp
    if (typeof input === 'number') {
      const date = new Date(input)
      return isNaN(date.getTime()) ? null : date
    }

    // ISO 8601 string (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
    if (/^\d{4}-\d{2}-\d{2}/.test(input)) {
      const date = new Date(input)
      return isNaN(date.getTime()) ? null : date
    }

    // Indian format (DD/MM/YYYY)
    if (/^\d{2}\/\d{2}\/\d{4}/.test(input)) {
      const [day, month, year] = input.split(/[\/\s]/)
      const date = new Date(`${year}-${month}-${day}`)
      return isNaN(date.getTime()) ? null : date
    }

    // DD-MM-YYYY format
    if (/^\d{2}-\d{2}-\d{4}/.test(input)) {
      const [day, month, year] = input.split('-')
      const date = new Date(`${year}-${month}-${day}`)
      return isNaN(date.getTime()) ? null : date
    }

    // Try generic Date parsing as fallback
    const date = new Date(input)
    return isNaN(date.getTime()) ? null : date
  } catch (error) {
    console.error(`[DATE_UTILS] Error parsing date:`, error)
    return null
  }
}

/**
 * Check if a date is valid
 * BUG FIX #11: Date validation
 *
 * @param date - Date to validate
 * @returns True if valid, false otherwise
 */
export function isValidDate(date: unknown): boolean {
  if (!date) return false

  try {
    const dateObj = typeof date === 'object' ? date : new Date(date)
    return !isNaN(dateObj.getTime())
  } catch {
    return false
  }
}

/**
 * Get start and end of day in UTC
 * BUG FIX #11: Date range utilities
 *
 * @param date - Reference date
 * @returns Object with start and end timestamps
 */
export function getDateRange(date: Date | string | number): { start: string; end: string } | null {
  const dateObj = parseDate(date)
  if (!dateObj) return null

  const start = new Date(dateObj)
  start.setUTCHours(0, 0, 0, 0)

  const end = new Date(dateObj)
  end.setUTCHours(23, 59, 59, 999)

  return {
    start: start.toISOString(),
    end: end.toISOString()
  }
}

/**
 * Add/subtract days from a date
 * BUG FIX #11: Date arithmetic
 *
 * @param date - Starting date
 * @param days - Number of days to add (positive) or subtract (negative)
 * @returns New date
 */
export function addDays(date: Date | string | number, days: number): Date | null {
  const dateObj = parseDate(date)
  if (!dateObj) return null

  const result = new Date(dateObj)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * Calculate difference between two dates in days
 * BUG FIX #11: Date difference calculation
 *
 * @param date1 - First date
 * @param date2 - Second date
 * @returns Number of days difference (absolute value)
 */
export function daysDifference(
  date1: Date | string | number,
  date2: Date | string | number
): number | null {
  const d1 = parseDate(date1)
  const d2 = parseDate(date2)

  if (!d1 || !d2) return null

  const diff = Math.abs(d1.getTime() - d2.getTime())
  return Math.floor(diff / 86400000)
}

/**
 * Check if date is in the past
 * BUG FIX #11: Date comparison utilities
 *
 * @param date - Date to check
 * @returns True if date is in the past
 */
export function isPast(date: Date | string | number): boolean {
  const dateObj = parseDate(date)
  if (!dateObj) return false
  return dateObj.getTime() < Date.now()
}

/**
 * Check if date is in the future
 * BUG FIX #11: Date comparison utilities
 *
 * @param date - Date to check
 * @returns True if date is in the future
 */
export function isFuture(date: Date | string | number): boolean {
  const dateObj = parseDate(date)
  if (!dateObj) return false
  return dateObj.getTime() > Date.now()
}

/**
 * Check if date is today
 * BUG FIX #11: Date comparison utilities
 *
 * @param date - Date to check
 * @returns True if date is today
 */
export function isToday(date: Date | string | number): boolean {
  const dateObj = parseDate(date)
  if (!dateObj) return false

  const today = new Date()
  return (
    dateObj.getDate() === today.getDate() &&
    dateObj.getMonth() === today.getMonth() &&
    dateObj.getFullYear() === today.getFullYear()
  )
}

/**
 * Format duration in milliseconds to human-readable string
 * BUG FIX #11: Duration formatting
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted duration string
 *
 * @example
 * formatDuration(1500) // "1.5s"
 * formatDuration(65000) // "1m 5s"
 * formatDuration(3665000) // "1h 1m 5s"
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  }

  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`
  }

  if (ms < 3600000) {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
  }

  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)

  const parts = [`${hours}h`]
  if (minutes > 0) parts.push(`${minutes}m`)
  if (seconds > 0) parts.push(`${seconds}s`)

  return parts.join(' ')
}

/**
 * Get current timestamp in ISO format (shorthand)
 * BUG FIX #11: Convenience function
 *
 * @returns Current timestamp in ISO 8601 format
 */
export function now(): string {
  return new Date().toISOString()
}

/**
 * Convert Indian timezone (IST) to UTC
 * BUG FIX #11: Timezone conversion
 *
 * @param dateStr - Date string in IST
 * @returns ISO string in UTC
 */
export function ISTtoUTC(dateStr: string): string | null {
  try {
    // IST is UTC+5:30
    const date = new Date(dateStr + '+05:30')
    return isNaN(date.getTime()) ? null : date.toISOString()
  } catch {
    return null
  }
}

/**
 * Convert UTC to Indian timezone (IST)
 * BUG FIX #11: Timezone conversion
 *
 * @param date - Date in UTC
 * @returns Date string in IST
 */
export function UTCtoIST(date: Date | string | number): string {
  const dateObj = parseDate(date)
  if (!dateObj) return '-'

  // Add 5 hours 30 minutes for IST
  const istDate = new Date(dateObj.getTime() + (5.5 * 60 * 60 * 1000))
  return formatIndianDate(istDate, true)
}
