/**
 * Real-time Events Hook
 *
 * React hook for subscribing to Server-Sent Events
 * Features:
 * - Automatic reconnection
 * - Event filtering
 * - Connection status tracking
 */

import { useState, useEffect, useCallback, useRef } from 'react'

export type EventType =
  | 'connected'
  | 'heartbeat'
  | 'lead_created'
  | 'lead_updated'
  | 'lead_converted'
  | 'contact_updated'
  | 'deal_created'

export interface RealtimeEvent {
  type: EventType
  data?: Record<string, unknown>
  old?: Record<string, unknown>
  timestamp?: string
  message?: string
}

export interface UseRealtimeOptions {
  onEvent?: (event: RealtimeEvent) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Error) => void
  eventTypes?: EventType[]
  enabled?: boolean
  reconnectAttempts?: number
  reconnectInterval?: number
}

export interface UseRealtimeReturn {
  isConnected: boolean
  lastEvent: RealtimeEvent | null
  events: RealtimeEvent[]
  error: Error | null
  reconnect: () => void
  disconnect: () => void
}

export function useRealtime(options: UseRealtimeOptions = {}): UseRealtimeReturn {
  const {
    onEvent,
    onConnect,
    onDisconnect,
    onError,
    eventTypes,
    enabled = true,
    reconnectAttempts = 5,
    reconnectInterval = 3000,
  } = options

  const [isConnected, setIsConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null)
  const [events, setEvents] = useState<RealtimeEvent[]>([])
  const [error, setError] = useState<Error | null>(null)

  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectCountRef = useRef(0)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    try {
      const eventSource = new EventSource('/api/ai-crm/cro/events')
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        setIsConnected(true)
        setError(null)
        reconnectCountRef.current = 0
        onConnect?.()
      }

      eventSource.onmessage = (event) => {
        try {
          const data: RealtimeEvent = JSON.parse(event.data)

          // Filter events if eventTypes specified
          if (eventTypes && !eventTypes.includes(data.type)) {
            return
          }

          // Skip heartbeat from event history
          if (data.type !== 'heartbeat') {
            setLastEvent(data)
            setEvents((prev) => [...prev.slice(-99), data]) // Keep last 100 events
          }

          onEvent?.(data)
        } catch (parseError) {
          console.error('Failed to parse event:', parseError)
        }
      }

      eventSource.onerror = (err) => {
        setIsConnected(false)
        eventSource.close()

        const errorObj = new Error('EventSource connection failed')
        setError(errorObj)
        onError?.(errorObj)
        onDisconnect?.()

        // Attempt reconnection
        if (reconnectCountRef.current < reconnectAttempts) {
          reconnectCountRef.current++
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, reconnectInterval * reconnectCountRef.current)
        }
      }
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to create EventSource')
      setError(errorObj)
      onError?.(errorObj)
    }
  }, [eventTypes, onConnect, onDisconnect, onError, onEvent, reconnectAttempts, reconnectInterval])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setIsConnected(false)
    onDisconnect?.()
  }, [onDisconnect])

  const reconnect = useCallback(() => {
    disconnect()
    reconnectCountRef.current = 0
    connect()
  }, [connect, disconnect])

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (enabled) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [enabled, connect, disconnect])

  return {
    isConnected,
    lastEvent,
    events,
    error,
    reconnect,
    disconnect,
  }
}

/**
 * Hook specifically for lead updates
 */
export function useLeadRealtime(
  onLeadUpdate?: (lead: Record<string, unknown>, type: 'created' | 'updated' | 'converted') => void
) {
  return useRealtime({
    eventTypes: ['lead_created', 'lead_updated', 'lead_converted'],
    onEvent: (event) => {
      if (event.data && onLeadUpdate) {
        const type = event.type === 'lead_created'
          ? 'created'
          : event.type === 'lead_converted'
          ? 'converted'
          : 'updated'
        onLeadUpdate(event.data, type)
      }
    },
  })
}

/**
 * Hook specifically for deal updates
 */
export function useDealRealtime(
  onDealUpdate?: (deal: Record<string, unknown>) => void
) {
  return useRealtime({
    eventTypes: ['deal_created'],
    onEvent: (event) => {
      if (event.data && onDealUpdate) {
        onDealUpdate(event.data)
      }
    },
  })
}

export default useRealtime
