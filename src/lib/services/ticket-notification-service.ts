/**
 * Enterprise Ticket Notification Service
 * Version: 1.0 - Fortune 500 Standard
 *
 * Unified notification service for all ticket types.
 * Fixes Bug #10: No Email Templates for Partners
 */

import { createClient } from '@/lib/supabase/server'
import { SupabaseClient } from '@supabase/supabase-js'
import {
  TicketSource,
  TicketStatus,
  TicketPriority,
  ActivityActionType,
  NotificationChannel
} from '@/types/support-tickets'

// ============================================================
// TYPES
// ============================================================

export interface NotificationRecipient {
  id: string
  email: string
  name: string
  phone?: string
  role: 'requester' | 'assignee' | 'department' | 'escalation' | 'admin'
  preferences?: NotificationPreferences
}

export interface NotificationPreferences {
  email: boolean
  sms: boolean
  push: boolean
  in_app: boolean
}

export interface TicketNotificationPayload {
  ticketId: string
  ticketNumber: string
  ticketSource: TicketSource | string
  subject: string
  description?: string
  status: string
  priority: string
  category?: string
  requesterName: string
  requesterEmail: string
  assigneeName?: string
  assigneeEmail?: string
  department?: string
  slaDeadline?: string
  messageContent?: string
  oldValue?: string
  newValue?: string
  actionBy?: string
  customData?: Record<string, unknown>
}

export interface NotificationResult {
  success: boolean
  channels: {
    email?: { sent: boolean; error?: string }
    sms?: { sent: boolean; error?: string }
    push?: { sent: boolean; error?: string }
    in_app?: { sent: boolean; error?: string }
  }
  errors?: string[]
}

// ============================================================
// EMAIL TEMPLATES
// ============================================================

