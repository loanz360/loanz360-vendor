/**
 * Partner Support Email Notification Service
 * Sends email notifications for ticket events using the existing email API
 */

interface TicketEmailData {
  ticket_number: string
  subject: string
  priority: string
  category: string
  status: string
  partner_email: string
  partner_name: string
  assigned_to_email?: string
  assigned_to_name?: string
}

interface MessageEmailData {
  ticket_number: string
  subject: string
  message_content: string
  sender_name: string
  sender_type: 'partner' | 'support'
  recipient_email: string
  recipient_name: string
}

/**
 * Send email when a new ticket is created
 */
export async function sendTicketCreatedEmail(data: TicketEmailData) {
  try {
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ea580c;">New Support Ticket Created</h2>
        <p>Dear ${data.partner_name},</p>
        <p>Your support ticket has been successfully created. Our support team will review it shortly.</p>

        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Ticket Number:</strong> ${data.ticket_number}</p>
          <p style="margin: 5px 0;"><strong>Subject:</strong> ${data.subject}</p>
          <p style="margin: 5px 0;"><strong>Priority:</strong> <span style="color: ${getPriorityColor(data.priority)};">${data.priority.toUpperCase()}</span></p>
          <p style="margin: 5px 0;"><strong>Category:</strong> ${formatCategory(data.category)}</p>
          <p style="margin: 5px 0;"><strong>Status:</strong> ${formatStatus(data.status)}</p>
        </div>

        <p>You can track the progress of your ticket by logging into your partner portal.</p>
        <p>Expected response time based on priority:</p>
        <ul>
          ${getExpectedResponseTime(data.priority)}
        </ul>

        <p style="margin-top: 30px;">Best regards,<br/>Partner Support Team</p>
      </div>
    `

    await fetch('/api/notifications/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: data.partner_email,
        subject: `Support Ticket Created - ${data.ticket_number}`,
        html: emailBody,
      }),
    })
  } catch (error) {
    console.error('Failed to send ticket created email:', error)
  }
}

/**
 * Send email when ticket is assigned to a support agent
 */
export async function sendTicketAssignedEmail(data: TicketEmailData) {
  if (!data.assigned_to_email || !data.assigned_to_name) {
    return
  }

  try {
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ea580c;">New Ticket Assigned to You</h2>
        <p>Dear ${data.assigned_to_name},</p>
        <p>A new support ticket has been assigned to you. Please review and respond as soon as possible.</p>

        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Ticket Number:</strong> ${data.ticket_number}</p>
          <p style="margin: 5px 0;"><strong>Subject:</strong> ${data.subject}</p>
          <p style="margin: 5px 0;"><strong>Priority:</strong> <span style="color: ${getPriorityColor(data.priority)};">${data.priority.toUpperCase()}</span></p>
          <p style="margin: 5px 0;"><strong>Category:</strong> ${formatCategory(data.category)}</p>
          <p style="margin: 5px 0;"><strong>Partner:</strong> ${data.partner_name}</p>
        </div>

        <p>Please log in to the support portal to view the ticket details and respond.</p>
        <p style="margin-top: 30px;">Best regards,<br/>Partner Support System</p>
      </div>
    `

    await fetch('/api/notifications/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: data.assigned_to_email,
        subject: `Ticket Assigned - ${data.ticket_number}`,
        html: emailBody,
      }),
    })
  } catch (error) {
    console.error('Failed to send ticket assigned email:', error)
  }
}

/**
 * Send email when a new message is added to the ticket
 */
