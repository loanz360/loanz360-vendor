/**
 * Real-time Ticket Updates Hook
 * Subscribes to ticket changes using Supabase Realtime
 */

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'

export interface TicketRealtimeEvent {
  event: 'INSERT' | 'UPDATE' | 'DELETE'
  ticketId: string
  ticket: any
  timestamp: string
}

export interface UseTicketRealtimeOptions {
  ticketId?: string // Subscribe to specific ticket
  department?: string // Subscribe to department tickets
  assignedToUserId?: string // Subscribe to user's assigned tickets
  onNewTicket?: (ticket: any) => void
  onTicketUpdate?: (ticket: any) => void
  onTicketDelete?: (ticketId: string) => void
  onNewMessage?: (message: any) => void
}

/**
 * Subscribe to real-time ticket updates
 */
export function useTicketRealtime(options: UseTicketRealtimeOptions) {
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [channel, setChannel] = useState<RealtimeChannel | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let ticketChannel: RealtimeChannel
    let messageChannel: RealtimeChannel | null = null

    const setupSubscriptions = async () => {
      try {
        // Build channel name based on subscription scope
        let channelName = 'tickets'
        if (options.ticketId) {
          channelName = `ticket:${options.ticketId}`
        } else if (options.department) {
          channelName = `tickets:department:${options.department}`
        } else if (options.assignedToUserId) {
          channelName = `tickets:user:${options.assignedToUserId}`
        }

        // Subscribe to ticket changes
        ticketChannel = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'partner_support_tickets',
              filter: options.ticketId
                ? `id=eq.${options.ticketId}`
                : options.department
                ? `routed_to_department=eq.${options.department}`
                : options.assignedToUserId
                ? `assigned_to_partner_support_id=eq.${options.assignedToUserId}`
                : undefined
            },
            (payload) => {
              console.log('[Realtime] Ticket change:', payload)

              if (payload.eventType === 'INSERT' && options.onNewTicket) {
                options.onNewTicket(payload.new)
              } else if (payload.eventType === 'UPDATE' && options.onTicketUpdate) {
                options.onTicketUpdate(payload.new)
              } else if (payload.eventType === 'DELETE' && options.onTicketDelete) {
                options.onTicketDelete(payload.old.id)
              }
            }
          )
          .subscribe((status) => {
            console.log('[Realtime] Ticket subscription status:', status)
            if (status === 'SUBSCRIBED') {
              setIsConnected(true)
              setError(null)
            } else if (status === 'CLOSED') {
              setIsConnected(false)
            } else if (status === 'CHANNEL_ERROR') {
              setError('Failed to connect to realtime updates')
              setIsConnected(false)
            }
          })

        // Subscribe to messages if specific ticket
        if (options.ticketId && options.onNewMessage) {
          messageChannel = supabase
            .channel(`messages:${options.ticketId}`)
            .on(
              'postgres_changes',
              {
                event: 'INSERT',
                schema: 'public',
                table: 'partner_ticket_messages',
                filter: `ticket_id=eq.${options.ticketId}`
              },
              (payload) => {
                console.log('[Realtime] New message:', payload)
                if (options.onNewMessage) {
                  options.onNewMessage(payload.new)
                }
              }
            )
            .subscribe()
        }

        setChannel(ticketChannel)
      } catch (err) {
        console.error('[Realtime] Setup error:', err)
        setError((err as Error).message)
        setIsConnected(false)
      }
    }

    setupSubscriptions()

    // Cleanup on unmount
    return () => {
      if (ticketChannel) {
        ticketChannel.unsubscribe()
      }
      if (messageChannel) {
        messageChannel.unsubscribe()
      }
      setIsConnected(false)
    }
  }, [
    options.ticketId,
    options.department,
    options.assignedToUserId,
    options.onNewTicket,
    options.onTicketUpdate,
    options.onTicketDelete,
    options.onNewMessage
  ])

  return {
    isConnected,
    error,
    channel
  }
}

/**
 * Subscribe to specific ticket updates
 */
export function useTicketDetailRealtime(
  ticketId: string,
  onUpdate?: (ticket: any) => void,
  onNewMessage?: (message: any) => void
) {
  return useTicketRealtime({
    ticketId,
    onTicketUpdate: onUpdate,
    onNewMessage
  })
}

/**
 * Subscribe to department queue updates
 */
export function useDepartmentQueueRealtime(
  department: string,
  onNewTicket?: (ticket: any) => void,
  onTicketUpdate?: (ticket: any) => void
) {
  return useTicketRealtime({
    department,
    onNewTicket,
    onTicketUpdate
  })
}

/**
 * Subscribe to user's assigned tickets
 */
export function useMyTicketsRealtime(
  userId: string,
  onNewTicket?: (ticket: any) => void,
  onTicketUpdate?: (ticket: any) => void
) {
  return useTicketRealtime({
    assignedToUserId: userId,
    onNewTicket,
    onTicketUpdate
  })
}
