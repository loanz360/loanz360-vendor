/**
 * Cross-Module Notification Engine for Work Management
 *
 * Generates and manages notifications across:
 * - Attendance & Leaves
 * - Payroll
 * - WorkDrive
 * - Company Email
 *
 * Supports: In-app, Email, WhatsApp (future), SMS (future)
 */

export type NotificationChannel = 'in_app' | 'email' | 'whatsapp' | 'sms'
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical'
export type NotificationCategory =
  | 'attendance'
  | 'leave'
  | 'payroll'
  | 'document'
  | 'email'
  | 'system'

export interface WorkManagementNotification {
  id: string
  userId: string
  category: NotificationCategory
  priority: NotificationPriority
  title: string
  message: string
  actionUrl?: string
  actionLabel?: string
  channels: NotificationChannel[]
  isRead: boolean
  createdAt: string
  expiresAt?: string
  metadata?: Record<string, unknown>
}

// Attendance notifications
export function generateCheckInReminder(userName: string, expectedTime: string): Omit<WorkManagementNotification, 'id' | 'userId' | 'createdAt' | 'isRead'> {
  return {
    category: 'attendance',
    priority: 'medium',
    title: 'Check-in Reminder',
    message: `Good morning ${userName}! Your expected check-in time is ${expectedTime}. Please check in to mark your attendance.`,
    actionUrl: '/employees/attendance',
    actionLabel: 'Check In Now',
    channels: ['in_app'],
  }
}

export function generateLateArrivalNotification(
  userName: string,
  lateByMinutes: number,
  monthlyLateCount: number
): Omit<WorkManagementNotification, 'id' | 'userId' | 'createdAt' | 'isRead'> {
  const isWarning = monthlyLateCount >= 3
  return {
    category: 'attendance',
    priority: isWarning ? 'high' : 'medium',
    title: isWarning ? 'Late Arrival Warning' : 'Late Check-in Recorded',
    message: isWarning
      ? `${userName}, you have been late ${monthlyLateCount} times this month (${lateByMinutes} min late today). ${monthlyLateCount >= 5 ? 'This may result in a salary deduction.' : 'Please ensure punctuality.'}`
      : `Late check-in recorded (${lateByMinutes} minutes). Monthly late count: ${monthlyLateCount}.`,
    actionUrl: '/employees/attendance',
    actionLabel: 'View Attendance',
    channels: isWarning ? ['in_app', 'email'] : ['in_app'],
    metadata: { lateByMinutes, monthlyLateCount },
  }
}

export function generateCheckOutReminder(userName: string, checkInTime: string): Omit<WorkManagementNotification, 'id' | 'userId' | 'createdAt' | 'isRead'> {
  return {
    category: 'attendance',
    priority: 'low',
    title: 'Check-out Reminder',
    message: `${userName}, you checked in at ${checkInTime}. Don't forget to check out before leaving.`,
    actionUrl: '/employees/attendance',
    actionLabel: 'Check Out',
    channels: ['in_app'],
  }
}

// Leave notifications
export function generateLeaveApprovalNotification(
  leaveType: string,
  fromDate: string,
  toDate: string,
  status: 'approved' | 'rejected',
  approverName?: string
): Omit<WorkManagementNotification, 'id' | 'userId' | 'createdAt' | 'isRead'> {
  const isApproved = status === 'approved'
  return {
    category: 'leave',
    priority: 'high',
    title: `Leave ${isApproved ? 'Approved' : 'Rejected'}`,
    message: `Your ${leaveType} request from ${fromDate} to ${toDate} has been ${status}${approverName ? ` by ${approverName}` : ''}.`,
    actionUrl: '/employees/attendance',
    actionLabel: 'View Details',
    channels: ['in_app', 'email'],
    metadata: { leaveType, fromDate, toDate, status },
  }
}

