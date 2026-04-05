'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

export interface LeadUpdate {
  type: 'lead_created' | 'lead_updated' | 'lead_deleted' | 'status_changed' | 'stage_changed' | 'assignment_changed' | 'communication_added'
  leadId: string
  data: Record<string, unknown>
  timestamp: string
  userId?: string
  userName?: string
}

export interface NotificationMessage {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  timestamp: string
  read: boolean
  actionUrl?: string
}

export interface WebSocketState {
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  lastPing: Date | null
  reconnectAttempt: number
}

interface UseLeadsWebSocketOptions {
  url?: string
  onLeadUpdate?: (update: LeadUpdate) => void
  onNotification?: (notification: NotificationMessage) => void
  onConnectionChange?: (connected: boolean) => void
  autoReconnect?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
}

export function useLeadsWebSocket(options: UseLeadsWebSocketOptions = {}) {
  const {
    url = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws/leads',
    onLeadUpdate,
    onNotification,
    onConnectionChange,
    autoReconnect = true,
    reconnectInterval = 5000,
    maxReconnectAttempts = 10
  } = options

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    lastPing: null,
    reconnectAttempt: 0
  })

  const [recentUpdates, setRecentUpdates] = useState<LeadUpdate[]>([])
  const [notifications, setNotifications] = useState<NotificationMessage[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  // Simulate WebSocket connection for development
  const simulateConnection = useCallback(() => {
    setState(prev => ({ ...prev, isConnecting: true, error: null }))

    // Simulate connection delay
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        lastPing: new Date(),
        reconnectAttempt: 0
      }))
      onConnectionChange?.(true)
    }, 1000)
  }, [onConnectionChange])

  // Simulate random lead updates for development
  const simulateUpdates = useCallback(() => {
    const updateTypes: LeadUpdate['type'][] = [
      'lead_created',
      'lead_updated',
      'status_changed',
      'stage_changed',
      'assignment_changed',
      'communication_added'
    ]

    const randomUpdate = (): LeadUpdate => ({
      type: updateTypes[Math.floor(Math.random() * updateTypes.length)],
      leadId: `lead-${1000 + Math.floor(Math.random() * 100)}`,
      data: {
        name: `Customer ${Math.floor(Math.random() * 1000)}`,
        status: ['new', 'contacted', 'qualified', 'proposal'][Math.floor(Math.random() * 4)],
        stage: ['New Lead', 'Contacted', 'Document Collection', 'Verification'][Math.floor(Math.random() * 4)]
      },
      timestamp: new Date().toISOString(),
      userId: 'user-001',
      userName: 'Suresh Kumar'
    })

    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        const update = randomUpdate()
        setRecentUpdates(prev => [update, ...prev.slice(0, 49)])
        onLeadUpdate?.(update)

        // Sometimes also generate a notification
        if (Math.random() > 0.5) {
          const notification: NotificationMessage = {
            id: `notif-${Date.now()}`,
            type: ['info', 'success', 'warning'][Math.floor(Math.random() * 3)] as NotificationMessage['type'],
            title: getNotificationTitle(update.type),
            message: getNotificationMessage(update),
            timestamp: new Date().toISOString(),
            read: false,
            actionUrl: `/leads/${update.leadId}`
          }
          setNotifications(prev => [notification, ...prev.slice(0, 19)])
          setUnreadCount(prev => prev + 1)
          onNotification?.(notification)
        }
      }
    }, 10000) // Every 10 seconds

    return interval
  }, [onLeadUpdate, onNotification])

  const getNotificationTitle = (type: LeadUpdate['type']) => {
    switch (type) {
      case 'lead_created': return 'New Lead'
      case 'lead_updated': return 'Lead Updated'
      case 'status_changed': return 'Status Changed'
      case 'stage_changed': return 'Stage Updated'
      case 'assignment_changed': return 'Lead Assigned'
      case 'communication_added': return 'New Communication'
      default: return 'Lead Update'
    }
  }

  const getNotificationMessage = (update: LeadUpdate) => {
    const name = update.data.name as string || 'A lead'
    switch (update.type) {
      case 'lead_created': return `${name} was added to the system`
      case 'lead_updated': return `${name}'s information was updated`
      case 'status_changed': return `${name}'s status changed to ${update.data.status}`
      case 'stage_changed': return `${name} moved to ${update.data.stage}`
      case 'assignment_changed': return `${name} was assigned to ${update.userName}`
      case 'communication_added': return `New communication logged for ${name}`
      default: return `Update for ${name}`
    }
  }

  const connect = useCallback(() => {
    // In production, this would establish a real WebSocket connection
    // For now, we simulate it for development purposes
    if (typeof window === 'undefined') return

    simulateConnection()
  }, [simulateConnection])

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current)
      pingIntervalRef.current = null
    }

    setState(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false
    }))
    onConnectionChange?.(false)
  }, [onConnectionChange])

  const sendMessage = useCallback((message: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
      return true
    }
    return false
  }, [])

  const subscribeToLead = useCallback((leadId: string) => {
    return sendMessage({ type: 'subscribe', leadId })
  }, [sendMessage])

  const unsubscribeFromLead = useCallback((leadId: string) => {
    return sendMessage({ type: 'unsubscribe', leadId })
  }, [sendMessage])

  const markNotificationRead = useCallback((notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }, [])

  const markAllNotificationsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }, [])

  const clearNotifications = useCallback(() => {
    setNotifications([])
    setUnreadCount(0)
  }, [])

  // Initialize connection
  useEffect(() => {
    connect()

    // Start simulating updates in development
    const updateInterval = simulateUpdates()

    // Ping interval to keep connection alive
    pingIntervalRef.current = setInterval(() => {
      if (state.isConnected) {
        setState(prev => ({ ...prev, lastPing: new Date() }))
      }
    }, 30000)

    return () => {
      disconnect()
      clearInterval(updateInterval)
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
      }
    }
  }, []) // Only run once on mount

  return {
    // Connection state
    isConnected: state.isConnected,
    isConnecting: state.isConnecting,
    error: state.error,
    lastPing: state.lastPing,

    // Actions
    connect,
    disconnect,
    sendMessage,
    subscribeToLead,
    unsubscribeFromLead,

    // Updates
    recentUpdates,
    clearRecentUpdates: () => setRecentUpdates([]),

    // Notifications
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications
  }
}

// Provider component for global WebSocket state
import { createContext, useContext, ReactNode } from 'react'

interface LeadsWebSocketContextValue extends ReturnType<typeof useLeadsWebSocket> {}

const LeadsWebSocketContext = createContext<LeadsWebSocketContextValue | null>(null)

export function LeadsWebSocketProvider({ children }: { children: ReactNode }) {
  const websocket = useLeadsWebSocket()

  return (
    <LeadsWebSocketContext.Provider value={websocket}>
      {children}
    </LeadsWebSocketContext.Provider>
  )
}

export function useLeadsWebSocketContext() {
  const context = useContext(LeadsWebSocketContext)
  if (!context) {
    throw new Error('useLeadsWebSocketContext must be used within LeadsWebSocketProvider')
  }
  return context
}

export default useLeadsWebSocket
