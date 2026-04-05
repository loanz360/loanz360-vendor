/**
 * Email Notification Service for Customer Support Tickets
 *
 * This service handles sending email notifications for various ticket events:
 * - New ticket created
 * - Ticket assigned to agent
 * - New message from support
 * - Ticket status changed
 * - Ticket resolved
 * - SLA breach warning
 */

interface EmailNotificationData {
  to: string
  subject: string
  html: string
  text?: string
}

interface TicketNotificationData {
  ticketNumber: string
  ticketId: string
  subject: string
  customerName: string
  customerEmail: string
  agentName?: string
  agentEmail?: string
  status: string
  priority: string
  category: string
  message?: string
  resolutionSummary?: string
}

export class EmailNotificationService {
  private static apiUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  /**
   * Send email notification
   * In production, this would integrate with email service (SendGrid, AWS SES, etc.)
   */
  private static async sendEmail(data: EmailNotificationData): Promise<boolean> {
    try {
      // TODO: Integrate with actual email service
      // For now, log to console (in production, call email API)
      console.log('📧 Email Notification:', {
        to: data.to,
        subject: data.subject,
        preview: data.text?.substring(0, 100)
      })

      // Uncomment when integrating with actual email service:
      /*
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      return response.ok
      */

      return true
    } catch (error) {
      console.error('Error sending email:', error)
      return false
    }
  }

  /**
   * Generate email template wrapper
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
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
          .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; color: #6b7280; font-size: 14px; }
          .button { display: inline-block; padding: 12px 24px; background: #f97316; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .info-box { background: #f3f4f6; padding: 15px; border-left: 4px solid #f97316; margin: 15px 0; }
          .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; margin: 0 5px; }
          .badge-urgent { background: #fee2e2; color: #dc2626; }
          .badge-high { background: #fed7aa; color: #ea580c; }
          .badge-medium { background: #fef3c7; color: #d97706; }
          .badge-low { background: #dbeafe; color: #2563eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Loanz360 Support</h1>
          </div>
          <div class="content">
            ${content}
          </div>
          <div class="footer">
            <p>This is an automated message from Loanz360 Customer Support.</p>
            <p>Please do not reply to this email. For support, visit your support dashboard.</p>
            <p>&copy; ${new Date().getFullYear()} Loanz360. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }

  /**
   * Notify customer when new ticket is created
   */
  static async notifyTicketCreated(data: TicketNotificationData): Promise<boolean> {
    const priorityBadge = `<span class="badge badge-${data.priority}">${data.priority.toUpperCase()}</span>`

    const content = `
      <h2>Your Support Ticket Has Been Created</h2>
      <p>Dear ${data.customerName},</p>
      <p>Thank you for contacting Loanz360 Support. We have received your ticket and our team will respond shortly.</p>

      <div class="info-box">
        <strong>Ticket Number:</strong> ${data.ticketNumber}<br>
        <strong>Subject:</strong> ${data.subject}<br>
        <strong>Priority:</strong> ${priorityBadge}<br>
        <strong>Category:</strong> ${data.category.replace(/_/g, ' ').toUpperCase()}<br>
        <strong>Status:</strong> ${data.status.replace(/_/g, ' ').toUpperCase()}
      </div>

      <p>We typically respond to tickets within:</p>
      <ul>
        <li><strong>Urgent:</strong> 1 hour</li>
        <li><strong>High:</strong> 4 hours</li>
        <li><strong>Medium:</strong> 8 hours</li>
        <li><strong>Low:</strong> 24 hours</li>
      </ul>

      <a href="${this.apiUrl}/customers/support/${data.ticketId}" class="button">View Ticket</a>

      <p>If you have any additional information to add, please reply through your support dashboard.</p>
    `

    const text = `Your support ticket ${data.ticketNumber} has been created. Subject: ${data.subject}. We will respond shortly.`

    return this.sendEmail({
      to: data.customerEmail,
      subject: `Support Ticket Created - ${data.ticketNumber}`,
      html: this.wrapEmailTemplate(content, 'Ticket Created'),
      text
    })
  }