export async function sendNewMessageEmail(data: MessageEmailData) {
  try {
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ea580c;">New Message on Your Support Ticket</h2>
        <p>Dear ${data.recipient_name},</p>
        <p>A new message has been added to your support ticket by ${data.sender_type === 'partner' ? 'the partner' : 'our support team'}.</p>

        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Ticket Number:</strong> ${data.ticket_number}</p>
          <p style="margin: 5px 0;"><strong>Subject:</strong> ${data.subject}</p>
          <p style="margin: 5px 0;"><strong>From:</strong> ${data.sender_name}</p>
          <hr style="border: none; border-top: 1px solid #d1d5db; margin: 15px 0;">
          <p style="margin: 10px 0;"><strong>Message:</strong></p>
          <p style="background-color: white; padding: 15px; border-radius: 4px; white-space: pre-wrap;">${data.message_content}</p>
        </div>

        <p>Please log in to view the full conversation and respond if needed.</p>
        <p style="margin-top: 30px;">Best regards,<br/>Partner Support Team</p>
      </div>
    `

    await fetch('/api/notifications/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: data.recipient_email,
        subject: `New Message - ${data.ticket_number}`,
        html: emailBody,
      }),
    })
  } catch (error) {
    console.error('Failed to send new message email:', error)
  }
}

/**
 * Send email when ticket status changes
 */
export async function sendTicketStatusChangeEmail(data: TicketEmailData & { old_status: string }) {
  try {
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ea580c;">Ticket Status Updated</h2>
        <p>Dear ${data.partner_name},</p>
        <p>The status of your support ticket has been updated.</p>

        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Ticket Number:</strong> ${data.ticket_number}</p>
          <p style="margin: 5px 0;"><strong>Subject:</strong> ${data.subject}</p>
          <p style="margin: 5px 0;"><strong>Previous Status:</strong> ${formatStatus(data.old_status)}</p>
          <p style="margin: 5px 0;"><strong>New Status:</strong> <strong>${formatStatus(data.status)}</strong></p>
        </div>

        ${data.status === 'resolved' ? `
          <div style="background-color: #d1fae5; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0;">
            <p style="margin: 5px 0; color: #065f46;"><strong>Ticket Resolved</strong></p>
            <p style="margin: 5px 0; color: #065f46;">Your ticket has been marked as resolved. If you need further assistance, you can reopen this ticket or create a new one.</p>
          </div>
        ` : ''}

        ${data.status === 'closed' ? `
          <div style="background-color: #e5e7eb; padding: 15px; border-radius: 8px; border-left: 4px solid #6b7280; margin: 20px 0;">
            <p style="margin: 5px 0; color: #1f2937;"><strong>Ticket Closed</strong></p>
            <p style="margin: 5px 0; color: #1f2937;">Your ticket has been closed. Thank you for using our support service.</p>
          </div>
        ` : ''}

        <p>You can view the ticket details by logging into your partner portal.</p>
        <p style="margin-top: 30px;">Best regards,<br/>Partner Support Team</p>
      </div>
    `

    await fetch('/api/notifications/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: data.partner_email,
        subject: `Ticket Status Updated - ${data.ticket_number}`,
        html: emailBody,
      }),
    })
  } catch (error) {
    console.error('Failed to send status change email:', error)
  }
}

/**
 * Send email when ticket is escalated
 */
export async function sendTicketEscalatedEmail(data: TicketEmailData & { escalated_to: string }) {
  try {
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Ticket Escalated</h2>
        <p>Dear ${data.partner_name},</p>
        <p>Your support ticket has been escalated to our ${data.escalated_to} team for specialized assistance.</p>

        <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; border-left: 4px solid #dc2626; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Ticket Number:</strong> ${data.ticket_number}</p>
          <p style="margin: 5px 0;"><strong>Subject:</strong> ${data.subject}</p>
          <p style="margin: 5px 0;"><strong>Escalated To:</strong> ${data.escalated_to}</p>
          <p style="margin: 5px 0;"><strong>Priority:</strong> <span style="color: ${getPriorityColor(data.priority)};">${data.priority.toUpperCase()}</span></p>
        </div>

        <p>A senior team member will review your ticket and provide assistance shortly. We appreciate your patience.</p>
        <p style="margin-top: 30px;">Best regards,<br/>Partner Support Team</p>
      </div>
    `

    await fetch('/api/notifications/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: data.partner_email,
        subject: `Ticket Escalated - ${data.ticket_number}`,
        html: emailBody,
      }),
    })
  } catch (error) {
    console.error('Failed to send escalation email:', error)
  }
}

// Helper functions

function getPriorityColor(priority: string): string {
  switch (priority.toLowerCase()) {
    case 'urgent':
      return '#dc2626'
    case 'high':
      return '#ea580c'
    case 'medium':
      return '#ca8a04'
    case 'low':
      return '#2563eb'
    default:
      return '#6b7280'
  }
}

function formatCategory(category: string): string {
  const labels: Record<string, string> = {
    payout_commission: 'Payout & Commission',
    sales_support: 'Sales Support',
    technical_issue: 'Technical Issue',
    account_management: 'Account Management',
    training_resources: 'Training & Resources',
    compliance_legal: 'Compliance & Legal',
    customer_issues: 'Customer Issues',
    partnership_management: 'Partnership Management',
    general_inquiry: 'General Inquiry',
  }
  return labels[category] || category
}

function formatStatus(status: string): string {
  const labels: Record<string, string> = {
    new: 'New',
    assigned: 'Assigned',
    in_progress: 'In Progress',
    pending_partner: 'Pending Partner Response',
    pending_internal: 'Pending Internal Review',
    resolved: 'Resolved',
    closed: 'Closed',
    on_hold: 'On Hold',
    escalated: 'Escalated',
    reopened: 'Reopened',
  }
  return labels[status] || status
}

function getExpectedResponseTime(priority: string): string {
  switch (priority.toLowerCase()) {
    case 'urgent':
      return '<li>First Response: Within 1 hour</li><li>Resolution: Within 12 hours</li>'
    case 'high':
      return '<li>First Response: Within 2 hours</li><li>Resolution: Within 24 hours</li>'
    case 'medium':
      return '<li>First Response: Within 4 hours</li><li>Resolution: Within 48 hours</li>'
    case 'low':
      return '<li>First Response: Within 8 hours</li><li>Resolution: Within 72 hours</li>'
    default:
      return '<li>Response time varies based on ticket complexity</li>'
  }
}