export function generateLeaveBalanceAlert(
  leaveType: string,
  remaining: number,
  total: number
): Omit<WorkManagementNotification, 'id' | 'userId' | 'createdAt' | 'isRead'> {
  const percentage = total > 0 ? (remaining / total) * 100 : 0
  return {
    category: 'leave',
    priority: percentage < 10 ? 'high' : 'medium',
    title: 'Low Leave Balance',
    message: `Your ${leaveType} balance is running low: ${remaining} of ${total} days remaining (${Math.round(percentage)}%).`,
    actionUrl: '/employees/attendance',
    actionLabel: 'View Balance',
    channels: ['in_app'],
    metadata: { leaveType, remaining, total },
  }
}

// Payroll notifications
export function generateSalaryCreditNotification(
  month: string,
  year: number,
  netAmount: number
): Omit<WorkManagementNotification, 'id' | 'userId' | 'createdAt' | 'isRead'> {
  return {
    category: 'payroll',
    priority: 'high',
    title: 'Salary Credited',
    message: `Your salary for ${month} ${year} has been processed. Net amount: ${formatINR(netAmount)}. Payslip is available for download.`,
    actionUrl: '/employees/employee/payroll',
    actionLabel: 'View Payslip',
    channels: ['in_app', 'email'],
    metadata: { month, year, netAmount },
  }
}

export function generatePayslipAvailableNotification(
  month: string,
  year: number
): Omit<WorkManagementNotification, 'id' | 'userId' | 'createdAt' | 'isRead'> {
  return {
    category: 'payroll',
    priority: 'medium',
    title: 'Payslip Available',
    message: `Your payslip for ${month} ${year} is now available for download.`,
    actionUrl: '/employees/employee/payroll/payslips',
    actionLabel: 'Download Payslip',
    channels: ['in_app'],
  }
}

export function generateTaxDeclarationReminder(
  financialYear: string,
  daysRemaining: number
): Omit<WorkManagementNotification, 'id' | 'userId' | 'createdAt' | 'isRead'> {
  return {
    category: 'payroll',
    priority: daysRemaining <= 7 ? 'critical' : 'high',
    title: 'Tax Declaration Deadline',
    message: `Your tax declaration for FY ${financialYear} is due in ${daysRemaining} days. Submit your investment proofs to optimize tax deductions.`,
    actionUrl: '/employees/employee/payroll/tax-declaration',
    actionLabel: 'Submit Declaration',
    channels: daysRemaining <= 7 ? ['in_app', 'email'] : ['in_app'],
    metadata: { financialYear, daysRemaining },
  }
}

export function generateLOPDeductionNotification(
  month: string,
  lopDays: number,
  lopAmount: number
): Omit<WorkManagementNotification, 'id' | 'userId' | 'createdAt' | 'isRead'> {
  return {
    category: 'payroll',
    priority: 'high',
    title: 'LOP Deduction Applied',
    message: `${lopDays} day(s) Loss of Pay (${formatINR(lopAmount)}) has been applied to your ${month} salary due to unauthorized absences.`,
    actionUrl: '/employees/attendance',
    actionLabel: 'View Attendance',
    channels: ['in_app', 'email'],
    metadata: { lopDays, lopAmount },
  }
}

// Document notifications
export function generateDocumentExpiryNotification(
  documentName: string,
  customerName: string,
  daysUntilExpiry: number
): Omit<WorkManagementNotification, 'id' | 'userId' | 'createdAt' | 'isRead'> {
  return {
    category: 'document',
    priority: daysUntilExpiry <= 7 ? 'high' : 'medium',
    title: 'Document Expiring Soon',
    message: `${documentName} for ${customerName} will expire in ${daysUntilExpiry} days. Please request an updated document.`,
    actionUrl: '/employees/workdrive',
    actionLabel: 'View Document',
    channels: ['in_app'],
    metadata: { documentName, customerName, daysUntilExpiry },
  }
}

