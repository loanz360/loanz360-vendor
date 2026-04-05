/**
 * EMI Calendar & Reminder Utilities - Enterprise-grade Payment Tracking
 *
 * Provides comprehensive EMI payment scheduling and reminder features:
 * - Generate payment calendar for entire loan tenure
 * - Calculate upcoming EMI due dates
 * - Track payment status
 * - Generate reminder schedules
 * - Export to calendar formats (iCal, Google Calendar)
 */

import { AmortizationRow, LoanType, LOAN_TYPE_CONFIG } from '@/types/emi-calculator'

/**
 * Alias for backward compatibility - AmortizationEntry maps to AmortizationRow
 */
type AmortizationEntry = AmortizationRow & { remainingBalance?: number }

export interface EMIPayment {
  id: string
  month: number
  dueDate: Date
  emi: number
  principalPaid: number
  interestPaid: number
  remainingBalance: number
  status: 'upcoming' | 'due' | 'overdue' | 'paid'
  paidDate?: Date
  paidAmount?: number
  lateFee?: number
  notes?: string
}

export interface EMICalendar {
  loanId: string
  loanType: LoanType
  principal: number
  interestRate: number
  tenure: number
  emi: number
  startDate: Date
  payments: EMIPayment[]
  totalPaid: number
  totalRemaining: number
  nextDue?: EMIPayment
  overduePayments: EMIPayment[]
}

export interface ReminderSchedule {
  paymentId: string
  dueDate: Date
  emi: number
  reminders: Reminder[]
}

export interface Reminder {
  id: string
  type: 'email' | 'sms' | 'push' | 'whatsapp'
  scheduledFor: Date
  daysBefore: number
  status: 'scheduled' | 'sent' | 'failed'
  message: string
}

export interface CalendarExportOptions {
  format: 'ical' | 'google' | 'outlook'
  includeReminders?: boolean
  reminderDaysBefore?: number[]
  title?: string
  description?: string
}

/**
 * Generate unique ID for payment
 */
function generatePaymentId(loanId: string, month: number): string {
  return `${loanId}-PMT-${month.toString().padStart(3, '0')}`
}

/**
 * Calculate due date for a specific month
 */
function calculateDueDate(startDate: Date, monthNumber: number, preferredDay?: number): Date {
  const dueDate = new Date(startDate)
  dueDate.setMonth(dueDate.getMonth() + monthNumber)

  // Adjust for preferred payment day if specified
  if (preferredDay) {
    const lastDay = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0).getDate()
    dueDate.setDate(Math.min(preferredDay, lastDay))
  }

  return dueDate
}

/**
 * Determine payment status based on due date
 */
function getPaymentStatus(dueDate: Date, isPaid: boolean): EMIPayment['status'] {
  if (isPaid) return 'paid'

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)

  const daysUntilDue = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (daysUntilDue < 0) return 'overdue'
  if (daysUntilDue <= 7) return 'due'
  return 'upcoming'
}

/**
 * Generate EMI calendar from amortization schedule
 */
export function generateEMICalendar(
  loanId: string,
  loanType: LoanType,
  principal: number,
  interestRate: number,
  amortizationSchedule: AmortizationEntry[],
  startDate: Date = new Date(),
  preferredDay?: number,
  paidPayments: Set<number> = new Set()
): EMICalendar {
  const payments: EMIPayment[] = amortizationSchedule.map((entry, index) => {
    const monthNumber = index + 1
    const dueDate = calculateDueDate(startDate, monthNumber, preferredDay)
    const isPaid = paidPayments.has(monthNumber)

    return {
      id: generatePaymentId(loanId, monthNumber),
      month: monthNumber,
      dueDate,
      emi: entry.emi,
      principalPaid: entry.principalPaid,
      interestPaid: entry.interestPaid,
      remainingBalance: entry.remainingBalance,
      status: getPaymentStatus(dueDate, isPaid),
    }
  })

  const paidPaymentsList = payments.filter(p => p.status === 'paid')
  const overduePayments = payments.filter(p => p.status === 'overdue')
  const upcomingPayments = payments.filter(p => p.status === 'upcoming' || p.status === 'due')

  const totalPaid = paidPaymentsList.reduce((sum, p) => sum + p.emi, 0)
  const totalRemaining = upcomingPayments.reduce((sum, p) => sum + p.emi, 0) +
    overduePayments.reduce((sum, p) => sum + p.emi, 0)

  // Find next due payment
  const nextDue = [...overduePayments, ...upcomingPayments].sort(
    (a, b) => a.dueDate.getTime() - b.dueDate.getTime()
  )[0]

  return {
    loanId,
    loanType,
    principal,
    interestRate,
    tenure: amortizationSchedule.length,
    emi: amortizationSchedule[0]?.emi || 0,
    startDate,
    payments,
    totalPaid,
    totalRemaining,
    nextDue,
    overduePayments: overduePayments,
  }
}

