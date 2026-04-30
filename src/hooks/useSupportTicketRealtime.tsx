'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { TicketSource } from '@/types/support-tickets'

// ============================================================
// TYPES
// ============================================================

export interface RealtimeTicketEvent<T = any> {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  ticket_id: string
  old_record?: T
  new_record?: T
  timestamp: string
}

export interface UseRealtimeOptions {
  enabled?: boolean
  onInsert?: (payload: RealtimeTicketEvent) => void
  onUpdate?: (payload: RealtimeTicketEvent) => void
  onDelete?: (payload: RealtimeTicketEvent) => void
  onError?: (error: Error) => void
  onConnectionChange?: (connected: boolean) => void
}

export interface RealtimeState {
  isConnected: boolean
  lastEvent: RealtimeTicketEvent | null
  error: Error | null
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getTableName(source: TicketSource | string): string {
  switch (source) {
    case TicketSource.EMPLOYEE:
    case 'EMPLOYEE':
      return 'support_tickets'
    case TicketSource.CUSTOMER:
    case 'CUSTOMER':
      return 'customer_support_tickets'
    case TicketSource.PARTNER:
    case 'PARTNER':
      return 'partner_support_tickets'
    default:
      return 'support_tickets'
  }
}

function getMessageTable(source: TicketSource | string): string {
  switch (source) {
    case TicketSource.EMPLOYEE:
    case 'EMPLOYEE':
      return 'ticket_messages'
    case TicketSource.CUSTOMER:
    case 'CUSTOMER':
      return 'customer_ticket_messages'
    case TicketSource.PARTNER:
    case 'PARTNER':
      return 'partner_ticket_messages'
    default:
      return 'ticket_messages'
  }
}

// ============================================================
// UNIFIED REALTIME HOOK
// ============================================================

/**
 * Hook for real-time ticket updates across any ticket source
 * Fixes Bug #6: No Customer/Partner Real-time
 */
export function useSupportTicketRealtime(
  ticketSource: TicketSource | string,
  userId?: string,
  options: UseRealtimeOptions = {}
): RealtimeState {
  const [state, setState] = useState<RealtimeState>({
    isConnected: false,
    lastEvent: null,
    error: null
  })

  const channelRef = useRef<RealtimeChannel | null>(null)
  const supabaseRef = useRef(createClient())

  const {
    enabled = true,
    onInsert,
    onUpdate,
    onDelete,
    onError,
    onConnectionChange
  } = options

  const handleEvent = useCallback((
    payload: RealtimePostgresChangesPayload<any>,
    type: 'INSERT' | 'UPDATE' | 'DELETE'
  ) => {
    const event: RealtimeTicketEvent = {
      type,
      table: payload.table,
      ticket_id: payload.new?.id || payload.old?.id,
      old_record: payload.old,
      new_record: payload.new,
      timestamp: new Date().toISOString()
    }

    setState(prev => ({ ...prev, lastEvent: event }))

    switch (type) {
      case 'INSERT':
        onInsert?.(event)
        break
      case 'UPDATE':
        onUpdate?.(event)
        break
      case 'DELETE':
        onDelete?.(event)
        break
    }
  }, [onInsert, onUpdate, onDelete])

  useEffect(() => {
    if (!enabled) return

    const supabase = supabaseRef.current
    const tableName = getTableName(ticketSource)

    // Build filter based on user ID if provided
    let filter: string | undefined
    if (userId) {
      switch (ticketSource) {
        case TicketSource.EMPLOYEE:
        case 'EMPLOYEE':
          filter = `employee_id=eq.${userId}`
          break
        case TicketSource.CUSTOMER:
        case 'CUSTOMER':
          filter = `customer_id=eq.${userId}`
          break
        case TicketSource.PARTNER:
        case 'PARTNER':
          filter = `partner_id=eq.${userId}`
          break
      }
    }

    // Create channel
    const channelName = `tickets:${ticketSource}:${userId || 'all'}`
    const channel = supabase.channel(channelName)

    // Subscribe to ticket changes
    const subscriptionConfig: Record<string, unknown> = {
      event: '*',
      schema: 'public',
      table: tableName
    }

    if (filter) {
      subscriptionConfig.filter = filter
    }

    channel
      .on('postgres_changes', subscriptionConfig, (payload) => {
        handleEvent(payload, payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE')
      })
      .on('system', { event: 'connected' }, () => {
        setState(prev => ({ ...prev, isConnected: true, error: null }))
        onConnectionChange?.(true)
      })
      .on('system', { event: 'disconnected' }, () => {
        setState(prev => ({ ...prev, isConnected: false }))
        onConnectionChange?.(false)
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setState(prev => ({ ...prev, isConnected: true }))
          onConnectionChange?.(true)
        } else if (status === 'CHANNEL_ERROR') {
          const error = new Error('Failed to subscribe to ticket updates')
          setState(prev => ({ ...prev, error, isConnected: false }))
          onError?.(error)
          onConnectionChange?.(false)
        }
      })

    channelRef.current = channel

    // Cleanup
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [ticketSource, userId, enabled, handleEvent, onConnectionChange, onError])

  return state
}

// ============================================================
// SPECIFIC SOURCE HOOKS
// ============================================================

/**
 * Hook for employee ticket real-time updates
 */
export function useEmployeeTicketRealtime(
  employeeId?: string,
  options: UseRealtimeOptions = {}
) {
  return useSupportTicketRealtime(TicketSource.EMPLOYEE, employeeId, options)
}

/**
 * Hook for customer ticket real-time updates
 */
export function useCustomerTicketRealtime(
  customerId?: string,
  options: UseRealtimeOptions = {}
) {
  return useSupportTicketRealtime(TicketSource.CUSTOMER, customerId, options)
}

/**
 * Hook for partner ticket real-time updates
 */
export function usePartnerTicketRealtime(
  partnerId?: string,
  options: UseRealtimeOptions = {}
) {
  return useSupportTicketRealtime(TicketSource.PARTNER, partnerId, options)
}

// ============================================================
// TICKET DETAIL REALTIME HOOK
// ============================================================

/**
 * Hook for real-time updates on a specific ticket (includes messages)
 */
export function useTicketDetailRealtime(
  ticketId: string,
  ticketSource: TicketSource | string,
  options: UseRealtimeOptions & {
    onNewMessage?: (message: unknown) => void
    onMessageUpdate?: (message: unknown) => void
  } = {}
) {
  const [state, setState] = useState<RealtimeState & { messageCount: number }>({
    isConnected: false,
    lastEvent: null,
    error: null,
    messageCount: 0
  })

  const channelRef = useRef<RealtimeChannel | null>(null)
  const supabaseRef = useRef(createClient())

  const { enabled = true, onUpdate, onNewMessage, onMessageUpdate, onError, onConnectionChange } = options

  useEffect(() => {
    if (!enabled || !ticketId) return

    const supabase = supabaseRef.current
    const ticketTable = getTableName(ticketSource)
    const messageTable = getMessageTable(ticketSource)

    const channelName = `ticket-detail:${ticketSource}:${ticketId}`
    const channel = supabase.channel(channelName)

    // Subscribe to ticket updates
    channel
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: ticketTable,
        filter: `id=eq.${ticketId}`
      }, (payload) => {
        const event: RealtimeTicketEvent = {
          type: 'UPDATE',
          table: ticketTable,
          ticket_id: ticketId,
          old_record: payload.old,
          new_record: payload.new,
          timestamp: new Date().toISOString()
        }
        setState(prev => ({ ...prev, lastEvent: event }))
        onUpdate?.(event)
      })
      // Subscribe to new messages
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: messageTable,
        filter: `ticket_id=eq.${ticketId}`
      }, (payload) => {
        setState(prev => ({ ...prev, messageCount: prev.messageCount + 1 }))
        onNewMessage?.(payload.new)
      })
      // Subscribe to message updates (read status, etc.)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: messageTable,
        filter: `ticket_id=eq.${ticketId}`
      }, (payload) => {
        onMessageUpdate?.(payload.new)
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setState(prev => ({ ...prev, isConnected: true }))
          onConnectionChange?.(true)
        } else if (status === 'CHANNEL_ERROR') {
          const error = new Error('Failed to subscribe to ticket detail updates')
          setState(prev => ({ ...prev, error, isConnected: false }))
          onError?.(error)
          onConnectionChange?.(false)
        }
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [ticketId, ticketSource, enabled, onUpdate, onNewMessage, onMessageUpdate, onConnectionChange, onError])

  return state
}