  /**
   * Notify customer when ticket is assigned to agent
   */
  static async notifyTicketAssigned(data: TicketNotificationData): Promise<boolean> {
    const content = `
      <h2>Your Ticket Has Been Assigned</h2>
      <p>Dear ${data.customerName},</p>
      <p>Your support ticket has been assigned to one of our support specialists.</p>

      <div class="info-box">
        <strong>Ticket Number:</strong> ${data.ticketNumber}<br>
        <strong>Assigned To:</strong> ${data.agentName || 'Support Team'}<br>
        <strong>Status:</strong> ${data.status.replace(/_/g, ' ').toUpperCase()}
      </div>

      <p>Our team member will review your case and respond as soon as possible.</p>

      <a href="${this.apiUrl}/customers/support/${data.ticketId}" class="button">View Ticket</a>
    `

    const text = `Your ticket ${data.ticketNumber} has been assigned to ${data.agentName || 'our support team'}.`

    return this.sendEmail({
      to: data.customerEmail,
      subject: `Ticket Assigned - ${data.ticketNumber}`,
      html: this.wrapEmailTemplate(content, 'Ticket Assigned'),
      text
    })
  }

  /**
   * Notify customer when agent replies
   */
  static async notifyNewAgentMessage(data: TicketNotificationData): Promise<boolean> {
    const content = `
      <h2>New Response to Your Ticket</h2>
      <p>Dear ${data.customerName},</p>
      <p>Our support team has sent you a new message regarding your ticket.</p>

      <div class="info-box">
        <strong>Ticket Number:</strong> ${data.ticketNumber}<br>
        <strong>From:</strong> ${data.agentName || 'Loanz360 Support'}<br>
      </div>

      ${data.message ? `
        <div style="background: #f9fafb; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <p style="margin: 0;">${data.message.substring(0, 200)}${data.message.length > 200 ? '...' : ''}</p>
        </div>
      ` : ''}

      <a href="${this.apiUrl}/customers/support/${data.ticketId}" class="button">View & Reply</a>

      <p>Please log in to your account to view the full message and respond.</p>
    `

    const text = `New response on ticket ${data.ticketNumber}. Log in to view and reply.`

    return this.sendEmail({
      to: data.customerEmail,
      subject: `New Response - ${data.ticketNumber}`,
      html: this.wrapEmailTemplate(content, 'New Response'),
      text
    })
  }

  /**
   * Notify customer when ticket status changes
   */
  static async notifyStatusChange(data: TicketNotificationData, oldStatus: string): Promise<boolean> {
    const content = `
      <h2>Ticket Status Updated</h2>
      <p>Dear ${data.customerName},</p>
      <p>The status of your support ticket has been updated.</p>

      <div class="info-box">
        <strong>Ticket Number:</strong> ${data.ticketNumber}<br>
        <strong>Previous Status:</strong> ${oldStatus.replace(/_/g, ' ').toUpperCase()}<br>
        <strong>New Status:</strong> ${data.status.replace(/_/g, ' ').toUpperCase()}
      </div>

      ${data.status === 'pending_customer' ? `
        <p><strong>⚠️ Action Required:</strong> We're waiting for additional information from you. Please review your ticket and provide the requested details.</p>
      ` : ''}

      <a href="${this.apiUrl}/customers/support/${data.ticketId}" class="button">View Ticket</a>
    `

    const text = `Ticket ${data.ticketNumber} status changed from ${oldStatus} to ${data.status}.`

    return this.sendEmail({
      to: data.customerEmail,
      subject: `Status Update - ${data.ticketNumber}`,
      html: this.wrapEmailTemplate(content, 'Status Update'),
      text
    })
  }

