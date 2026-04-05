/**
 * Real-time Employee Support Ticket Updates Hook
 * Subscribes to employee support ticket changes using Supabase Realtime
 */

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'

export interface EmployeeTicketRealtimeEvent {
  event: 'INSERT' | 'UPDATE' | 'DELETE'
  ticketId: string
  ticket: any
  timestamp: string
}

export interface UseEmployeeSupportRealtimeOptions {
  ticketId?: string // Subscribe to specific ticket
  employeeId?: string // Subscribe to employee's tickets
  assignedTo?: 'hr' | 'super_admin' | 'finance' | 'accounts' | 'payout_specialist' | 'technical_support' | 'compliance' | 'both' | 'all' // Subscribe to department tickets
  onNewTicket?: (ticket: any) => void
  onTicketUpdate?: (ticket: any) => void
  onTicketDelete?: (ticketId: string) => void
  onNewMessage?: (message: any) => void
  onStatusChange?: (ticket: any, oldStatus: string) => void
}

/**
 * Subscribe to real-time employee support ticket updates
 */
export function useEmployeeSupportRealtime(options: UseEmployeeSupportRealtimeOptions) {
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
        let channelName = 'employee-support-tickets'
        if (options.ticketId) {
          channelName = `employee-ticket:${options.ticketId}`
        } else if (options.employeeId) {
          channelName = `employee-tickets:user:${options.employeeId}`
        } else if (options.assignedTo) {
          channelName = `employee-tickets:assigned:${options.assignedTo}`
        }

        // Subscribe to ticket changes
        ticketChannel = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'support_tickets',
              filter: options.ticketId
                ? `id=eq.${options.ticketId}`
                : options.employeeId
                ? `employee_id=eq.${options.employeeId}`
                : options.assignedTo === 'hr'
                ? `assigned_to=in.(hr,both,all)`
                : options.assignedTo === 'super_admin'
                ? `assigned_to=in.(super_admin,both,all)`
                : options.assignedTo === 'finance'
                ? `assigned_to=in.(finance,all)`
                : options.assignedTo === 'accounts'
                ? `assigned_to=in.(accounts,all)`
                : options.assignedTo === 'payout_specialist'
                ? `assigned_to=in.(payout_specialist,all)`
                : options.assignedTo === 'technical_support'
                ? `assigned_to=in.(technical_support,all)`
                : options.assignedTo === 'compliance'
                ? `assigned_to=in.(compliance,all)`
                : options.assignedTo === 'both'
                ? `assigned_to=in.(both,all)`
                : options.assignedTo === 'all'
                ? `assigned_to=eq.all`
                : undefined
            },
            (payload) => {
              console.log('[EmployeeSupport Realtime] Ticket change:', payload)

              if (payload.eventType === 'INSERT' && options.onNewTicket) {
                options.onNewTicket(payload.new)
              } else if (payload.eventType === 'UPDATE' && options.onTicketUpdate) {
                // Check if status changed
                if (options.onStatusChange && payload.old?.status !== payload.new?.status) {
                  options.onStatusChange(payload.new, payload.old.status)
                }
                options.onTicketUpdate(payload.new)
              } else if (payload.eventType === 'DELETE' && options.onTicketDelete) {
                options.onTicketDelete(payload.old.id)
              }
            }
          )
          .subscribe((status) => {
            console.log('[EmployeeSupport Realtime] Ticket subscription status:', status)
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
            .channel(`employee-messages:${options.ticketId}`)
            .on(
              'postgres_changes',
              {
                event: 'INSERT',
                schema: 'public',
                table: 'ticket_messages',
                filter: `ticket_id=eq.${options.ticketId}`
              },
              (payload) => {
                console.log('[EmployeeSupport Realtime] New message:', payload)
                if (options.onNewMessage) {
                  options.onNewMessage(payload.new)
                }
              }
            )
            .subscribe((status) => {
              console.log('[EmployeeSupport Realtime] Message subscription status:', status)
            })
        }

        setChannel(ticketChannel)
      } catch (err) {
        console.error('[EmployeeSupport Realtime] Setup error:', err)
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
    options.employeeId,
    options.assignedTo,
    options.onNewTicket,
    options.onTicketUpdate,
    options.onTicketDelete,
    options.onNewMessage,
    options.onStatusChange
  ])

  return {
    isConnected,
    error,
    channel
  }
}