// ============================================================
// UNIFIED REALTIME HOOK (FOR SUPER ADMIN)
// ============================================================

/**
 * Hook for real-time updates across all ticket sources (Super Admin)
 */
export function useUnifiedTicketRealtime(options: UseRealtimeOptions = {}) {
  const [state, setState] = useState<RealtimeState>({
    isConnected: false,
    lastEvent: null,
    error: null
  })

  const channelsRef = useRef<RealtimeChannel[]>([])
  const supabaseRef = useRef(createClient())

  const { enabled = true, onInsert, onUpdate, onDelete, onError, onConnectionChange } = options

  const handleEvent = useCallback((
    payload: RealtimePostgresChangesPayload<any>,
    type: 'INSERT' | 'UPDATE' | 'DELETE',
    source: TicketSource
  ) => {
    const event: RealtimeTicketEvent = {
      type,
      table: payload.table,
      ticket_id: payload.new?.id || payload.old?.id,
      old_record: { ...payload.old, source },
      new_record: { ...payload.new, source },
      timestamp: new Date().toISOString()
    }

    setState(prev => ({ ...prev, lastEvent: event }))

    switch (type) {
      case 'INSERT':
        onInsert?.(event)
        break
      case 'UPDATE':
        onUpdate?.(event)
        break
      case 'DELETE':
        onDelete?.(event)
        break
    }
  }, [onInsert, onUpdate, onDelete])

  useEffect(() => {
    if (!enabled) return

    const supabase = supabaseRef.current
    const sources: { source: TicketSource; table: string }[] = [
      { source: TicketSource.EMPLOYEE, table: 'support_tickets' },
      { source: TicketSource.CUSTOMER, table: 'customer_support_tickets' },
      { source: TicketSource.PARTNER, table: 'partner_support_tickets' }
    ]

    let connectedCount = 0

    sources.forEach(({ source, table }) => {
      const channel = supabase.channel(`unified:${source}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table
        }, (payload) => {
          handleEvent(payload, payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE', source)
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            connectedCount++
            if (connectedCount === sources.length) {
              setState(prev => ({ ...prev, isConnected: true }))
              onConnectionChange?.(true)
            }
          } else if (status === 'CHANNEL_ERROR') {
            const error = new Error(`Failed to subscribe to ${source} updates`)
            setState(prev => ({ ...prev, error }))
            onError?.(error)
          }
        })

      channelsRef.current.push(channel)
    })

    return () => {
      channelsRef.current.forEach(channel => {
        supabase.removeChannel(channel)
      })
      channelsRef.current = []
    }
  }, [enabled, handleEvent, onConnectionChange, onError])

  return state
}

// ============================================================
// CONNECTION STATUS INDICATOR COMPONENT
// ============================================================

export function RealtimeConnectionIndicator({
  isConnected,
  className = ''
}: {
  isConnected: boolean
  className?: string
}) {
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
      isConnected
        ? 'bg-green-500/10 text-green-400'
        : 'bg-gray-500/10 text-gray-400'
    } ${className}`}>
      <div className={`w-2 h-2 rounded-full ${
        isConnected
          ? 'bg-green-400 animate-pulse'
          : 'bg-gray-400'
      }`} />
      <span>{isConnected ? 'Live' : 'Offline'}</span>
    </div>
  )
}
