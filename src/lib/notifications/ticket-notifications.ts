/**
 * Partner Support Ticket Notification System
 * Handles all notifications for ticket lifecycle events
 */

import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/communication/email-service'
import { sendSMS } from '@/lib/communication/sms-service'

export interface NotificationPreferences {
  email_enabled: boolean
  sms_enabled: boolean
  whatsapp_enabled: boolean
  in_app_enabled: boolean
  notify_new_ticket: boolean
  notify_ticket_assigned: boolean
  notify_new_message: boolean
  notify_status_change: boolean
  notify_sla_warning: boolean
  notify_sla_breach: boolean
}

export interface TicketNotificationData {
  ticketId: string
  ticketNumber: string
  subject: string
  status: string
  priority: string
  category: string
  partnerName: string
  partnerEmail: string
  assignedToId?: string
  slaDeadline?: string
}

/**
 * Get user's notification preferences
 */
export async function getNotificationPreferences(
  userId: string
): Promise<NotificationPreferences | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('partner_ticket_notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('Error fetching notification preferences:', error)
    return null
  }

  return data as NotificationPreferences
}

/**
 * Create in-app notification
 */
export async function createInAppNotification(
  userId: string,
  title: string,
  message: string,
  ticketId: string,
  type: 'new_ticket' | 'assigned' | 'new_message' | 'status_change' | 'sla_warning' | 'sla_breach'
) {
  const supabase = await createClient()

  await supabase.from('notifications').insert({
    user_id: userId,
    title,
    message,
    type: 'ticket',
    reference_id: ticketId,
    reference_type: 'partner_support_ticket',
    metadata: { notification_type: type },
    is_read: false
  })
}

/**
 * Notify about new ticket creation
 */
export async function notifyNewTicket(ticketData: TicketNotificationData) {
  const supabase = await createClient()

  try {
    // Get assigned department
    const { data: ticket } = await supabase
      .from('partner_support_tickets')
      .select('routed_to_department')
      .eq('id', ticketData.ticketId)
      .maybeSingle()

    if (!ticket?.routed_to_department) return

    // Get employees in the department
    const { data: deptEmployees } = await supabase
      .from('department_employees')
      .select('employee_id, profiles!inner(email, full_name)')
      .eq('department', ticket.routed_to_department)
      .eq('is_active', true)

    if (!deptEmployees || deptEmployees.length === 0) return

    // Notify each employee
    for (const emp of deptEmployees) {
      const prefs = await getNotificationPreferences(emp.employee_id)

      if (!prefs || !prefs.notify_new_ticket) continue

      const employee = emp.profiles as unknown

      // In-app notification
      if (prefs.in_app_enabled) {
        await createInAppNotification(
          emp.employee_id,
          `New ${ticketData.priority.toUpperCase()} Ticket`,
          `Ticket #${ticketData.ticketNumber}: ${ticketData.subject}`,
          ticketData.ticketId,
          'new_ticket'
        )
      }

      // Email notification
      if (prefs.email_enabled && employee.email) {
        await sendEmail({
          to: employee.email,
          subject: `New Support Ticket: ${ticketData.ticketNumber}`,
          template: 'ticket_new',
          variables: {
            employee_name: employee.full_name,
            ticket_number: ticketData.ticketNumber,
            subject: ticketData.subject,
            priority: ticketData.priority,
            category: ticketData.category,
            partner_name: ticketData.partnerName,
            ticket_url: `${process.env.NEXT_PUBLIC_APP_URL}/employees/partner-support-executive/tickets/${ticketData.ticketId}`
          }
        })
      }

      // SMS notification for urgent tickets
      if (prefs.sms_enabled && ticketData.priority === 'urgent') {
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone')
          .eq('id', emp.employee_id)
          .maybeSingle()

        if (profile?.phone) {
          await sendSMS({
            to: profile.phone,
            template: 'ticket_urgent_alert',
            variables: {
              ticket_number: ticketData.ticketNumber,
              subject: ticketData.subject.substring(0, 50)
            }
          })
        }
      }
    }
  } catch (error) {
    console.error('Error sending new ticket notifications:', error)
  }
}

/**
 * Notify employee about ticket assignment
 */
