'use server'

import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export interface LeaveNotificationData {
  to: string
  employeeName: string
  leaveType: string
  fromDate: string
  toDate: string
  totalDays: number
  status: 'approved' | 'rejected' | 'pending'
  approverName?: string
  rejectionReason?: string
  actionUrl?: string
}

export interface ApprovalRequestData {
  to: string
  approverName: string
  employeeName: string
  leaveType: string
  fromDate: string
  toDate: string
  totalDays: number
  reason: string
  actionUrl: string
}

export interface AttendanceReminderData {
  to: string
  employeeName: string
  reminderType: 'check-in' | 'check-out' | 'missing'
  date: string
  actionUrl: string
}

export const sendLeaveNotification = async (data: LeaveNotificationData) => {
  try {
    const { default: LeaveNotificationEmail } = await import('./templates/leave-notification')
    const emailHtml = LeaveNotificationEmail({
      employeeName: data.employeeName,
      leaveType: data.leaveType,
      fromDate: data.fromDate,
      toDate: data.toDate,
      totalDays: data.totalDays,
      status: data.status,
      approverName: data.approverName,
      rejectionReason: data.rejectionReason,
      actionUrl: data.actionUrl
    })

    const result = await resend.emails.send({
      from: 'LOANZ360 <noreply@loanz360.com>',
      to: data.to,
      subject: `Leave Request ${data.status === 'approved' ? 'Approved' : data.status === 'rejected' ? 'Rejected' : 'Status Update'}`,
      html: emailHtml
    })

    return { success: true, data: result }
  } catch (error) {
    console.error('Failed to send leave notification:', error)
    return { success: false, error }
  }
}

export const sendApprovalRequest = async (data: ApprovalRequestData) => {
  try {
    const { default: ApprovalRequestEmail } = await import('./templates/approval-request')
    const emailHtml = ApprovalRequestEmail({
      approverName: data.approverName,
      employeeName: data.employeeName,
      leaveType: data.leaveType,
      fromDate: data.fromDate,
      toDate: data.toDate,
      totalDays: data.totalDays,
      reason: data.reason,
      actionUrl: data.actionUrl
    })

    const result = await resend.emails.send({
      from: 'LOANZ360 <noreply@loanz360.com>',
      to: data.to,
      subject: 'New Leave Request Awaiting Approval',
      html: emailHtml
    })

    return { success: true, data: result }
  } catch (error) {
    console.error('Failed to send approval request:', error)
    return { success: false, error }
  }
}

export const sendAttendanceReminder = async (data: AttendanceReminderData) => {
  try {
    const { default: AttendanceReminderEmail } = await import('./templates/attendance-reminder')
    const emailHtml = AttendanceReminderEmail({
      employeeName: data.employeeName,
      reminderType: data.reminderType,
      date: data.date,
      actionUrl: data.actionUrl
    })

    const getReminderSubject = () => {
      switch (data.reminderType) {
        case 'check-in':
          return 'Reminder: Check In for Today'
        case 'check-out':
          return 'Reminder: Check Out'
        case 'missing':
          return 'Action Required: Missing Attendance Records'
        default:
          return 'Attendance Reminder'
      }
    }

    const result = await resend.emails.send({
      from: 'LOANZ360 <noreply@loanz360.com>',
      to: data.to,
      subject: getReminderSubject(),
      html: emailHtml
    })

    return { success: true, data: result }
  } catch (error) {
    console.error('Failed to send attendance reminder:', error)
    return { success: false, error }
  }
}

// Batch send function for multiple emails
export const sendBatchEmails = async (emails: Array<LeaveNotificationData | ApprovalRequestData | AttendanceReminderData>) => {
  const results = await Promise.allSettled(
    emails.map(async (email) => {
      if ('status' in email) {
        return sendLeaveNotification(email as LeaveNotificationData)
      } else if ('approverName' in email) {
        return sendApprovalRequest(email as ApprovalRequestData)
      } else {
        return sendAttendanceReminder(email as AttendanceReminderData)
      }
    })
  )

  const successful = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length

  return {
    total: emails.length,
    successful,
    failed,
    results
  }
}
