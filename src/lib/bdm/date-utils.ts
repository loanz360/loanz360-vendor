/**
 * Date Utilities
 * Helper functions for date operations in BDM module
 */

/**
 * Get month name from number (1-12)
 */
export function getMonthName(month: number): string {
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]
  return months[month - 1] || 'Unknown'
}

/**
 * Get short month name (Jan, Feb, etc.)
 */
export function getShortMonthName(month: number): string {
  return getMonthName(month).substring(0, 3)
}

/**
 * Get number of days in month
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/**
 * Get current month and year
 */
export function getCurrentMonthYear(): { month: number; year: number } {
  const now = new Date()
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  }
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Format date as DD/MM/YYYY
 */
export function formatDateDMY(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

/**
 * Get start of month
 */
export function getStartOfMonth(year: number, month: number): Date {
  return new Date(year, month - 1, 1, 0, 0, 0, 0)
}

/**
 * Get end of month
 */
export function getEndOfMonth(year: number, month: number): Date {
  return new Date(year, month, 0, 23, 59, 59, 999)
}

/**
 * Check if date is weekend
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

/**
 * Check if date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date()
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  )
}

/**
 * Check if date is in past
 */
export function isPast(date: Date): boolean {
  return date < new Date()
}

/**
 * Check if date is in future
 */
export function isFuture(date: Date): boolean {
  return date > new Date()
}

/**
 * Get day of week name
 */
export function getDayOfWeekName(date: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return days[date.getDay()]
}

/**
 * Get short day of week name
 */
export function getShortDayOfWeekName(date: Date): string {
  return getDayOfWeekName(date).substring(0, 3)
}

/**
 * Add days to date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * Add months to date
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

/**
 * Get difference in days
 */
export function getDaysDifference(date1: Date, date2: Date): number {
  const diff = Math.abs(date1.getTime() - date2.getTime())
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

/**
 * Get working days in month (excluding weekends)
 */
export function getWorkingDaysInMonth(year: number, month: number): number {
  const daysInMonth = getDaysInMonth(year, month)
  let workingDays = 0

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day)
    if (!isWeekend(date)) {
      workingDays++
    }
  }

  return workingDays
}

/**
 * Get elapsed days in current month
 */
export function getElapsedDaysInMonth(): number {
  return new Date().getDate()
}

/**
 * Get remaining days in current month
 */
export function getRemainingDaysInMonth(): number {
  const now = new Date()
  const daysInMonth = getDaysInMonth(now.getFullYear(), now.getMonth() + 1)
  return daysInMonth - now.getDate()
}

/**
 * Format month-year as string
 */
export function formatMonthYear(month: number, year: number): string {
  return `${getMonthName(month)} ${year}`
}

/**
 * Parse date from ISO string
 */
export function parseDateISO(dateString: string): Date {
  return new Date(dateString)
}

/**
 * Get date range for month
 */
export function getMonthDateRange(year: number, month: number): { start: Date; end: Date } {
  return {
    start: getStartOfMonth(year, month),
    end: getEndOfMonth(year, month),
  }
}

/**
 * Check if date is in month
 */
export function isDateInMonth(date: Date, year: number, month: number): boolean {
  return date.getFullYear() === year && date.getMonth() + 1 === month
}

/**
 * Get previous month
 */
export function getPreviousMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) {
    return { year: year - 1, month: 12 }
  }
  return { year, month: month - 1 }
}

/**
 * Get next month
 */
export function getNextMonth(year: number, month: number): { year: number; month: number } {
  if (month === 12) {
    return { year: year + 1, month: 1 }
  }
  return { year, month: month + 1 }
}

/**
 * Parse date range parameters
 */
export function parseDateRangeParams(searchParams: URLSearchParams): {
  startDate?: Date
  endDate?: Date
  month?: number
  year?: number
} {
  const startDateStr = searchParams.get('startDate')
  const endDateStr = searchParams.get('endDate')
  const month = searchParams.get('month')
  const year = searchParams.get('year')

  return {
    startDate: startDateStr ? new Date(startDateStr) : undefined,
    endDate: endDateStr ? new Date(endDateStr) : undefined,
    month: month ? parseInt(month) : undefined,
    year: year ? parseInt(year) : undefined,
  }
}

/**
 * Get date range filter for database queries
 */
export function getDateRangeFilter(startDate?: Date, endDate?: Date): {
  gte?: string
  lte?: string
} {
  return {
    gte: startDate ? formatDateISO(startDate) : undefined,
    lte: endDate ? formatDateISO(endDate) : undefined,
  }
}