export function generateDocumentVerifiedNotification(
  documentName: string,
  customerName: string,
  status: 'verified' | 'rejected',
  rejectionReason?: string
): Omit<WorkManagementNotification, 'id' | 'userId' | 'createdAt' | 'isRead'> {
  return {
    category: 'document',
    priority: status === 'rejected' ? 'high' : 'medium',
    title: `Document ${status === 'verified' ? 'Verified' : 'Rejected'}`,
    message: status === 'verified'
      ? `${documentName} for ${customerName} has been verified successfully.`
      : `${documentName} for ${customerName} was rejected. ${rejectionReason ? `Reason: ${rejectionReason}` : 'Please upload a corrected version.'}`,
    actionUrl: '/employees/workdrive',
    actionLabel: status === 'rejected' ? 'Re-upload' : 'View',
    channels: ['in_app'],
    metadata: { documentName, customerName, status, rejectionReason },
  }
}

// Email notifications
export function generateUnreadEmailAlert(
  unreadCount: number,
  highPriorityCount: number
): Omit<WorkManagementNotification, 'id' | 'userId' | 'createdAt' | 'isRead'> {
  return {
    category: 'email',
    priority: highPriorityCount > 0 ? 'high' : 'low',
    title: 'Unread Emails',
    message: `You have ${unreadCount} unread email${unreadCount !== 1 ? 's' : ''}${highPriorityCount > 0 ? ` (${highPriorityCount} high priority)` : ''}.`,
    actionUrl: '/employees/email',
    actionLabel: 'Open Inbox',
    channels: ['in_app'],
    metadata: { unreadCount, highPriorityCount },
  }
}

export function generateEmailQuotaWarning(
  used: number,
  limit: number
): Omit<WorkManagementNotification, 'id' | 'userId' | 'createdAt' | 'isRead'> {
  const percentage = limit > 0 ? Math.round((used / limit) * 100) : 0
  return {
    category: 'email',
    priority: percentage >= 90 ? 'high' : 'medium',
    title: 'Email Quota Warning',
    message: `You've used ${percentage}% of your daily email quota (${used}/${limit}). ${percentage >= 90 ? 'You may not be able to send more emails today.' : ''}`,
    actionUrl: '/employees/email',
    actionLabel: 'View Quota',
    channels: ['in_app'],
    metadata: { used, limit, percentage },
  }
}

// Utility
function formatINR(amount: number): string {
  if (amount === 0) return '\u20B90'
  const isNegative = amount < 0
  const absAmount = Math.abs(Math.round(amount))
  const str = absAmount.toString()
  let formatted = ''

  if (str.length <= 3) {
    formatted = str
  } else {
    formatted = str.slice(-3)
    let remaining = str.slice(0, -3)
    while (remaining.length > 2) {
      formatted = remaining.slice(-2) + ',' + formatted
      remaining = remaining.slice(0, -2)
    }
    if (remaining) {
      formatted = remaining + ',' + formatted
    }
  }

  return `${isNegative ? '-' : ''}\u20B9${formatted}`
}

/**
 * Batch create notifications for a specific user
 * Useful for scheduled jobs (e.g., morning check-in reminders, salary day notifications)
 */
export function generateDailyDigest(params: {
  userName: string
  pendingLeaveCount: number
  unreadEmailCount: number
  todayMeetingCount: number
  documentExpiryCount: number
}): Omit<WorkManagementNotification, 'id' | 'userId' | 'createdAt' | 'isRead'> {
  const items: string[] = []
  if (params.pendingLeaveCount > 0) items.push(`${params.pendingLeaveCount} pending leave request(s)`)
  if (params.unreadEmailCount > 0) items.push(`${params.unreadEmailCount} unread email(s)`)
  if (params.todayMeetingCount > 0) items.push(`${params.todayMeetingCount} meeting(s) today`)
  if (params.documentExpiryCount > 0) items.push(`${params.documentExpiryCount} expiring document(s)`)

  return {
    category: 'system',
    priority: 'low',
    title: `Good morning, ${params.userName}!`,
    message: items.length > 0
      ? `Today's summary: ${items.join(', ')}.`
      : 'You\'re all caught up! No pending items.',
    actionUrl: '/employees',
    actionLabel: 'View Dashboard',
    channels: ['in_app'],
    metadata: { ...params },
  }
}