/**
 * Subscribe to specific employee ticket updates
 */
export function useEmployeeTicketDetailRealtime(
  ticketId: string,
  onUpdate?: (ticket: any) => void,
  onNewMessage?: (message: any) => void,
  onStatusChange?: (ticket: any, oldStatus: string) => void
) {
  return useEmployeeSupportRealtime({
    ticketId,
    onTicketUpdate: onUpdate,
    onNewMessage,
    onStatusChange
  })
}

/**
 * Subscribe to employee's own tickets
 */
export function useMyEmployeeTicketsRealtime(
  employeeId: string,
  onNewTicket?: (ticket: any) => void,
  onTicketUpdate?: (ticket: any) => void
) {
  return useEmployeeSupportRealtime({
    employeeId,
    onNewTicket,
    onTicketUpdate
  })
}

/**
 * Subscribe to HR assigned tickets
 */
export function useHRTicketsRealtime(
  onNewTicket?: (ticket: any) => void,
  onTicketUpdate?: (ticket: any) => void
) {
  return useEmployeeSupportRealtime({
    assignedTo: 'hr',
    onNewTicket,
    onTicketUpdate
  })
}

/**
 * Subscribe to Super Admin assigned tickets
 */
export function useSuperAdminTicketsRealtime(
  onNewTicket?: (ticket: any) => void,
  onTicketUpdate?: (ticket: any) => void
) {
  return useEmployeeSupportRealtime({
    assignedTo: 'super_admin',
    onNewTicket,
    onTicketUpdate
  })
}

/**
 * Subscribe to tickets assigned to both HR and Super Admin
 */
export function useBothAssignedTicketsRealtime(
  onNewTicket?: (ticket: any) => void,
  onTicketUpdate?: (ticket: any) => void
) {
  return useEmployeeSupportRealtime({
    assignedTo: 'both',
    onNewTicket,
    onTicketUpdate
  })
}

/**
 * Subscribe to Finance Department assigned tickets
 */
export function useFinanceTicketsRealtime(
  onNewTicket?: (ticket: any) => void,
  onTicketUpdate?: (ticket: any) => void
) {
  return useEmployeeSupportRealtime({
    assignedTo: 'finance',
    onNewTicket,
    onTicketUpdate
  })
}

/**
 * Subscribe to Accounts Department assigned tickets
 */
export function useAccountsTicketsRealtime(
  onNewTicket?: (ticket: any) => void,
  onTicketUpdate?: (ticket: any) => void
) {
  return useEmployeeSupportRealtime({
    assignedTo: 'accounts',
    onNewTicket,
    onTicketUpdate
  })
}

/**
 * Subscribe to Payout Specialist assigned tickets
 */
export function usePayoutSpecialistTicketsRealtime(
  onNewTicket?: (ticket: any) => void,
  onTicketUpdate?: (ticket: any) => void
) {
  return useEmployeeSupportRealtime({
    assignedTo: 'payout_specialist',
    onNewTicket,
    onTicketUpdate
  })
}

/**
 * Subscribe to Technical Support assigned tickets
 */
export function useTechnicalSupportTicketsRealtime(
  onNewTicket?: (ticket: any) => void,
  onTicketUpdate?: (ticket: any) => void
) {
  return useEmployeeSupportRealtime({
    assignedTo: 'technical_support',
    onNewTicket,
    onTicketUpdate
  })
}

/**
 * Subscribe to Compliance Department assigned tickets
 */
export function useComplianceTicketsRealtime(
  onNewTicket?: (ticket: any) => void,
  onTicketUpdate?: (ticket: any) => void
) {
  return useEmployeeSupportRealtime({
    assignedTo: 'compliance',
    onNewTicket,
    onTicketUpdate
  })
}

/**
 * Subscribe to tickets assigned to all departments
 */
export function useAllDepartmentsTicketsRealtime(
  onNewTicket?: (ticket: any) => void,
  onTicketUpdate?: (ticket: any) => void
) {
  return useEmployeeSupportRealtime({
    assignedTo: 'all',
    onNewTicket,
    onTicketUpdate
  })
}