export async function notifyTicketAssignment(
  ticketData: TicketNotificationData,
  assignedToId: string
) {
  const supabase = await createClient()

  try {
    const prefs = await getNotificationPreferences(assignedToId)
    if (!prefs || !prefs.notify_ticket_assigned) return

    const { data: employee } = await supabase
      .from('profiles')
      .select('email, full_name, phone')
      .eq('id', assignedToId)
      .maybeSingle()

    if (!employee) return

    // In-app notification
    if (prefs.in_app_enabled) {
      await createInAppNotification(
        assignedToId,
        'Ticket Assigned to You',
        `Ticket #${ticketData.ticketNumber}: ${ticketData.subject}`,
        ticketData.ticketId,
        'assigned'
      )
    }

    // Email notification
    if (prefs.email_enabled && employee.email) {
      await sendEmail({
        to: employee.email,
        subject: `Ticket Assigned: ${ticketData.ticketNumber}`,
        template: 'ticket_assigned',
        variables: {
          employee_name: employee.full_name,
          ticket_number: ticketData.ticketNumber,
          subject: ticketData.subject,
          priority: ticketData.priority,
          category: ticketData.category,
          partner_name: ticketData.partnerName,
          ticket_url: `${process.env.NEXT_PUBLIC_APP_URL}/employees/partner-support-executive/tickets/${ticketData.ticketId}`
        }
      })
    }

    // SMS for urgent tickets
    if (prefs.sms_enabled && ticketData.priority === 'urgent' && employee.phone) {
      await sendSMS({
        to: employee.phone,
        template: 'ticket_assigned',
        variables: {
          ticket_number: ticketData.ticketNumber,
          priority: ticketData.priority
        }
      })
    }
  } catch (error) {
    console.error('Error sending assignment notifications:', error)
  }
}

/**
 * Notify about new message on ticket
 */
export async function notifyNewMessage(
  ticketData: TicketNotificationData,
  messageFrom: 'partner' | 'employee',
  messageSenderId: string,
  messagePreview: string
) {
  const supabase = await createClient()

  try {
    // Determine who to notify
    let recipientId: string | null = null

    if (messageFrom === 'partner') {
      // Notify assigned employee
      const { data: ticket } = await supabase
        .from('partner_support_tickets')
        .select('assigned_to_partner_support_id, routed_to_employee_id')
        .eq('id', ticketData.ticketId)
        .maybeSingle()

      recipientId =
        ticket?.assigned_to_partner_support_id || ticket?.routed_to_employee_id || null
    } else {
      // Notify partner
      const { data: ticket } = await supabase
        .from('partner_support_tickets')
        .select('partner_id')
        .eq('id', ticketData.ticketId)
        .maybeSingle()

      recipientId = ticket?.partner_id || null
    }

    if (!recipientId) return

    const prefs = await getNotificationPreferences(recipientId)
    if (!prefs || !prefs.notify_new_message) return

    const { data: recipient } = await supabase
      .from('profiles')
      .select('email, full_name, phone')
      .eq('id', recipientId)
      .maybeSingle()

    if (!recipient) return

    const senderRole = messageFrom === 'partner' ? 'Partner' : 'Support Team'

    // In-app notification
    if (prefs.in_app_enabled) {
      await createInAppNotification(
        recipientId,
        `New Message on Ticket #${ticketData.ticketNumber}`,
        `${senderRole}: ${messagePreview.substring(0, 100)}`,
        ticketData.ticketId,
        'new_message'
      )
    }

    // Email notification
    if (prefs.email_enabled && recipient.email) {
      await sendEmail({
        to: recipient.email,
        subject: `New Message on Ticket #${ticketData.ticketNumber}`,
        template: 'ticket_new_message',
        variables: {
          recipient_name: recipient.full_name,
          ticket_number: ticketData.ticketNumber,
          subject: ticketData.subject,
          sender_role: senderRole,
          message_preview: messagePreview.substring(0, 200),
          ticket_url: messageFrom === 'partner'
              ? `${process.env.NEXT_PUBLIC_APP_URL}/employees/partner-support-executive/tickets/${ticketData.ticketId}`
              : `${process.env.NEXT_PUBLIC_APP_URL}/` // Partners don't have a dedicated ticket detail page yet
        }
      })
    }
  } catch (error) {
    console.error('Error sending new message notifications:', error)
  }
}