/**
 * Get upcoming payments for next N months
 */
export function getUpcomingPayments(calendar: EMICalendar, months: number = 3): EMIPayment[] {
  const cutoffDate = new Date()
  cutoffDate.setMonth(cutoffDate.getMonth() + months)

  return calendar.payments
    .filter(p =>
      (p.status === 'upcoming' || p.status === 'due') &&
      p.dueDate <= cutoffDate
    )
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
}

/**
 * Generate reminder schedule for a payment
 */
export function generateReminderSchedule(
  payment: EMIPayment,
  reminderDays: number[] = [7, 3, 1, 0],
  reminderTypes: Reminder['type'][] = ['email', 'push']
): ReminderSchedule {
  const reminders: Reminder[] = []

  reminderDays.forEach(daysBefore => {
    const reminderDate = new Date(payment.dueDate)
    reminderDate.setDate(reminderDate.getDate() - daysBefore)

    // Only create reminder if it's in the future
    if (reminderDate > new Date()) {
      reminderTypes.forEach(type => {
        reminders.push({
          id: `${payment.id}-REM-${daysBefore}-${type}`,
          type,
          scheduledFor: reminderDate,
          daysBefore,
          status: 'scheduled',
          message: generateReminderMessage(payment, daysBefore, type),
        })
      })
    }
  })

  return {
    paymentId: payment.id,
    dueDate: payment.dueDate,
    emi: payment.emi,
    reminders: reminders.sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime()),
  }
}

/**
 * Generate reminder message based on type and days before due
 */
function generateReminderMessage(
  payment: EMIPayment,
  daysBefore: number,
  type: Reminder['type']
): string {
  const emiFormatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(payment.emi)

  const dueDateFormatted = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(payment.dueDate)

  const templates = {
    email: {
      0: `Reminder: Your EMI of ${emiFormatted} is due today (${dueDateFormatted}). Please ensure timely payment to avoid late fees.`,
      1: `Reminder: Your EMI of ${emiFormatted} is due tomorrow (${dueDateFormatted}). Please keep sufficient balance in your account.`,
      3: `Your EMI of ${emiFormatted} is due in 3 days (${dueDateFormatted}). Ensure your account has sufficient balance.`,
      7: `Advance Notice: Your EMI of ${emiFormatted} is due on ${dueDateFormatted}. Plan your finances accordingly.`,
    },
    sms: {
      0: `EMI Due Today: ${emiFormatted}. Pay now to avoid late fees.`,
      1: `EMI Due Tomorrow: ${emiFormatted} on ${dueDateFormatted}. Ensure balance.`,
      3: `EMI Reminder: ${emiFormatted} due on ${dueDateFormatted}. 3 days left.`,
      7: `EMI Alert: ${emiFormatted} due ${dueDateFormatted}. 7 days notice.`,
    },
    push: {
      0: `💰 EMI Due Today: ${emiFormatted}`,
      1: `⏰ EMI Due Tomorrow: ${emiFormatted}`,
      3: `📅 EMI Due in 3 Days: ${emiFormatted}`,
      7: `🔔 EMI Reminder: Due ${dueDateFormatted}`,
    },
    whatsapp: {
      0: `🔴 *EMI Due Today*\n\nAmount: ${emiFormatted}\nDue Date: ${dueDateFormatted}\n\nPlease pay now to avoid late fees.`,
      1: `🟡 *EMI Due Tomorrow*\n\nAmount: ${emiFormatted}\nDue Date: ${dueDateFormatted}\n\nEnsure sufficient balance in your account.`,
      3: `🟢 *EMI Reminder*\n\nAmount: ${emiFormatted}\nDue Date: ${dueDateFormatted}\n\nYour EMI is due in 3 days.`,
      7: `📅 *Advance EMI Notice*\n\nAmount: ${emiFormatted}\nDue Date: ${dueDateFormatted}\n\nYour EMI is due in 7 days.`,
    },
  }

  const typeTemplates = templates[type] || templates.push
  // Map daysBefore to nearest valid template key
  let key: 0 | 1 | 3 | 7
  if (daysBefore <= 0) key = 0
  else if (daysBefore <= 1) key = 1
  else if (daysBefore <= 3) key = 3
  else key = 7
  return typeTemplates[key] || typeTemplates[7]
}

