/**
 * Real-time Engine - Enterprise-grade Real-time Updates System
 *
 * Features:
 * - Server-Sent Events (SSE) for push notifications
 * - Ticket update broadcasting
 * - Assignment notifications
 * - SLA alerts
 * - Escalation notifications
 * - Typing indicators
 * - Online presence
 */

import { createClient } from '@/lib/supabase/server'

// Event Types
export type EventType =
  | 'ticket_created'
  | 'ticket_updated'
  | 'ticket_assigned'
  | 'ticket_escalated'
  | 'ticket_resolved'
  | 'ticket_closed'
  | 'message_received'
  | 'sla_warning'
  | 'sla_breach'
  | 'agent_status_changed'
  | 'typing_indicator'
  | 'presence_update'

export interface RealtimeEvent {
  id: string
  type: EventType
  ticket_id?: string
  ticket_source?: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER'
  data: Record<string, any>
  target_user_ids?: string[]  // Specific users to notify
  target_roles?: string[]     // Roles to notify
  broadcast?: boolean         // Send to all connected clients
  created_at: string
}

export interface NotificationPayload {
  id: string
  type: EventType
  title: string
  message: string
  ticket_id?: string
  ticket_source?: string
  ticket_number?: string
  priority?: 'urgent' | 'high' | 'medium' | 'low' | 'info'
  action_url?: string
  data?: Record<string, any>
  created_at: string
}

// Event Handlers
const eventHandlers: Map<EventType, ((event: RealtimeEvent) => Promise<NotificationPayload | null>)[]> = new Map()

/**
 * Register an event handler
 */
export function onEvent(type: EventType, handler: (event: RealtimeEvent) => Promise<NotificationPayload | null>) {
  const handlers = eventHandlers.get(type) || []
  handlers.push(handler)
  eventHandlers.set(type, handlers)
}

/**
 * Emit a real-time event
 */
export async function emitEvent(event: Omit<RealtimeEvent, 'id' | 'created_at'>): Promise<void> {
  const supabase = await createClient()

  const fullEvent: RealtimeEvent = {
    ...event,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString()
  }

  // Store in database for persistence
  await supabase.from('realtime_events').insert({
    id: fullEvent.id,
    type: fullEvent.type,
    ticket_id: fullEvent.ticket_id,
    ticket_source: fullEvent.ticket_source,
    data: fullEvent.data,
    target_user_ids: fullEvent.target_user_ids,
    target_roles: fullEvent.target_roles,
    broadcast: fullEvent.broadcast,
    created_at: fullEvent.created_at
  })

  // Process handlers
  const handlers = eventHandlers.get(event.type) || []
  for (const handler of handlers) {
    try {
      const notification = await handler(fullEvent)
      if (notification) {
        await createNotifications(notification, fullEvent)
      }
    } catch (error) {
      console.error('Error in event handler:', error)
    }
  }
}

/**
 * Create notifications for target users
 */
async function createNotifications(
  payload: NotificationPayload,
  event: RealtimeEvent
): Promise<void> {
  const supabase = await createClient()

  const targetUserIds: string[] = []

  // Add specific users
  if (event.target_user_ids) {
    targetUserIds.push(...event.target_user_ids)
  }

  // Add users by role
  if (event.target_roles && event.target_roles.length > 0) {
    const { data: users } = await supabase
      .from('employees')
      .select('id')
      .in('role', event.target_roles)
      .eq('status', 'active')

    if (users) {
      targetUserIds.push(...users.map(u => u.id))
    }
  }

  // If broadcast, get all active users
  if (event.broadcast) {
    const { data: users } = await supabase
      .from('employees')
      .select('id')
      .eq('status', 'active')

    if (users) {
      targetUserIds.push(...users.map(u => u.id))
    }
  }

  // Deduplicate
  const uniqueUserIds = [...new Set(targetUserIds)]

  // Create notifications
  for (const userId of uniqueUserIds) {
    await supabase.from('notifications').insert({
      user_id: userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      data: {
        ticket_id: payload.ticket_id,
        ticket_source: payload.ticket_source,
        ticket_number: payload.ticket_number,
        priority: payload.priority,
        action_url: payload.action_url,
        ...payload.data
      },
      read: false
    })
  }
}

/**
 * Get pending notifications for a user
 */
export async function getUserNotifications(
  userId: string,
  limit: number = 50,
  unreadOnly: boolean = false
): Promise<NotificationPayload[]> {
  const supabase = await createClient()

  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (unreadOnly) {
    query = query.eq('read', false)
  }

  const { data: notifications } = await query

  return (notifications || []).map(n => ({
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    ticket_id: n.data?.ticket_id,
    ticket_source: n.data?.ticket_source,
    ticket_number: n.data?.ticket_number,
    priority: n.data?.priority,
    action_url: n.data?.action_url,
    data: n.data,
    created_at: n.created_at
  }))
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(notificationId: string): Promise<boolean> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('notifications')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('id', notificationId)

  return !error
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsRead(userId: string): Promise<boolean> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('notifications')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('read', false)

  return !error
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = await createClient()

  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)

  return count || 0
}