/**
 * Notify about status change
 */
export async function notifyStatusChange(
  ticketData: TicketNotificationData,
  oldStatus: string,
  newStatus: string
) {
  const supabase = await createClient()

  try {
    // Notify partner (status changes are always relevant to partner)
    const { data: ticket } = await supabase
      .from('partner_support_tickets')
      .select('partner_id')
      .eq('id', ticketData.ticketId)
      .maybeSingle()

    if (!ticket?.partner_id) return

    const prefs = await getNotificationPreferences(ticket.partner_id)
    if (!prefs || !prefs.notify_status_change) return

    const { data: partner } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', ticket.partner_id)
      .maybeSingle()

    if (!partner) return

    // In-app notification
    if (prefs.in_app_enabled) {
      await createInAppNotification(
        ticket.partner_id,
        'Ticket Status Updated',
        `Ticket #${ticketData.ticketNumber} status changed from ${oldStatus} to ${newStatus}`,
        ticketData.ticketId,
        'status_change'
      )
    }

    // Email notification
    if (prefs.email_enabled && partner.email) {
      await sendEmail({
        to: partner.email,
        subject: `Ticket Status Updated: ${ticketData.ticketNumber}`,
        template: 'ticket_status_change',
        variables: {
          partner_name: partner.full_name,
          ticket_number: ticketData.ticketNumber,
          subject: ticketData.subject,
          old_status: oldStatus,
          new_status: newStatus,
          ticket_url: `${process.env.NEXT_PUBLIC_APP_URL}/` // Partners don't have a dedicated ticket detail page yet
        }
      })
    }
  } catch (error) {
    console.error('Error sending status change notifications:', error)
  }
}

/**
 * Notify about SLA warning (80% of deadline reached)
 */
export async function notifySLAWarning(ticketData: TicketNotificationData) {
  const supabase = await createClient()

  try {
    const { data: ticket } = await supabase
      .from('partner_support_tickets')
      .select('assigned_to_partner_support_id, routed_to_employee_id, routed_to_department')
      .eq('id', ticketData.ticketId)
      .maybeSingle()

    if (!ticket) return

    // Notify assigned employee
    const assignedId =
      ticket.assigned_to_partner_support_id || ticket.routed_to_employee_id

    if (assignedId) {
      const prefs = await getNotificationPreferences(assignedId)
      if (prefs && prefs.notify_sla_warning) {
        const { data: employee } = await supabase
          .from('profiles')
          .select('email, full_name, phone')
          .eq('id', assignedId)
          .maybeSingle()

        if (employee) {
          // In-app notification
          if (prefs.in_app_enabled) {
            await createInAppNotification(
              assignedId,
              'SLA Warning',
              `Ticket #${ticketData.ticketNumber} approaching SLA deadline`,
              ticketData.ticketId,
              'sla_warning'
            )
          }

          // Email notification
          if (prefs.email_enabled && employee.email) {
            await sendEmail({
              to: employee.email,
              subject: `SLA Warning: Ticket ${ticketData.ticketNumber}`,
              template: 'ticket_sla_warning',
              variables: {
                employee_name: employee.full_name,
                ticket_number: ticketData.ticketNumber,
                subject: ticketData.subject,
                sla_deadline: ticketData.slaDeadline,
                ticket_url: `${process.env.NEXT_PUBLIC_APP_URL}/employees/partner-support-executive/tickets/${ticketData.ticketId}`
              }
            })
          }

          // SMS for urgent tickets
          if (prefs.sms_enabled && ticketData.priority === 'urgent' && employee.phone) {
            await sendSMS({
              to: employee.phone,
              template: 'ticket_sla_warning',
              variables: {
                ticket_number: ticketData.ticketNumber
              }
            })
          }
        }
      }
    }

    // Also notify department manager
    if (ticket.routed_to_department) {
      const { data: managers } = await supabase
        .from('department_employees')
        .select('employee_id, profiles!inner(email, full_name)')
        .eq('department', ticket.routed_to_department)
        .eq('role', 'manager')
        .eq('is_active', true)

      if (managers) {
        for (const manager of managers) {
          const prefs = await getNotificationPreferences(manager.employee_id)
          if (prefs && prefs.notify_sla_warning && prefs.in_app_enabled) {
            await createInAppNotification(
              manager.employee_id,
              'Team SLA Warning',
              `Ticket #${ticketData.ticketNumber} in your department approaching SLA deadline`,
              ticketData.ticketId,
              'sla_warning'
            )
          }
        }
      }
    }
  } catch (error) {
    console.error('Error sending SLA warning notifications:', error)
  }
}