/**
 * Generate iCal format for calendar export
 */
export function generateICalExport(
  calendar: EMICalendar,
  options: CalendarExportOptions = { format: 'ical' }
): string {
  const loanTypeInfo = LOAN_TYPE_CONFIG[calendar.loanType]
  const title = options.title || `${loanTypeInfo.label} EMI Payment`
  const description = options.description ||
    `Monthly EMI payment of ₹${calendar.emi.toFixed(0)} for ${loanTypeInfo.label}`

  const events = calendar.payments
    .filter(p => p.status !== 'paid')
    .map(payment => {
      const dateStr = formatDateForICal(payment.dueDate)
      const uid = `${payment.id}@loanz360.com`

      let eventStr = `BEGIN:VEVENT
UID:${uid}
DTSTART;VALUE=DATE:${dateStr}
DTEND;VALUE=DATE:${dateStr}
SUMMARY:${title} - Month ${payment.month}
DESCRIPTION:EMI Amount: ₹${payment.emi.toFixed(0)}\\nPrincipal: ₹${payment.principalPaid.toFixed(0)}\\nInterest: ₹${payment.interestPaid.toFixed(0)}\\nRemaining Balance: ₹${payment.remainingBalance.toFixed(0)}
CATEGORIES:Finance,EMI,Loan
STATUS:CONFIRMED
TRANSP:OPAQUE`

      // Add reminders if requested
      if (options.includeReminders) {
        const reminderDays = options.reminderDaysBefore || [1, 7]
        reminderDays.forEach(days => {
          eventStr += `
BEGIN:VALARM
ACTION:DISPLAY
TRIGGER:-P${days}D
DESCRIPTION:EMI payment of ₹${payment.emi.toFixed(0)} due in ${days} day(s)
END:VALARM`
        })
      }

      eventStr += '\nEND:VEVENT'
      return eventStr
    })

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Loanz360//EMI Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:${loanTypeInfo.label} EMI Schedule
X-WR-TIMEZONE:Asia/Kolkata
${events.join('\n')}
END:VCALENDAR`
}

/**
 * Format date for iCal (YYYYMMDD)
 */
function formatDateForICal(date: Date): string {
  return date.toISOString().split('T')[0].replace(/-/g, '')
}

/**
 * Generate Google Calendar URL for adding event
 */
export function generateGoogleCalendarUrl(payment: EMIPayment, loanType: LoanType): string {
  const loanTypeInfo = LOAN_TYPE_CONFIG[loanType]
  const title = encodeURIComponent(`${loanTypeInfo.label} EMI - Month ${payment.month}`)
  const details = encodeURIComponent(
    `EMI Amount: ₹${payment.emi.toFixed(0)}\n` +
    `Principal: ₹${payment.principalPaid.toFixed(0)}\n` +
    `Interest: ₹${payment.interestPaid.toFixed(0)}\n` +
    `Remaining Balance: ₹${payment.remainingBalance.toFixed(0)}`
  )

  const dateStr = formatDateForICal(payment.dueDate)

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dateStr}/${dateStr}&details=${details}`
}

/**
 * Get payment statistics
 */
