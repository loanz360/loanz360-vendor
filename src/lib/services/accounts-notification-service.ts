/**
 * Accounts Executive Notification Service
 * Pushes in-app notifications for ticket, task, and payout events
 */

import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

export interface NotificationPayload {
  userId: string
  title: string
  message: string
  type: 'ticket' | 'task' | 'payout' | 'schedule' | 'system'
  actionUrl?: string
  metadata?: Record<string, unknown>
}

export class AccountsNotificationService {
  /**
   * Send an in-app notification to a user
   */
  static async sendNotification(payload: NotificationPayload) {
    try {
      const supabase = await createClient()

      await supabase.from('in_app_notifications').insert({
        user_id: payload.userId,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        action_url: payload.actionUrl || null,
        metadata: payload.metadata || {},
        is_read: false,
        created_at: new Date().toISOString()
      })
    } catch (err) {
      apiLogger.error('Failed to send notification', err)
    }
  }

  /**
   * Send notification to multiple users
   */
  static async sendBulkNotification(userIds: string[], notification: Omit<NotificationPayload, 'userId'>) {
    const promises = userIds.map(userId =>
      this.sendNotification({ ...notification, userId })
    )
    await Promise.allSettled(promises)
  }

  /**
   * Notify when a ticket is assigned to the accounts department
   */
  static async notifyTicketAssigned(params: {
    ticketId: string
    ticketNumber: string
    subject: string
    assignedToUserIds: string[]
    priority: string
  }) {
    await this.sendBulkNotification(params.assignedToUserIds, {
      title: `New Ticket Assigned: ${params.ticketNumber}`,
      message: `${params.subject} (Priority: ${params.priority.toUpperCase()})`,
      type: 'ticket',
      actionUrl: `/employees/accounts-manager/tickets/${params.ticketId}`,
      metadata: {
        ticket_id: params.ticketId,
        ticket_number: params.ticketNumber,
        priority: params.priority
      }
    })
  }

  /**
   * Notify when a ticket status changes
   */
  static async notifyTicketStatusChange(params: {
    ticketId: string
    ticketNumber: string
    userId: string
    oldStatus: string
    newStatus: string
  }) {
    await this.sendNotification({
      userId: params.userId,
      title: `Ticket ${params.ticketNumber} Updated`,
      message: `Status changed from ${params.oldStatus.replace(/_/g, ' ')} to ${params.newStatus.replace(/_/g, ' ')}`,
      type: 'ticket',
      actionUrl: `/employees/accounts-manager/tickets/${params.ticketId}`,
      metadata: {
        ticket_id: params.ticketId,
        old_status: params.oldStatus,
        new_status: params.newStatus
      }
    })
  }

  /**
   * Notify when a new task is auto-created
   */
  static async notifyTaskCreated(params: {
    taskId: string
    title: string
    assignedTo: string
    dueDate?: string
    source?: string
  }) {
    await this.sendNotification({
      userId: params.assignedTo,
      title: 'New Task Assigned',
      message: `${params.title}${params.dueDate ? ` (Due: ${new Date(params.dueDate).toLocaleDateString('en-IN')})` : ''}`,
      type: 'task',
      actionUrl: '/employees/tasks',
      metadata: {
        task_id: params.taskId,
        source: params.source
      }
    })
  }

  /**
   * Notify when a task is overdue
   */
  static async notifyTaskOverdue(params: {
    taskId: string
    title: string
    assignedTo: string
    dueDate: string
  }) {
    await this.sendNotification({
      userId: params.assignedTo,
      title: 'Task Overdue',
      message: `"${params.title}" was due on ${new Date(params.dueDate).toLocaleDateString('en-IN')}`,
      type: 'task',
      actionUrl: '/employees/tasks',
      metadata: { task_id: params.taskId, overdue: true }
    })
  }

  /**
   * Notify when a schedule/meeting reminder is due
   */
  static async notifyScheduleReminder(params: {
    scheduleId: string
    title: string
    userId: string
    scheduledDate: string
    meetingType: string
  }) {
    await this.sendNotification({
      userId: params.userId,
      title: 'Upcoming Meeting',
      message: `${params.title} at ${new Date(params.scheduledDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
      type: 'schedule',
      actionUrl: '/employees/schedule',
      metadata: {
        schedule_id: params.scheduleId,
        meeting_type: params.meetingType
      }
    })
  }

  /**
   * Notify when a ticket is escalated
   */
  static async notifyTicketEscalated(params: {
    ticketId: string
    ticketNumber: string
    fromDepartment: string
    toDepartment: string
    toUserIds: string[]
  }) {
    await this.sendBulkNotification(params.toUserIds, {
      title: `Ticket Escalated: ${params.ticketNumber}`,
      message: `Escalated from ${params.fromDepartment.replace(/_/g, ' ')} to ${params.toDepartment.replace(/_/g, ' ')}`,
      type: 'ticket',
      actionUrl: `/employees/accounts-manager/tickets/${params.ticketId}`,
      metadata: {
        ticket_id: params.ticketId,
        from_department: params.fromDepartment,
        to_department: params.toDepartment,
        escalated: true
      }
    })
  }
}

export default AccountsNotificationService