  /**
   * Notify customer when ticket is resolved
   */
  static async notifyTicketResolved(data: TicketNotificationData): Promise<boolean> {
    const content = `
      <h2>Your Ticket Has Been Resolved</h2>
      <p>Dear ${data.customerName},</p>
      <p>Great news! Your support ticket has been resolved.</p>

      <div class="info-box">
        <strong>Ticket Number:</strong> ${data.ticketNumber}<br>
        <strong>Status:</strong> RESOLVED<br>
        ${data.resolutionSummary ? `<strong>Resolution:</strong> ${data.resolutionSummary}` : ''}
      </div>

      <p>If this resolves your issue, no further action is needed. The ticket will be automatically closed in 48 hours.</p>

      <p><strong>Was this resolution helpful?</strong> We'd love your feedback!</p>

      <a href="${this.apiUrl}/customers/support/${data.ticketId}" class="button">Rate This Support</a>

      <p>If your issue is not fully resolved, please reopen the ticket by replying with additional details.</p>
    `

    const text = `Ticket ${data.ticketNumber} has been resolved. Please rate your support experience.`

    return this.sendEmail({
      to: data.customerEmail,
      subject: `Ticket Resolved - ${data.ticketNumber}`,
      html: this.wrapEmailTemplate(content, 'Ticket Resolved'),
      text
    })
  }

  /**
   * Notify agent when new ticket is assigned to them
   */
  static async notifyAgentAssignment(data: TicketNotificationData): Promise<boolean> {
    if (!data.agentEmail) return false

    const priorityBadge = `<span class="badge badge-${data.priority}">${data.priority.toUpperCase()}</span>`

    const content = `
      <h2>New Ticket Assigned to You</h2>
      <p>Hello ${data.agentName},</p>
      <p>A new support ticket has been assigned to you.</p>

      <div class="info-box">
        <strong>Ticket Number:</strong> ${data.ticketNumber}<br>
        <strong>Customer:</strong> ${data.customerName}<br>
        <strong>Subject:</strong> ${data.subject}<br>
        <strong>Priority:</strong> ${priorityBadge}<br>
        <strong>Category:</strong> ${data.category.replace(/_/g, ' ').toUpperCase()}
      </div>

      <a href="${this.apiUrl}/employees/customer-support-executive/tickets/${data.ticketId}" class="button">View Ticket</a>

      <p>Please review and respond to this ticket as soon as possible.</p>
    `

    const text = `New ticket ${data.ticketNumber} assigned to you from ${data.customerName}. Subject: ${data.subject}`

    return this.sendEmail({
      to: data.agentEmail,
      subject: `New Ticket Assignment - ${data.ticketNumber}`,
      html: this.wrapEmailTemplate(content, 'Ticket Assignment'),
      text
    })
  }

  /**
   * Notify agent and manager when SLA is about to be breached
   */
  static async notifySLAWarning(data: TicketNotificationData, hoursRemaining: number): Promise<boolean> {
    if (!data.agentEmail) return false

    const content = `
      <h2 style="color: #dc2626;">⚠️ SLA Breach Warning</h2>
      <p>Hello ${data.agentName},</p>
      <p><strong>This ticket is approaching its SLA deadline!</strong></p>

      <div class="info-box" style="border-left-color: #dc2626;">
        <strong>Ticket Number:</strong> ${data.ticketNumber}<br>
        <strong>Customer:</strong> ${data.customerName}<br>
        <strong>Time Remaining:</strong> <span style="color: #dc2626; font-weight: bold;">${hoursRemaining.toFixed(1)} hours</span><br>
        <strong>Priority:</strong> <span class="badge badge-${data.priority}">${data.priority.toUpperCase()}</span>
      </div>

      <p><strong>Action Required:</strong> Please respond to this ticket immediately to avoid SLA breach.</p>

      <a href="${this.apiUrl}/employees/customer-support-executive/tickets/${data.ticketId}" class="button" style="background: #dc2626;">Respond Now</a>
    `

    const text = `SLA WARNING: Ticket ${data.ticketNumber} has ${hoursRemaining.toFixed(1)} hours remaining. Respond immediately!`

    return this.sendEmail({
      to: data.agentEmail,
      subject: `🚨 SLA Warning - ${data.ticketNumber}`,
      html: this.wrapEmailTemplate(content, 'SLA Warning'),
      text
    })
  }
}

export default EmailNotificationService