/**
 * Notify about SLA breach
 */
export async function notifySLABreach(ticketData: TicketNotificationData) {
  const supabase = await createClient()

  try {
    const { data: ticket } = await supabase
      .from('partner_support_tickets')
      .select('assigned_to_partner_support_id, routed_to_employee_id, routed_to_department')
      .eq('id', ticketData.ticketId)
      .maybeSingle()

    if (!ticket) return

    // Notify assigned employee
    const assignedId =
      ticket.assigned_to_partner_support_id || ticket.routed_to_employee_id

    if (assignedId) {
      const prefs = await getNotificationPreferences(assignedId)
      if (prefs && prefs.notify_sla_breach) {
        const { data: employee } = await supabase
          .from('profiles')
          .select('email, full_name, phone')
          .eq('id', assignedId)
          .maybeSingle()

        if (employee) {
          // In-app notification
          if (prefs.in_app_enabled) {
            await createInAppNotification(
              assignedId,
              '🚨 SLA BREACH',
              `Ticket #${ticketData.ticketNumber} has breached SLA deadline!`,
              ticketData.ticketId,
              'sla_breach'
            )
          }

          // Email notification
          if (prefs.email_enabled && employee.email) {
            await sendEmail({
              to: employee.email,
              subject: `🚨 SLA BREACH: Ticket ${ticketData.ticketNumber}`,
              template: 'ticket_sla_breach',
              variables: {
                employee_name: employee.full_name,
                ticket_number: ticketData.ticketNumber,
                subject: ticketData.subject,
                sla_deadline: ticketData.slaDeadline,
                ticket_url: `${process.env.NEXT_PUBLIC_APP_URL}/employees/partner-support-executive/tickets/${ticketData.ticketId}`
              }
            })
          }

          // SMS notification (always for breach)
          if (prefs.sms_enabled && employee.phone) {
            await sendSMS({
              to: employee.phone,
              template: 'ticket_sla_breach',
              variables: {
                ticket_number: ticketData.ticketNumber
              }
            })
          }
        }
      }
    }

    // ALWAYS notify department managers about breach
    if (ticket.routed_to_department) {
      const { data: managers } = await supabase
        .from('department_employees')
        .select('employee_id, profiles!inner(email, full_name, phone)')
        .eq('department', ticket.routed_to_department)
        .eq('role', 'manager')
        .eq('is_active', true)

      if (managers) {
        for (const manager of managers) {
          const managerProfile = manager.profiles as unknown

          // In-app notification (always)
          await createInAppNotification(
            manager.employee_id,
            '🚨 Team SLA BREACH',
            `Ticket #${ticketData.ticketNumber} in your department has breached SLA!`,
            ticketData.ticketId,
            'sla_breach'
          )

          // Email notification (always)
          if (managerProfile.email) {
            await sendEmail({
              to: managerProfile.email,
              subject: `🚨 SLA BREACH Alert: Ticket ${ticketData.ticketNumber}`,
              template: 'ticket_sla_breach_manager',
              variables: {
                manager_name: managerProfile.full_name,
                ticket_number: ticketData.ticketNumber,
                subject: ticketData.subject,
                priority: ticketData.priority,
                assigned_to: assignedId ? 'Assigned' : 'Unassigned',
                ticket_url: `${process.env.NEXT_PUBLIC_APP_URL}/employees/partner-support-manager/tickets/${ticketData.ticketId}`
              }
            })
          }
        }
      }
    }
  } catch (error) {
    console.error('Error sending SLA breach notifications:', error)
  }
}