/**
 * Delete old notifications
 */
export async function cleanupOldNotifications(daysOld: number = 30): Promise<number> {
  const supabase = await createClient()

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysOld)

  const { data } = await supabase
    .from('notifications')
    .delete()
    .lt('created_at', cutoffDate.toISOString())
    .select('id')

  return data?.length || 0
}

/**
 * Update user presence
 */
export async function updatePresence(
  userId: string,
  status: 'online' | 'away' | 'offline'
): Promise<void> {
  const supabase = await createClient()

  await supabase.from('user_presence').upsert({
    user_id: userId,
    status,
    last_seen_at: new Date().toISOString()
  })
}

/**
 * Get online users
 */
export async function getOnlineUsers(): Promise<{ user_id: string; status: string; last_seen_at: string }[]> {
  const supabase = await createClient()

  // Consider users online if last seen within 5 minutes
  const cutoff = new Date()
  cutoff.setMinutes(cutoff.getMinutes() - 5)

  const { data } = await supabase
    .from('user_presence')
    .select('user_id, status, last_seen_at')
    .gte('last_seen_at', cutoff.toISOString())
    .neq('status', 'offline')

  return data || []
}

/**
 * Send typing indicator
 */
export async function sendTypingIndicator(
  ticketId: string,
  ticketSource: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER',
  userId: string,
  userName: string
): Promise<void> {
  await emitEvent({
    type: 'typing_indicator',
    ticket_id: ticketId,
    ticket_source: ticketSource,
    data: {
      user_id: userId,
      user_name: userName,
      is_typing: true
    },
    broadcast: false
    // Target users would be determined by who's viewing the ticket
  })
}

// Register default event handlers
onEvent('ticket_created', async (event) => {
  return {
    id: event.id,
    type: event.type,
    title: 'New Ticket Created',
    message: `Ticket #${event.data.ticket_number}: ${event.data.subject}`,
    ticket_id: event.ticket_id,
    ticket_source: event.ticket_source,
    ticket_number: event.data.ticket_number,
    priority: event.data.priority || 'info',
    action_url: `/tickets/${event.ticket_source?.toLowerCase()}/${event.ticket_id}`,
    created_at: event.created_at
  }
})

onEvent('ticket_assigned', async (event) => {
  return {
    id: event.id,
    type: event.type,
    title: 'Ticket Assigned',
    message: `You have been assigned ticket #${event.data.ticket_number}`,
    ticket_id: event.ticket_id,
    ticket_source: event.ticket_source,
    ticket_number: event.data.ticket_number,
    priority: event.data.priority || 'info',
    action_url: `/tickets/${event.ticket_source?.toLowerCase()}/${event.ticket_id}`,
    created_at: event.created_at
  }
})

onEvent('ticket_escalated', async (event) => {
  return {
    id: event.id,
    type: event.type,
    title: 'Ticket Escalated',
    message: `Ticket #${event.data.ticket_number} has been escalated to ${event.data.to_level}`,
    ticket_id: event.ticket_id,
    ticket_source: event.ticket_source,
    ticket_number: event.data.ticket_number,
    priority: 'urgent',
    action_url: `/tickets/${event.ticket_source?.toLowerCase()}/${event.ticket_id}`,
    created_at: event.created_at
  }
})

onEvent('message_received', async (event) => {
  return {
    id: event.id,
    type: event.type,
    title: 'New Message',
    message: `${event.data.sender_name} replied to ticket #${event.data.ticket_number}`,
    ticket_id: event.ticket_id,
    ticket_source: event.ticket_source,
    ticket_number: event.data.ticket_number,
    priority: 'info',
    action_url: `/tickets/${event.ticket_source?.toLowerCase()}/${event.ticket_id}`,
    created_at: event.created_at
  }
})

onEvent('sla_warning', async (event) => {
  return {
    id: event.id,
    type: event.type,
    title: 'SLA Warning',
    message: `Ticket #${event.data.ticket_number} is at risk of SLA breach (${event.data.percent_used}% used)`,
    ticket_id: event.ticket_id,
    ticket_source: event.ticket_source,
    ticket_number: event.data.ticket_number,
    priority: 'high',
    action_url: `/tickets/${event.ticket_source?.toLowerCase()}/${event.ticket_id}`,
    created_at: event.created_at
  }
})

onEvent('sla_breach', async (event) => {
  return {
    id: event.id,
    type: event.type,
    title: 'SLA Breached!',
    message: `Ticket #${event.data.ticket_number} has breached its SLA`,
    ticket_id: event.ticket_id,
    ticket_source: event.ticket_source,
    ticket_number: event.data.ticket_number,
    priority: 'urgent',
    action_url: `/tickets/${event.ticket_source?.toLowerCase()}/${event.ticket_id}`,
    created_at: event.created_at
  }
})

export default {
  emitEvent,
  onEvent,
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadCount,
  updatePresence,
  getOnlineUsers,
  sendTypingIndicator
}