const EMAIL_TEMPLATES = {
  ticket_created: {
    subject: 'Ticket #{ticketNumber} Created - {subject}',
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f97316, #ea580c); padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">New Support Ticket</h1>
        </div>
        <div style="background: #1a1a1a; color: #fff; padding: 30px; border-radius: 0 0 8px 8px;">
          <p style="color: #9ca3af; margin-bottom: 20px;">A new support ticket has been created.</p>

          <div style="background: #262626; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="color: #9ca3af; padding: 8px 0; width: 120px;">Ticket #:</td>
                <td style="color: #f97316; font-weight: bold;">{ticketNumber}</td>
              </tr>
              <tr>
                <td style="color: #9ca3af; padding: 8px 0;">Subject:</td>
                <td style="color: #fff;">{subject}</td>
              </tr>
              <tr>
                <td style="color: #9ca3af; padding: 8px 0;">Priority:</td>
                <td><span style="background: {priorityColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px;">{priority}</span></td>
              </tr>
              <tr>
                <td style="color: #9ca3af; padding: 8px 0;">Category:</td>
                <td style="color: #fff;">{category}</td>
              </tr>
              <tr>
                <td style="color: #9ca3af; padding: 8px 0;">Created By:</td>
                <td style="color: #fff;">{requesterName}</td>
              </tr>
            </table>
          </div>

          <div style="background: #262626; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #f97316; margin: 0 0 10px 0; font-size: 14px;">DESCRIPTION</h3>
            <p style="color: #d1d5db; margin: 0; line-height: 1.6;">{description}</p>
          </div>

          <a href="{ticketUrl}" style="display: inline-block; background: #f97316; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Ticket</a>

          <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
            This is an automated notification from Loanz360 Support System.
          </p>
        </div>
      </div>
    `
  },

  ticket_assigned: {
    subject: 'Ticket #{ticketNumber} Assigned to You',
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #3b82f6, #2563eb); padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Ticket Assigned</h1>
        </div>
        <div style="background: #1a1a1a; color: #fff; padding: 30px; border-radius: 0 0 8px 8px;">
          <p style="color: #9ca3af; margin-bottom: 20px;">A support ticket has been assigned to you.</p>

          <div style="background: #262626; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="color: #9ca3af; padding: 8px 0; width: 120px;">Ticket #:</td>
                <td style="color: #3b82f6; font-weight: bold;">{ticketNumber}</td>
              </tr>
              <tr>
                <td style="color: #9ca3af; padding: 8px 0;">Subject:</td>
                <td style="color: #fff;">{subject}</td>
              </tr>
              <tr>
                <td style="color: #9ca3af; padding: 8px 0;">Priority:</td>
                <td><span style="background: {priorityColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px;">{priority}</span></td>
              </tr>
              <tr>
                <td style="color: #9ca3af; padding: 8px 0;">From:</td>
                <td style="color: #fff;">{requesterName}</td>
              </tr>
              <tr>
                <td style="color: #9ca3af; padding: 8px 0;">SLA Deadline:</td>
                <td style="color: #fbbf24;">{slaDeadline}</td>
              </tr>
            </table>
          </div>

          <a href="{ticketUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View & Respond</a>
        </div>
      </div>
    `
  },

  ticket_updated: {
    subject: 'Ticket #{ticketNumber} Updated - {updateType}',
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #8b5cf6, #7c3aed); padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Ticket Updated</h1>
        </div>
        <div style="background: #1a1a1a; color: #fff; padding: 30px; border-radius: 0 0 8px 8px;">
          <p style="color: #9ca3af; margin-bottom: 20px;">Your support ticket has been updated.</p>

          <div style="background: #262626; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="color: #9ca3af; padding: 8px 0; width: 120px;">Ticket #:</td>
                <td style="color: #8b5cf6; font-weight: bold;">{ticketNumber}</td>
              </tr>
              <tr>
                <td style="color: #9ca3af; padding: 8px 0;">Subject:</td>
                <td style="color: #fff;">{subject}</td>
              </tr>
              <tr>
                <td style="color: #9ca3af; padding: 8px 0;">Updated By:</td>
                <td style="color: #fff;">{actionBy}</td>
              </tr>
              <tr>
                <td style="color: #9ca3af; padding: 8px 0;">Change:</td>
                <td style="color: #fff;">{updateType}: <span style="color: #ef4444; text-decoration: line-through;">{oldValue}</span> → <span style="color: #22c55e;">{newValue}</span></td>
              </tr>
            </table>
          </div>

          <a href="{ticketUrl}" style="display: inline-block; background: #8b5cf6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Ticket</a>
        </div>
      </div>
    `
  },

  new_message: {
    subject: 'New Reply on Ticket #{ticketNumber}',
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">New Message</h1>
        </div>
        <div style="background: #1a1a1a; color: #fff; padding: 30px; border-radius: 0 0 8px 8px;">
          <p style="color: #9ca3af; margin-bottom: 20px;">You have received a new reply on your support ticket.</p>

          <div style="background: #262626; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <p style="color: #9ca3af; margin: 0 0 5px 0; font-size: 12px;">TICKET #{ticketNumber}</p>
            <p style="color: #fff; margin: 0; font-weight: bold;">{subject}</p>
          </div>

          <div style="background: #262626; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <p style="color: #10b981; margin: 0 0 10px 0; font-weight: bold;">{actionBy} replied:</p>
            <p style="color: #d1d5db; margin: 0; line-height: 1.6;">{messageContent}</p>
          </div>

          <a href="{ticketUrl}" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View & Reply</a>
        </div>
      </div>
    `
  },

  ticket_resolved: {
    subject: 'Ticket #{ticketNumber} Resolved',
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #22c55e, #16a34a); padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Ticket Resolved</h1>
        </div>
        <div style="background: #1a1a1a; color: #fff; padding: 30px; border-radius: 0 0 8px 8px;">
          <p style="color: #9ca3af; margin-bottom: 20px;">Your support ticket has been marked as resolved.</p>

          <div style="background: #262626; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="color: #9ca3af; padding: 8px 0; width: 120px;">Ticket #:</td>
                <td style="color: #22c55e; font-weight: bold;">{ticketNumber}</td>
              </tr>
              <tr>
                <td style="color: #9ca3af; padding: 8px 0;">Subject:</td>
                <td style="color: #fff;">{subject}</td>
              </tr>
              <tr>
                <td style="color: #9ca3af; padding: 8px 0;">Resolved By:</td>
                <td style="color: #fff;">{assigneeName}</td>
              </tr>
            </table>
          </div>

          <p style="color: #9ca3af; margin-bottom: 20px;">If you're satisfied with the resolution, no further action is needed. If you need additional assistance, you can reopen this ticket.</p>

          <a href="{ticketUrl}" style="display: inline-block; background: #22c55e; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Resolution</a>
        </div>
      </div>
    `
  },

  sla_warning: {
    subject: '⚠️ SLA Warning - Ticket #{ticketNumber}',
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ SLA At Risk</h1>
        </div>
        <div style="background: #1a1a1a; color: #fff; padding: 30px; border-radius: 0 0 8px 8px;">
          <p style="color: #fbbf24; margin-bottom: 20px; font-weight: bold;">This ticket is at risk of breaching its SLA deadline.</p>

          <div style="background: #262626; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="color: #9ca3af; padding: 8px 0; width: 120px;">Ticket #:</td>
                <td style="color: #f59e0b; font-weight: bold;">{ticketNumber}</td>
              </tr>
              <tr>
                <td style="color: #9ca3af; padding: 8px 0;">Subject:</td>
                <td style="color: #fff;">{subject}</td>
              </tr>
              <tr>
                <td style="color: #9ca3af; padding: 8px 0;">Priority:</td>
                <td><span style="background: {priorityColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px;">{priority}</span></td>
              </tr>
              <tr>
                <td style="color: #9ca3af; padding: 8px 0;">SLA Deadline:</td>
                <td style="color: #ef4444; font-weight: bold;">{slaDeadline}</td>
              </tr>
            </table>
          </div>

          <a href="{ticketUrl}" style="display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Take Action Now</a>
        </div>
      </div>
    `
  },

  sla_breached: {
    subject: '🚨 SLA BREACHED - Ticket #{ticketNumber}',
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ef4444, #dc2626); padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🚨 SLA BREACHED</h1>
        </div>
        <div style="background: #1a1a1a; color: #fff; padding: 30px; border-radius: 0 0 8px 8px;">
          <p style="color: #ef4444; margin-bottom: 20px; font-weight: bold;">This ticket has breached its SLA deadline and requires immediate attention.</p>

          <div style="background: #262626; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="color: #9ca3af; padding: 8px 0; width: 120px;">Ticket #:</td>
                <td style="color: #ef4444; font-weight: bold;">{ticketNumber}</td>
              </tr>
              <tr>
                <td style="color: #9ca3af; padding: 8px 0;">Subject:</td>
                <td style="color: #fff;">{subject}</td>
              </tr>
              <tr>
                <td style="color: #9ca3af; padding: 8px 0;">Priority:</td>
                <td><span style="background: {priorityColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px;">{priority}</span></td>
              </tr>
              <tr>
                <td style="color: #9ca3af; padding: 8px 0;">Deadline Was:</td>
                <td style="color: #ef4444; text-decoration: line-through;">{slaDeadline}</td>
              </tr>
              <tr>
                <td style="color: #9ca3af; padding: 8px 0;">Assigned To:</td>
                <td style="color: #fff;">{assigneeName}</td>
              </tr>
            </table>
          </div>

          <a href="{ticketUrl}" style="display: inline-block; background: #ef4444; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Resolve Immediately</a>
        </div>
      </div>
    `
  }
}

// ============================================================
// PRIORITY COLORS
// ============================================================

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e'
}

// ============================================================
// NOTIFICATION SERVICE CLASS
// ============================================================

export class TicketNotificationService {
  private supabase: SupabaseClient
  private baseUrl: string

  constructor(supabaseClient: SupabaseClient, baseUrl?: string) {
    this.supabase = supabaseClient
    this.baseUrl = baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://app.loanz360.com'
  }

  /**
   * Send notification for ticket creation
   */
  async notifyTicketCreated(payload: TicketNotificationPayload): Promise<NotificationResult> {
    const recipients = await this.getRecipientsForEvent('created', payload)
    return this.sendNotifications('ticket_created', payload, recipients)
  }

  /**
   * Send notification for ticket assignment
   */
  async notifyTicketAssigned(payload: TicketNotificationPayload): Promise<NotificationResult> {
    const recipients = await this.getRecipientsForEvent('assigned', payload)
    return this.sendNotifications('ticket_assigned', payload, recipients)
  }

  /**
   * Send notification for ticket update
   */
  async notifyTicketUpdated(
    payload: TicketNotificationPayload,
    updateType: string
  ): Promise<NotificationResult> {
    const recipients = await this.getRecipientsForEvent('updated', payload)
    return this.sendNotifications('ticket_updated', { ...payload, customData: { updateType } }, recipients)
  }

  /**
   * Send notification for new message
   */
  async notifyNewMessage(payload: TicketNotificationPayload): Promise<NotificationResult> {
    const recipients = await this.getRecipientsForEvent('message', payload)
    return this.sendNotifications('new_message', payload, recipients)
  }

  /**
   * Send notification for ticket resolution
   */
  async notifyTicketResolved(payload: TicketNotificationPayload): Promise<NotificationResult> {
    const recipients = await this.getRecipientsForEvent('resolved', payload)
    return this.sendNotifications('ticket_resolved', payload, recipients)
  }

  /**
   * Send SLA warning notification
   */
  async notifySLAWarning(payload: TicketNotificationPayload): Promise<NotificationResult> {
    const recipients = await this.getRecipientsForEvent('sla_warning', payload)
    return this.sendNotifications('sla_warning', payload, recipients)
  }

  /**
   * Send SLA breach notification
   */
  async notifySLABreach(payload: TicketNotificationPayload): Promise<NotificationResult> {
    const recipients = await this.getRecipientsForEvent('sla_breached', payload)
    return this.sendNotifications('sla_breached', payload, recipients)
  }

  /**
   * Get recipients for a specific event type
   */
  private async getRecipientsForEvent(
    eventType: string,
    payload: TicketNotificationPayload
  ): Promise<NotificationRecipient[]> {
    const recipients: NotificationRecipient[] = []

    // Always notify the requester (except for assignment notifications to requester)
    if (eventType !== 'assigned' || payload.requesterEmail !== payload.assigneeEmail) {
      recipients.push({
        id: 'requester',
        email: payload.requesterEmail,
        name: payload.requesterName,
        role: 'requester'
      })
    }

    // Notify assignee for relevant events
    if (payload.assigneeEmail && ['assigned', 'message', 'sla_warning', 'sla_breached'].includes(eventType)) {
      recipients.push({
        id: 'assignee',
        email: payload.assigneeEmail,
        name: payload.assigneeName || 'Support Agent',
        role: 'assignee'
      })
    }

    // Notify department for SLA breaches and escalations
    if (['sla_breached', 'escalated'].includes(eventType) && payload.department) {
      const deptRecipients = await this.getDepartmentRecipients(payload.department)
      recipients.push(...deptRecipients)
    }

    // For SLA breaches, also notify admins
    if (eventType === 'sla_breached') {
      const adminRecipients = await this.getAdminRecipients()
      recipients.push(...adminRecipients)
    }

    return recipients
  }

  /**
   * Get department manager/lead recipients
   */
  private async getDepartmentRecipients(department: string): Promise<NotificationRecipient[]> {
    const { data: employees } = await this.supabase
      .from('employees')
      .select('id, email, full_name')
      .eq('department', department)
      .in('designation', ['manager', 'lead', 'head'])
      .eq('is_active', true)
      .limit(5)

    return (employees || []).map(emp => ({
      id: emp.id,
      email: emp.email,
      name: emp.full_name,
      role: 'department' as const
    }))
  }

  /**
   * Get admin recipients
   */
  private async getAdminRecipients(): Promise<NotificationRecipient[]> {
    const { data: admins } = await this.supabase
      .from('super_admins')
      .select('id, email, full_name')
      .eq('is_active', true)
      .limit(3)

    return (admins || []).map(admin => ({
      id: admin.id,
      email: admin.email,
      name: admin.full_name,
      role: 'admin' as const
    }))
  }

  /**
   * Send notifications to all recipients
   */
  private async sendNotifications(
    templateKey: string,
    payload: TicketNotificationPayload,
    recipients: NotificationRecipient[]
  ): Promise<NotificationResult> {
    const result: NotificationResult = {
      success: true,
      channels: {},
      errors: []
    }

    const template = EMAIL_TEMPLATES[templateKey as keyof typeof EMAIL_TEMPLATES]
    if (!template) {
      result.success = false
      result.errors?.push(`Template not found: ${templateKey}`)
      return result
    }

    // Build ticket URL
    const ticketUrl = this.buildTicketUrl(payload)

    // Process template
    const processedSubject = this.processTemplate(template.subject, payload, ticketUrl)
    const processedBody = this.processTemplate(template.body, payload, ticketUrl)

    // Send to each recipient
    for (const recipient of recipients) {
      try {
        // Send email
        await this.sendEmail(recipient.email, processedSubject, processedBody)
        result.channels.email = { sent: true }

        // Create in-app notification
        await this.createInAppNotification(recipient.id, payload, templateKey)
        result.channels.in_app = { sent: true }
      } catch (error) {
        result.errors?.push(`Failed to notify ${recipient.email}: ${(error as Error).message}`)
      }
    }

    result.success = (result.errors?.length || 0) === 0

    return result
  }

  /**
   * Process template with variables
   */
  private processTemplate(
    template: string,
    payload: TicketNotificationPayload,
    ticketUrl: string
  ): string {
    const priorityColor = PRIORITY_COLORS[payload.priority] || PRIORITY_COLORS.medium

    return template
      .replace(/{ticketNumber}/g, payload.ticketNumber)
      .replace(/{subject}/g, payload.subject)
      .replace(/{description}/g, payload.description || 'No description provided')
      .replace(/{priority}/g, payload.priority.toUpperCase())
      .replace(/{priorityColor}/g, priorityColor)
      .replace(/{category}/g, payload.category || 'General')
      .replace(/{status}/g, payload.status)
      .replace(/{requesterName}/g, payload.requesterName)
      .replace(/{requesterEmail}/g, payload.requesterEmail)
      .replace(/{assigneeName}/g, payload.assigneeName || 'Unassigned')
      .replace(/{assigneeEmail}/g, payload.assigneeEmail || '')
      .replace(/{department}/g, payload.department || '')
      .replace(/{slaDeadline}/g, payload.slaDeadline ? new Date(payload.slaDeadline).toLocaleString() : 'N/A')
      .replace(/{messageContent}/g, payload.messageContent || '')
      .replace(/{actionBy}/g, payload.actionBy || 'System')
      .replace(/{oldValue}/g, payload.oldValue || '')
      .replace(/{newValue}/g, payload.newValue || '')
      .replace(/{updateType}/g, payload.customData?.updateType || 'Status')
      .replace(/{ticketUrl}/g, ticketUrl)
  }

  /**
   * Build ticket URL based on source
   */
  private buildTicketUrl(payload: TicketNotificationPayload): string {
    let path = ''
    switch (payload.ticketSource) {
      case TicketSource.EMPLOYEE:
      case 'EMPLOYEE':
        path = `/employees/support/${payload.ticketId}`
        break
      case TicketSource.CUSTOMER:
      case 'CUSTOMER':
        path = `/customers/support/${payload.ticketId}`
        break
      case TicketSource.PARTNER:
      case 'PARTNER':
        path = `/partners/support-tickets/${payload.ticketId}`
        break
      default:
        path = `/superadmin/support-tickets/${payload.ticketSource?.toLowerCase()}/${payload.ticketId}`
    }
    return `${this.baseUrl}${path}`
  }

  /**
   * Send email via Supabase Edge Function or external service
   */
  private async sendEmail(to: string, subject: string, body: string): Promise<void> {
    // Try Supabase Edge Function first
    try {
      const { error } = await this.supabase.functions.invoke('send-email', {
        body: { to, subject, html: body }
      })
      if (error) throw error
    } catch {
      // Fall back to storing in email queue for later processing
      await this.supabase.from('email_queue').insert({
        to_email: to,
        subject,
        body,
        status: 'pending',
        created_at: new Date().toISOString()
      })
    }
  }

  /**
   * Create in-app notification
   */
  private async createInAppNotification(
    userId: string,
    payload: TicketNotificationPayload,
    eventType: string
  ): Promise<void> {
    await this.supabase.from('notifications').insert({
      user_id: userId,
      type: 'support_ticket',
      title: `Ticket #${payload.ticketNumber}`,
      message: this.getInAppMessage(eventType, payload),
      link: this.buildTicketUrl(payload),
      is_read: false,
      metadata: {
        ticket_id: payload.ticketId,
        ticket_number: payload.ticketNumber,
        ticket_source: payload.ticketSource,
        event_type: eventType
      },
      created_at: new Date().toISOString()
    })
  }

  /**
   * Get in-app notification message
   */
  private getInAppMessage(eventType: string, payload: TicketNotificationPayload): string {
    switch (eventType) {
      case 'ticket_created':
        return `New ticket created: ${payload.subject}`
      case 'ticket_assigned':
        return `Ticket assigned to you: ${payload.subject}`
      case 'ticket_updated':
        return `Ticket updated: ${payload.subject}`
      case 'new_message':
        return `New reply from ${payload.actionBy}`
      case 'ticket_resolved':
        return `Ticket resolved: ${payload.subject}`
      case 'sla_warning':
        return `SLA at risk for: ${payload.subject}`
      case 'sla_breached':
        return `SLA BREACHED: ${payload.subject}`
      default:
        return `Ticket update: ${payload.subject}`
    }
  }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Create an instance of TicketNotificationService
 */
export async function getNotificationService(): Promise<TicketNotificationService> {
  const supabase = await createClient()
  return new TicketNotificationService(supabase)
}

/**
 * Quick notification helper
 */
export async function notifyTicketEvent(
  eventType: 'created' | 'assigned' | 'updated' | 'message' | 'resolved' | 'sla_warning' | 'sla_breached',
  payload: TicketNotificationPayload,
  updateType?: string
): Promise<NotificationResult> {
  const service = await getNotificationService()

  switch (eventType) {
    case 'created':
      return service.notifyTicketCreated(payload)
    case 'assigned':
      return service.notifyTicketAssigned(payload)
    case 'updated':
      return service.notifyTicketUpdated(payload, updateType || 'Status')
    case 'message':
      return service.notifyNewMessage(payload)
    case 'resolved':
      return service.notifyTicketResolved(payload)
    case 'sla_warning':
      return service.notifySLAWarning(payload)
    case 'sla_breached':
      return service.notifySLABreach(payload)
    default:
      return { success: false, channels: {}, errors: ['Unknown event type'] }
  }
}
