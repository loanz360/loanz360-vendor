/**
 * Employee Support Ticket Email Notification Service
 *
 * Handles email notifications for employee internal support tickets:
 * - New ticket created (to employee & HR/Super Admin)
 * - Ticket assigned to specific user
 * - New message/reply from HR/Super Admin
 * - Ticket status changed
 * - Ticket resolved/closed
 * - SLA breach warnings
 * - Ticket reopened
 *
 * Integrates with production-ready email service (Resend/SendGrid)
 */

import { sendEmail } from '@/lib/communication/email-service'

interface EmployeeTicketNotificationData {
  ticketNumber: string
  ticketId: string
  subject: string
  employeeName: string
  employeeEmail: string
  employeeRole?: string
  hrAdminName?: string
  hrAdminEmail?: string
  assignedTo: 'hr' | 'super_admin' | 'both'
  status: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  category: string
  message?: string
  resolutionSummary?: string
  isAnonymous?: boolean
  isConfidential?: boolean
}

export class EmployeeSupportEmailService {
  private static appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  /**
   * Generate email template wrapper with Loanz360 branding
   */
  private static wrapEmailTemplate(content: string, title: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            margin: 0;
            padding: 0;
            background-color: #f9fafb;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            background: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          }
          .header {
            background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
          }
          .header p {
            margin: 10px 0 0 0;
            opacity: 0.95;
            font-size: 14px;
          }
          .content {
            padding: 40px 30px;
            background: #ffffff;
          }
          .content h2 {
            color: #111827;
            font-size: 22px;
            margin: 0 0 20px 0;
            font-weight: 600;
          }
          .content p {
            margin: 0 0 15px 0;
            color: #4b5563;
            font-size: 15px;
          }
          .footer {
            background: #f9fafb;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
          }
          .footer p {
            margin: 5px 0;
            color: #6b7280;
            font-size: 13px;
          }
          .button {
            display: inline-block;
            padding: 14px 28px;
            background: #f97316;
            color: white !important;
            text-decoration: none;
            border-radius: 8px;
            margin: 25px 0 15px 0;
            font-weight: 600;
            font-size: 15px;
            transition: background 0.3s ease;
          }
          .button:hover {
            background: #ea580c;
          }
          .info-box {
            background: #f9fafb;
            padding: 20px;
            border-left: 4px solid #f97316;
            margin: 20px 0;
            border-radius: 6px;
          }
          .info-box strong {
            color: #111827;
            font-weight: 600;
          }
          .badge {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 16px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .badge-urgent { background: #fee2e2; color: #dc2626; }
          .badge-high { background: #fed7aa; color: #ea580c; }
          .badge-medium { background: #fef3c7; color: #d97706; }
          .badge-low { background: #dbeafe; color: #2563eb; }
          .alert-box {
            background: #fef2f2;
            border-left: 4px solid #ef4444;
            padding: 15px;
            margin: 15px 0;
            border-radius: 6px;
          }
          .success-box {
            background: #f0fdf4;
            border-left: 4px solid #22c55e;
            padding: 15px;
            margin: 15px 0;
            border-radius: 6px;
          }
          .message-preview {
            background: #f9fafb;
            padding: 15px;
            border-radius: 6px;
            margin: 15px 0;
            border: 1px solid #e5e7eb;
            font-style: italic;
            color: #6b7280;
          }
          ul {
            margin: 15px 0;
            padding-left: 25px;
          }
          ul li {
            margin: 8px 0;
            color: #4b5563;
          }
          .confidential-badge {
            background: #dc2626;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.5px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>LOANZ 360</h1>
            <p>Internal Employee Support System</p>
          </div>
          <div class="content">
            ${content}
          </div>
          <div class="footer">
            <p><strong>This is an automated message from LOANZ 360 HR Support.</strong></p>
            <p>Please do not reply to this email. For support, use your employee dashboard.</p>
            <p style="margin-top: 20px; font-size: 12px;">&copy; ${new Date().getFullYear()} LOANZ 360. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }

  /**
   * Get priority badge HTML
   */
  private static getPriorityBadge(priority: string): string {
    return `<span class="badge badge-${priority}">${priority}</span>`
  }

  /**
   * Get category display name
   */
  private static getCategoryDisplay(category: string): string {
    const categoryMap: Record<string, string> = {
      payroll: 'Payroll & Compensation',
      leave: 'Leave Management',
      attendance: 'Attendance & Time Tracking',
      performance: 'Performance & Appraisals',
      technical: 'Technical Support',
      policy: 'Policy & Procedures',
      harassment: 'Harassment & Ethics',
      general: 'General Inquiry',
      other: 'Other'
    }
    return categoryMap[category] || category.replace(/_/g, ' ').toUpperCase()
  }

  /**
   * Get status display name
   */
  private static getStatusDisplay(status: string): string {
    return status.replace(/_/g, ' ').split(' ').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  /**
   * Notify employee when ticket is created (confirmation)
   */
  static async notifyEmployeeTicketCreated(data: EmployeeTicketNotificationData): Promise<boolean> {
    const priorityBadge = this.getPriorityBadge(data.priority)
    const categoryDisplay = this.getCategoryDisplay(data.category)
    const confidentialBadge = data.isConfidential ? '<span class="confidential-badge">CONFIDENTIAL</span>' : ''

    const assignmentText = data.assignedTo === 'both'
      ? 'HR and Super Admin teams'
      : data.assignedTo === 'hr'
        ? 'HR team'
        : 'Super Admin team'

    const content = `
      <h2>✅ Your Support Ticket Has Been Created</h2>
      <p>Dear ${data.employeeName},</p>
      <p>Thank you for reaching out to our support team. Your ticket has been successfully created and assigned to our <strong>${assignmentText}</strong>. We will review and respond as soon as possible.</p>

      <div class="info-box">
        <strong>Ticket Number:</strong> ${data.ticketNumber} ${confidentialBadge}<br>
        <strong>Subject:</strong> ${data.subject}<br>
        <strong>Priority:</strong> ${priorityBadge}<br>
        <strong>Category:</strong> ${categoryDisplay}<br>
        <strong>Status:</strong> <strong>${this.getStatusDisplay(data.status)}</strong><br>
        <strong>Assigned To:</strong> ${assignmentText}
      </div>

      <p><strong>Expected Response Time:</strong></p>
      <ul>
        <li><strong>Urgent:</strong> Within 2 hours</li>
        <li><strong>High:</strong> Within 4 hours</li>
        <li><strong>Medium:</strong> Within 8 hours</li>
        <li><strong>Low:</strong> Within 24 hours</li>
      </ul>

      <a href="${this.appUrl}/employees/support/${data.ticketId}" class="button">View Ticket Details</a>

      <p>You will receive email notifications when:</p>
      <ul>
        <li>Someone responds to your ticket</li>
        <li>The ticket status changes</li>
        <li>Your ticket is resolved</li>
      </ul>

      ${data.isConfidential ? `
        <div class="alert-box">
          <strong>⚠️ Confidential Ticket:</strong> This ticket is marked as confidential and will only be visible to authorized personnel.
        </div>
      ` : ''}
    `

    const text = `Your support ticket ${data.ticketNumber} has been created. Subject: ${data.subject}. Expected response within ${data.priority === 'urgent' ? '2 hours' : data.priority === 'high' ? '4 hours' : data.priority === 'medium' ? '8 hours' : '24 hours'}.`

    try {
      const result = await sendEmail({
        to: data.employeeEmail,
        subject: `✅ Support Ticket Created - ${data.ticketNumber}`,
        html: this.wrapEmailTemplate(content, 'Ticket Created'),
        text,
        tags: {
          type: 'employee_support',
          event: 'ticket_created',
          ticketId: data.ticketId,
          priority: data.priority
        }
      })

      return result.success
    } catch (error) {
      console.error('[EmployeeSupportEmail] Error sending ticket created email:', error)
      return false
    }
  }

  /**
   * Notify HR/Super Admin when new ticket is assigned to them
   */
  static async notifyHRAdminNewTicket(data: EmployeeTicketNotificationData): Promise<boolean> {
    if (!data.hrAdminEmail) return false

    const priorityBadge = this.getPriorityBadge(data.priority)
    const categoryDisplay = this.getCategoryDisplay(data.category)
    const confidentialBadge = data.isConfidential ? '<span class="confidential-badge">CONFIDENTIAL</span>' : ''
    const employeeInfo = data.isAnonymous ? 'Anonymous Employee' : data.employeeName

    const content = `
      <h2>🎫 New Support Ticket Assigned</h2>
      <p>Hello ${data.hrAdminName || 'Team'},</p>
      <p>A new employee support ticket has been assigned to your team and requires your attention.</p>

      <div class="info-box">
        <strong>Ticket Number:</strong> ${data.ticketNumber} ${confidentialBadge}<br>
        <strong>From:</strong> ${employeeInfo}${data.employeeRole ? ` (${data.employeeRole})` : ''}<br>
        <strong>Subject:</strong> ${data.subject}<br>
        <strong>Priority:</strong> ${priorityBadge}<br>
        <strong>Category:</strong> ${categoryDisplay}<br>
        <strong>Created:</strong> Just now
      </div>

      ${data.priority === 'urgent' ? `
        <div class="alert-box">
          <strong>⚠️ URGENT PRIORITY:</strong> This ticket requires immediate attention. Please respond within 2 hours.
        </div>
      ` : ''}

      ${data.isConfidential ? `
        <div class="alert-box">
          <strong>🔒 CONFIDENTIAL:</strong> This ticket contains sensitive information. Handle with appropriate discretion.
        </div>
      ` : ''}

      <a href="${this.appUrl}/employees/${data.assignedTo === 'super_admin' ? 'superadmin/(dashboard)' : 'hr'}/support-tickets/${data.ticketId}" class="button">View & Respond</a>

      <p><strong>Response Time Target:</strong> ${
        data.priority === 'urgent' ? '2 hours' :
        data.priority === 'high' ? '4 hours' :
        data.priority === 'medium' ? '8 hours' : '24 hours'
      }</p>
    `

    const text = `New support ticket ${data.ticketNumber} from ${employeeInfo}. Priority: ${data.priority}. Subject: ${data.subject}`

    try {
      const result = await sendEmail({
        to: data.hrAdminEmail,
        subject: `${data.priority === 'urgent' ? '🚨 URGENT: ' : ''}New Ticket - ${data.ticketNumber}`,
        html: this.wrapEmailTemplate(content, 'New Ticket Assignment'),
        text,
        tags: {
          type: 'employee_support',
          event: 'hr_admin_assignment',
          ticketId: data.ticketId,
          priority: data.priority
        }
      })

      return result.success
    } catch (error) {
      console.error('[EmployeeSupportEmail] Error sending HR/Admin new ticket email:', error)
      return false
    }
  }

  /**
   * Notify employee when HR/Admin replies to ticket
   */
  static async notifyEmployeeNewReply(data: EmployeeTicketNotificationData): Promise<boolean> {
    const replyFrom = data.hrAdminName || (data.assignedTo === 'super_admin' ? 'Super Admin' : 'HR Team')

    const content = `
      <h2>💬 New Response to Your Ticket</h2>
      <p>Dear ${data.employeeName},</p>
      <p>You have received a new response on your support ticket from our team.</p>

      <div class="info-box">
        <strong>Ticket Number:</strong> ${data.ticketNumber}<br>
        <strong>From:</strong> ${replyFrom}<br>
        <strong>Subject:</strong> ${data.subject}
      </div>

      ${data.message ? `
        <div class="message-preview">
          ${data.message.substring(0, 250)}${data.message.length > 250 ? '...' : ''}
        </div>
      ` : ''}

      <a href="${this.appUrl}/employees/support/${data.ticketId}" class="button">View Full Response</a>

      <p>Please log in to your employee dashboard to view the complete message and continue the conversation.</p>
    `

    const text = `New response on ticket ${data.ticketNumber} from ${replyFrom}. Log in to view and reply.`

    try {
      const result = await sendEmail({
        to: data.employeeEmail,
        subject: `💬 New Response - ${data.ticketNumber}`,
        html: this.wrapEmailTemplate(content, 'New Response'),
        text,
        tags: {
          type: 'employee_support',
          event: 'employee_new_reply',
          ticketId: data.ticketId
        }
      })

      return result.success
    } catch (error) {
      console.error('[EmployeeSupportEmail] Error sending new reply email:', error)
      return false
    }
  }

  /**
   * Notify HR/Admin when employee replies
   */
  static async notifyHRAdminEmployeeReply(data: EmployeeTicketNotificationData): Promise<boolean> {
    if (!data.hrAdminEmail) return false

    const employeeInfo = data.isAnonymous ? 'Anonymous Employee' : data.employeeName

    const content = `
      <h2>💬 Employee Reply on Ticket</h2>
      <p>Hello ${data.hrAdminName || 'Team'},</p>
      <p>An employee has replied to support ticket <strong>${data.ticketNumber}</strong>.</p>

      <div class="info-box">
        <strong>Ticket Number:</strong> ${data.ticketNumber}<br>
        <strong>From:</strong> ${employeeInfo}<br>
        <strong>Subject:</strong> ${data.subject}
      </div>

      ${data.message ? `
        <div class="message-preview">
          ${data.message.substring(0, 250)}${data.message.length > 250 ? '...' : ''}
        </div>
      ` : ''}

      <a href="${this.appUrl}/employees/${data.assignedTo === 'super_admin' ? 'superadmin/(dashboard)' : 'hr'}/support-tickets/${data.ticketId}" class="button">View & Respond</a>
    `

    const text = `Employee reply on ticket ${data.ticketNumber}. From: ${employeeInfo}`

    try {
      const result = await sendEmail({
        to: data.hrAdminEmail,
        subject: `💬 Employee Reply - ${data.ticketNumber}`,
        html: this.wrapEmailTemplate(content, 'Employee Reply'),
        text,
        tags: {
          type: 'employee_support',
          event: 'hr_admin_employee_reply',
          ticketId: data.ticketId
        }
      })

      return result.success
    } catch (error) {
      console.error('[EmployeeSupportEmail] Error sending employee reply email:', error)
      return false
    }
  }

  /**
   * Notify employee when ticket status changes
   */
  static async notifyEmployeeStatusChange(
    data: EmployeeTicketNotificationData,
    oldStatus: string
  ): Promise<boolean> {
    const oldStatusDisplay = this.getStatusDisplay(oldStatus)
    const newStatusDisplay = this.getStatusDisplay(data.status)

    const content = `
      <h2>📝 Ticket Status Updated</h2>
      <p>Dear ${data.employeeName},</p>
      <p>The status of your support ticket has been updated.</p>

      <div class="info-box">
        <strong>Ticket Number:</strong> ${data.ticketNumber}<br>
        <strong>Previous Status:</strong> ${oldStatusDisplay}<br>
        <strong>New Status:</strong> <strong style="color: #f97316;">${newStatusDisplay}</strong>
      </div>

      ${data.status === 'on_hold' ? `
        <div class="alert-box">
          <strong>⏸️ On Hold:</strong> Your ticket is currently on hold. We may need additional information from you or are waiting for further investigation.
        </div>
      ` : ''}

      ${data.status === 'in_progress' ? `
        <div class="success-box">
          <strong>✅ In Progress:</strong> Our team is actively working on resolving your issue.
        </div>
      ` : ''}

      <a href="${this.appUrl}/employees/support/${data.ticketId}" class="button">View Ticket</a>
    `

    const text = `Ticket ${data.ticketNumber} status changed from ${oldStatusDisplay} to ${newStatusDisplay}.`

    try {
      const result = await sendEmail({
        to: data.employeeEmail,
        subject: `📝 Status Update - ${data.ticketNumber}`,
        html: this.wrapEmailTemplate(content, 'Status Update'),
        text,
        tags: {
          type: 'employee_support',
          event: 'status_change',
          ticketId: data.ticketId,
          newStatus: data.status
        }
      })

      return result.success
    } catch (error) {
      console.error('[EmployeeSupportEmail] Error sending status change email:', error)
      return false
    }
  }

  /**
   * Notify employee when ticket is resolved
   */
  static async notifyEmployeeTicketResolved(data: EmployeeTicketNotificationData): Promise<boolean> {
    const content = `
      <h2>✅ Your Ticket Has Been Resolved</h2>
      <p>Dear ${data.employeeName},</p>
      <p>Great news! Your support ticket has been resolved by our team.</p>

      <div class="success-box">
        <strong>Ticket Number:</strong> ${data.ticketNumber}<br>
        <strong>Status:</strong> RESOLVED<br>
        ${data.resolutionSummary ? `<strong>Resolution:</strong> ${data.resolutionSummary}` : ''}
      </div>

      <p><strong>What happens next?</strong></p>
      <ul>
        <li>If this resolves your issue, no further action is needed</li>
        <li>The ticket will be automatically closed in 48 hours</li>
        <li>If you need further assistance, you can reopen this ticket</li>
      </ul>

      <a href="${this.appUrl}/employees/support/${data.ticketId}" class="button">View Resolution & Provide Feedback</a>

      <p><strong>📊 We Value Your Feedback!</strong></p>
      <p>Please take a moment to rate your support experience. Your feedback helps us improve our service.</p>

      <p>If your issue is not fully resolved, simply reply to this ticket and it will be automatically reopened.</p>
    `

    const text = `Ticket ${data.ticketNumber} has been resolved. Please rate your support experience.`

    try {
      const result = await sendEmail({
        to: data.employeeEmail,
        subject: `✅ Ticket Resolved - ${data.ticketNumber}`,
        html: this.wrapEmailTemplate(content, 'Ticket Resolved'),
        text,
        tags: {
          type: 'employee_support',
          event: 'ticket_resolved',
          ticketId: data.ticketId
        }
      })

      return result.success
    } catch (error) {
      console.error('[EmployeeSupportEmail] Error sending ticket resolved email:', error)
      return false
    }
  }

  /**
   * Notify employee when ticket is closed
   */
  static async notifyEmployeeTicketClosed(data: EmployeeTicketNotificationData): Promise<boolean> {
    const content = `
      <h2>🔒 Your Ticket Has Been Closed</h2>
      <p>Dear ${data.employeeName},</p>
      <p>Your support ticket has been closed.</p>

      <div class="info-box">
        <strong>Ticket Number:</strong> ${data.ticketNumber}<br>
        <strong>Subject:</strong> ${data.subject}<br>
        <strong>Final Status:</strong> CLOSED
      </div>

      <p>If you have any additional concerns or if your issue reoccurs, please feel free to create a new support ticket.</p>

      <a href="${this.appUrl}/employees/support/create" class="button">Create New Ticket</a>

      <p>Thank you for using LOANZ 360 Support System!</p>
    `

    const text = `Ticket ${data.ticketNumber} has been closed. Create a new ticket if you need further assistance.`

    try {
      const result = await sendEmail({
        to: data.employeeEmail,
        subject: `🔒 Ticket Closed - ${data.ticketNumber}`,
        html: this.wrapEmailTemplate(content, 'Ticket Closed'),
        text,
        tags: {
          type: 'employee_support',
          event: 'ticket_closed',
          ticketId: data.ticketId
        }
      })

      return result.success
    } catch (error) {
      console.error('[EmployeeSupportEmail] Error sending ticket closed email:', error)
      return false
    }
  }

  /**
   * Notify employee when ticket is reopened
   */
  static async notifyEmployeeTicketReopened(data: EmployeeTicketNotificationData): Promise<boolean> {
    const content = `
      <h2>🔄 Your Ticket Has Been Reopened</h2>
      <p>Dear ${data.employeeName},</p>
      <p>Your support ticket has been reopened based on your recent activity.</p>

      <div class="info-box">
        <strong>Ticket Number:</strong> ${data.ticketNumber}<br>
        <strong>Subject:</strong> ${data.subject}<br>
        <strong>Status:</strong> REOPENED
      </div>

      <p>Our team will review your latest message and respond as soon as possible.</p>

      <a href="${this.appUrl}/employees/support/${data.ticketId}" class="button">View Ticket</a>
    `

    const text = `Ticket ${data.ticketNumber} has been reopened. Our team will respond shortly.`

    try {
      const result = await sendEmail({
        to: data.employeeEmail,
        subject: `🔄 Ticket Reopened - ${data.ticketNumber}`,
        html: this.wrapEmailTemplate(content, 'Ticket Reopened'),
        text,
        tags: {
          type: 'employee_support',
          event: 'ticket_reopened',
          ticketId: data.ticketId
        }
      })

      return result.success
    } catch (error) {
      console.error('[EmployeeSupportEmail] Error sending ticket reopened email:', error)
      return false
    }
  }

  /**
   * Notify assigned ticket to specific HR/Admin user
   */
  static async notifySpecificAssignment(data: EmployeeTicketNotificationData): Promise<boolean> {
    if (!data.hrAdminEmail || !data.hrAdminName) return false

    const priorityBadge = this.getPriorityBadge(data.priority)
    const categoryDisplay = this.getCategoryDisplay(data.category)

    const content = `
      <h2>👤 Ticket Assigned to You</h2>
      <p>Hello ${data.hrAdminName},</p>
      <p>A support ticket has been specifically assigned to you.</p>

      <div class="info-box">
        <strong>Ticket Number:</strong> ${data.ticketNumber}<br>
        <strong>From:</strong> ${data.isAnonymous ? 'Anonymous Employee' : data.employeeName}<br>
        <strong>Subject:</strong> ${data.subject}<br>
        <strong>Priority:</strong> ${priorityBadge}<br>
        <strong>Category:</strong> ${categoryDisplay}
      </div>

      ${data.priority === 'urgent' ? `
        <div class="alert-box">
          <strong>⚠️ URGENT:</strong> This ticket requires immediate attention.
        </div>
      ` : ''}

      <a href="${this.appUrl}/employees/${data.assignedTo === 'super_admin' ? 'superadmin/(dashboard)' : 'hr'}/support-tickets/${data.ticketId}" class="button">View & Respond</a>
    `

    const text = `Ticket ${data.ticketNumber} has been assigned to you. Priority: ${data.priority}`

    try {
      const result = await sendEmail({
        to: data.hrAdminEmail,
        subject: `👤 Ticket Assigned to You - ${data.ticketNumber}`,
        html: this.wrapEmailTemplate(content, 'Ticket Assignment'),
        text,
        tags: {
          type: 'employee_support',
          event: 'specific_assignment',
          ticketId: data.ticketId,
          priority: data.priority
        }
      })

      return result.success
    } catch (error) {
      console.error('[EmployeeSupportEmail] Error sending specific assignment email:', error)
      return false
    }
  }

  /**
   * Send SLA breach warning (for future implementation with SLA tracking)
   */
  static async notifySLAWarning(
    data: EmployeeTicketNotificationData,
    hoursRemaining: number
  ): Promise<boolean> {
    if (!data.hrAdminEmail) return false

    const content = `
      <h2 style="color: #dc2626;">⚠️ SLA Breach Warning</h2>
      <p>Hello ${data.hrAdminName || 'Team'},</p>
      <p><strong>This ticket is approaching its SLA deadline!</strong></p>

      <div class="alert-box">
        <strong>Ticket Number:</strong> ${data.ticketNumber}<br>
        <strong>Employee:</strong> ${data.isAnonymous ? 'Anonymous' : data.employeeName}<br>
        <strong>Time Remaining:</strong> <span style="color: #dc2626; font-weight: bold;">${hoursRemaining.toFixed(1)} hours</span><br>
        <strong>Priority:</strong> ${this.getPriorityBadge(data.priority)}
      </div>

      <p><strong>⚠️ Action Required:</strong> Please respond to this ticket immediately to avoid SLA breach.</p>

      <a href="${this.appUrl}/employees/${data.assignedTo === 'super_admin' ? 'superadmin/(dashboard)' : 'hr'}/support-tickets/${data.ticketId}" class="button" style="background: #dc2626;">Respond Now</a>
    `

    const text = `SLA WARNING: Ticket ${data.ticketNumber} has ${hoursRemaining.toFixed(1)} hours remaining. Respond immediately!`

    try {
      const result = await sendEmail({
        to: data.hrAdminEmail,
        subject: `🚨 SLA Warning - ${data.ticketNumber}`,
        html: this.wrapEmailTemplate(content, 'SLA Warning'),
        text,
        tags: {
          type: 'employee_support',
          event: 'sla_warning',
          ticketId: data.ticketId,
          priority: data.priority
        }
      })

      return result.success
    } catch (error) {
      console.error('[EmployeeSupportEmail] Error sending SLA warning email:', error)
      return false
    }
  }
}

export default EmployeeSupportEmailService
