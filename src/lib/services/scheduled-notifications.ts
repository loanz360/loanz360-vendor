import { createClient } from '@/lib/supabase/server'

export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'WHATSAPP'
export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
export type RecurrenceType = 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'

export interface ScheduledNotification {
  id?: string
  title: string
  body: string
  channel: NotificationChannel
  priority: NotificationPriority
  scheduled_at: string
  recurrence: RecurrenceType
  target_type: 'ALL' | 'DEPARTMENT' | 'ROLE' | 'INDIVIDUAL' | 'CUSTOM'
  target_value: string // department name, role, user_id, or comma-separated ids
  metadata?: Record<string, unknown>
  created_by: string
  is_active: boolean
}

// Pre-built notification templates for common HR scenarios
export const NOTIFICATION_TEMPLATES = {
  BIRTHDAY: {
    title: 'Happy Birthday! 🎂',
    body: 'Wishing {employee_name} a very Happy Birthday! Have a wonderful day.',
    channel: 'IN_APP' as NotificationChannel,
    priority: 'NORMAL' as NotificationPriority,
    recurrence: 'YEARLY' as RecurrenceType,
  },
  WORK_ANNIVERSARY: {
    title: 'Work Anniversary! 🎉',
    body: 'Congratulations {employee_name} on completing {years} years with us!',
    channel: 'IN_APP' as NotificationChannel,
    priority: 'NORMAL' as NotificationPriority,
    recurrence: 'YEARLY' as RecurrenceType,
  },
  PROBATION_ENDING: {
    title: 'Probation Period Ending',
    body: '{employee_name}\'s probation period ends on {end_date}. Please schedule a review.',
    channel: 'IN_APP' as NotificationChannel,
    priority: 'HIGH' as NotificationPriority,
    recurrence: 'ONCE' as RecurrenceType,
  },
  REVIEW_REMINDER: {
    title: 'Performance Review Due',
    body: 'Performance review for {employee_name} is due by {due_date}.',
    channel: 'IN_APP' as NotificationChannel,
    priority: 'HIGH' as NotificationPriority,
    recurrence: 'ONCE' as RecurrenceType,
  },
  DOCUMENT_EXPIRY: {
    title: 'Document Expiring Soon',
    body: '{document_type} for {employee_name} expires on {expiry_date}. Please arrange renewal.',
    channel: 'IN_APP' as NotificationChannel,
    priority: 'URGENT' as NotificationPriority,
    recurrence: 'ONCE' as RecurrenceType,
  },
  PAYROLL_REMINDER: {
    title: 'Payroll Processing Reminder',
    body: 'Monthly payroll for {month} needs to be processed by {deadline}.',
    channel: 'IN_APP' as NotificationChannel,
    priority: 'HIGH' as NotificationPriority,
    recurrence: 'MONTHLY' as RecurrenceType,
  },
}

export class ScheduledNotificationService {
  /**
   * Schedule a new notification
   */
  static async schedule(notification: Omit<ScheduledNotification, 'id'>): Promise<string> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('scheduled_notifications')
      .insert({
        ...notification,
        is_active: true,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle()

    if (error) throw new Error(`Failed to schedule notification: ${error.message}`)
    return data.id
  }

  /**
   * Schedule from a template with variable substitution
   */
  static async scheduleFromTemplate(
    templateKey: keyof typeof NOTIFICATION_TEMPLATES,
    variables: Record<string, string>,
    overrides: Partial<ScheduledNotification> & { scheduled_at: string; target_type: ScheduledNotification['target_type']; target_value: string; created_by: string }
  ): Promise<string> {
    const template = NOTIFICATION_TEMPLATES[templateKey]
    if (!template) throw new Error(`Unknown template: ${templateKey}`)

    let title = template.title
    let body = template.body
    for (const [key, value] of Object.entries(variables)) {
      title = title.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
      body = body.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
    }

    return this.schedule({
      ...template,
      title,
      body,
      ...overrides,
      is_active: true,
    })
  }

  /**
   * Get all pending scheduled notifications that need to be sent
   */
  static async getPendingNotifications(): Promise<ScheduledNotification[]> {
    const supabase = await createClient()
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('scheduled_notifications')
      .select('*')
      .eq('is_active', true)
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })

    if (error) {
      console.error('[ScheduledNotifications] Failed to fetch pending:', error)
      return []
    }
    return data || []
  }

  /**
   * Mark a notification as sent and handle recurrence
   */
  static async markSent(id: string): Promise<void> {
    const supabase = await createClient()
    const { data: notification } = await supabase
      .from('scheduled_notifications')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (!notification) return

    if (notification.recurrence === 'ONCE') {
      await supabase.from('scheduled_notifications').update({ is_active: false, last_sent_at: new Date().toISOString() }).eq('id', id)
      return
    }

    // Calculate next send date based on recurrence
    const nextDate = new Date(notification.scheduled_at)
    switch (notification.recurrence) {
      case 'DAILY': nextDate.setDate(nextDate.getDate() + 1); break
      case 'WEEKLY': nextDate.setDate(nextDate.getDate() + 7); break
      case 'MONTHLY': nextDate.setMonth(nextDate.getMonth() + 1); break
      case 'YEARLY': nextDate.setFullYear(nextDate.getFullYear() + 1); break
    }

    await supabase.from('scheduled_notifications').update({
      scheduled_at: nextDate.toISOString(),
      last_sent_at: new Date().toISOString(),
    }).eq('id', id)
  }

  /**
   * Cancel a scheduled notification
   */
  static async cancel(id: string): Promise<void> {
    const supabase = await createClient()
    await supabase.from('scheduled_notifications').update({ is_active: false }).eq('id', id)
  }

  /**
   * List all scheduled notifications for management
   */
  static async list(params?: { active_only?: boolean; limit?: number }): Promise<ScheduledNotification[]> {
    const supabase = await createClient()
    let query = supabase.from('scheduled_notifications').select('*').order('scheduled_at', { ascending: true })
    if (params?.active_only) query = query.eq('is_active', true)
    if (params?.limit) query = query.limit(params.limit)
    const { data } = await query
    return data || []
  }
}