export function getPaymentStatistics(calendar: EMICalendar): {
  totalPayments: number
  paidPayments: number
  upcomingPayments: number
  overduePayments: number
  completionPercentage: number
  totalPrincipalPaid: number
  totalInterestPaid: number
  remainingPrincipal: number
  remainingInterest: number
  nextDueDate: Date | null
  nextDueAmount: number
  totalOverdueAmount: number
} {
  const paid = calendar.payments.filter(p => p.status === 'paid')
  const overdue = calendar.payments.filter(p => p.status === 'overdue')
  const upcoming = calendar.payments.filter(p => p.status === 'upcoming' || p.status === 'due')

  return {
    totalPayments: calendar.payments.length,
    paidPayments: paid.length,
    upcomingPayments: upcoming.length,
    overduePayments: overdue.length,
    completionPercentage: (paid.length / calendar.payments.length) * 100,
    totalPrincipalPaid: paid.reduce((sum, p) => sum + p.principalPaid, 0),
    totalInterestPaid: paid.reduce((sum, p) => sum + p.interestPaid, 0),
    remainingPrincipal: [...overdue, ...upcoming].reduce((sum, p) => sum + p.principalPaid, 0),
    remainingInterest: [...overdue, ...upcoming].reduce((sum, p) => sum + p.interestPaid, 0),
    nextDueDate: calendar.nextDue?.dueDate || null,
    nextDueAmount: calendar.nextDue?.emi || 0,
    totalOverdueAmount: overdue.reduce((sum, p) => sum + p.emi, 0),
  }
}

/**
 * Calculate late fee for overdue payment
 */
export function calculateLateFee(
  payment: EMIPayment,
  lateFeePercentage: number = 2,
  minLateFee: number = 500,
  maxLateFee: number = 5000
): number {
  if (payment.status !== 'overdue') return 0

  const today = new Date()
  const daysOverdue = Math.ceil(
    (today.getTime() - payment.dueDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  const calculatedFee = (payment.emi * lateFeePercentage * daysOverdue) / 100
  return Math.min(Math.max(calculatedFee, minLateFee), maxLateFee)
}

/**
 * Get monthly payment summary for a specific year
 */
export function getYearlyPaymentSummary(
  calendar: EMICalendar,
  year: number
): {
  year: number
  months: {
    month: number
    monthName: string
    payment: EMIPayment | null
    status: EMIPayment['status'] | 'no-payment'
  }[]
  totalEMI: number
  totalPrincipal: number
  totalInterest: number
} {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const yearPayments = calendar.payments.filter(
    p => p.dueDate.getFullYear() === year
  )

  const months = monthNames.map((name, index) => {
    const payment = yearPayments.find(p => p.dueDate.getMonth() === index) || null
    return {
      month: index + 1,
      monthName: name,
      payment,
      status: payment?.status || 'no-payment' as const,
    }
  })

  return {
    year,
    months,
    totalEMI: yearPayments.reduce((sum, p) => sum + p.emi, 0),
    totalPrincipal: yearPayments.reduce((sum, p) => sum + p.principalPaid, 0),
    totalInterest: yearPayments.reduce((sum, p) => sum + p.interestPaid, 0),
  }
}

/**
 * Format date for display
 */
export function formatEMIDate(date: Date, format: 'short' | 'long' | 'full' = 'long'): string {
  const options: Intl.DateTimeFormatOptions = {
    short: { day: '2-digit', month: 'short' },
    long: { day: '2-digit', month: 'short', year: 'numeric' },
    full: { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' },
  }[format]

  return new Intl.DateTimeFormat('en-IN', options).format(date)
}

/**
 * Get days until next payment
 */
export function getDaysUntilPayment(payment: EMIPayment): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const due = new Date(payment.dueDate)
  due.setHours(0, 0, 0, 0)

  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Download iCal file
 */
export function downloadICalFile(calendar: EMICalendar, filename?: string): void {
  const loanTypeInfo = LOAN_TYPE_CONFIG[calendar.loanType]
  const icalContent = generateICalExport(calendar, {
    format: 'ical',
    includeReminders: true,
    reminderDaysBefore: [1, 7],
  })

  const blob = new Blob([icalContent], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename || `${loanTypeInfo.label.replace(/\s+/g, '_')}_EMI_Schedule.ics`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}
