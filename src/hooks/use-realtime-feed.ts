/**
 * Real-Time Activity Feed Hook
 * Enterprise-grade hook for live activity streaming
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  RealtimeActivity,
  ActivityFilters,
  ActivityStatistics,
  SeverityLevel,
  EventCategory
} from '@/lib/realtime-feed/types'

// =====================================================
// TYPES
// =====================================================

export interface FeedStats {
  total: number
  critical: number
  errors: number
  warnings: number
  security: number
  suspicious: number
}

export interface UseRealtimeFeedOptions {
  // Initial filters
  filters?: ActivityFilters

  // Auto-refresh settings
  autoRefresh?: boolean
  refreshInterval?: number // ms

  // SSE streaming
  enableStreaming?: boolean

  // Pagination
  pageSize?: number

  // Callbacks
  onNewActivity?: (activity: RealtimeActivity) => void
  onCriticalActivity?: (activity: RealtimeActivity) => void
  onStatsUpdate?: (stats: FeedStats) => void
  onError?: (error: Error) => void
  onConnect?: () => void
  onDisconnect?: () => void
}

export interface UseRealtimeFeedReturn {
  // Data
  activities: RealtimeActivity[]
  statistics: ActivityStatistics | null
  feedStats: FeedStats

  // State
  isLoading: boolean
  isStreaming: boolean
  isPaused: boolean
  error: Error | null

  // Pagination
  total: number
  page: number
  hasMore: boolean

  // Actions
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
  pause: () => void
  resume: () => void
  clearActivities: () => void

  // Filters
  setFilters: (filters: ActivityFilters) => void
  resetFilters: () => void
  currentFilters: ActivityFilters

  // Activity actions
  acknowledgeActivity: (id: string, userId: string) => Promise<boolean>
  resolveActivity: (id: string, userId: string, notes?: string) => Promise<boolean>

  // Streaming
  startStreaming: () => void
  stopStreaming: () => void
}

// =====================================================
// DEFAULT VALUES
// =====================================================

const DEFAULT_PAGE_SIZE = 50
const DEFAULT_REFRESH_INTERVAL = 30000 // 30 seconds

const EMPTY_STATS: FeedStats = {
  total: 0,
  critical: 0,
  errors: 0,
  warnings: 0,
  security: 0,
  suspicious: 0
}

// =====================================================
// HOOK IMPLEMENTATION
// =====================================================

export function useRealtimeFeed(options: UseRealtimeFeedOptions = {}): UseRealtimeFeedReturn {
  const {
    filters: initialFilters = {},
    autoRefresh = true,
    refreshInterval = DEFAULT_REFRESH_INTERVAL,
    enableStreaming = false,
    pageSize = DEFAULT_PAGE_SIZE,
    onNewActivity,
    onCriticalActivity,
    onStatsUpdate,
    onError,
    onConnect,
    onDisconnect
  } = options

  // State
  const [activities, setActivities] = useState<RealtimeActivity[]>([])
  const [statistics, setStatistics] = useState<ActivityStatistics | null>(null)
  const [feedStats, setFeedStats] = useState<FeedStats>(EMPTY_STATS)
  const [isLoading, setIsLoading] = useState(true)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [currentFilters, setCurrentFilters] = useState<ActivityFilters>(initialFilters)

  // Refs
  const eventSourceRef = useRef<EventSource | null>(null)
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastFetchedRef = useRef<string | null>(null)

  // =====================================================
  // API CALLS
  // =====================================================

  const buildQueryString = useCallback((filters: ActivityFilters, offset = 0, limit = pageSize) => {
    const params = new URLSearchParams()

    params.set('limit', String(limit))
    params.set('offset', String(offset))

    if (filters.categories?.length) params.set('categories', filters.categories.join(','))
    if (filters.event_types?.length) params.set('event_types', filters.event_types.join(','))
    if (filters.severity_levels?.length) params.set('severity_levels', filters.severity_levels.join(','))
    if (filters.actor_types?.length) params.set('actor_types', filters.actor_types.join(','))
    if (filters.modules?.length) params.set('modules', filters.modules.join(','))
    if (filters.sources?.length) params.set('sources', filters.sources.join(','))
    if (filters.status?.length) params.set('status', filters.status.join(','))
    if (filters.start_date) params.set('start_date', filters.start_date)
    if (filters.end_date) params.set('end_date', filters.end_date)
    if (filters.search) params.set('search', filters.search)
    if (filters.security_only) params.set('security_only', 'true')
    if (filters.suspicious_only) params.set('suspicious_only', 'true')
    if (filters.ip_address) params.set('ip_address', filters.ip_address)
    if (filters.actor_id) params.set('actor_id', filters.actor_id)

    return params.toString()
  }, [pageSize])

  const fetchActivities = useCallback(async (append = false) => {
    try {
      if (!append) setIsLoading(true)

      const offset = append ? activities.length : 0
      const queryString = buildQueryString(currentFilters, offset)

      const response = await fetch(`/api/superadmin/realtime-feed?${queryString}`, {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to fetch activities')
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Unknown error')
      }

      const newActivities = data.activities as RealtimeActivity[]

      if (append) {
        setActivities(prev => [...prev, ...newActivities])
      } else {
        setActivities(newActivities)
        if (newActivities.length > 0) {
          lastFetchedRef.current = newActivities[0].created_at
        }
      }

      setTotal(data.total)
      setHasMore(data.has_more)
      setPage(Math.floor(offset / pageSize) + 1)
      setError(null)

      // Update feed stats
      updateFeedStats(append ? [...activities, ...newActivities] : newActivities)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      onError?.(error)
    } finally {
      setIsLoading(false)
    }
  }, [activities.length, buildQueryString, currentFilters, onError, pageSize])

  const fetchStatistics = useCallback(async (period = '24h') => {
    try {
      const response = await fetch(`/api/superadmin/realtime-feed/statistics?period=${period}`, {
        credentials: 'include'
      })

      if (!response.ok) return

      const data = await response.json()

      if (data.success && data.statistics) {
        setStatistics(data.statistics)
      }
    } catch (err) {
      console.error('Failed to fetch statistics:', err)
    }
  }, [])

  const updateFeedStats = useCallback((data: RealtimeActivity[]) => {
    const stats: FeedStats = {
      total: data.length,
      critical: data.filter(a => a.severity_level === 'critical').length,
      errors: data.filter(a => a.severity_level === 'error').length,
      warnings: data.filter(a => a.severity_level === 'warning').length,
      security: data.filter(a => a.is_security_event).length,
      suspicious: data.filter(a => a.is_suspicious).length
    }

    setFeedStats(stats)
    onStatsUpdate?.(stats)
  }, [onStatsUpdate])

  // =====================================================
  // SSE STREAMING
  // =====================================================

  const startStreaming = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    try {
      const params = new URLSearchParams()
      if (currentFilters.categories?.length) {
        params.set('categories', currentFilters.categories.join(','))
      }
      if (currentFilters.severity_levels?.length) {
        params.set('severity_levels', currentFilters.severity_levels.join(','))
      }
      if (currentFilters.security_only) {
        params.set('security_only', 'true')
      }

      const url = `/api/superadmin/realtime-feed/stream?${params.toString()}`
      const eventSource = new EventSource(url)

      eventSource.onopen = () => {
        setIsStreaming(true)
        setError(null)
        onConnect?.()
      }

      eventSource.addEventListener('connected', () => {
      })

      eventSource.addEventListener('activity', (event) => {
        if (isPaused) return

        try {
          const activity = JSON.parse(event.data) as RealtimeActivity

          setActivities(prev => {
            // Avoid duplicates
            if (prev.some(a => a.id === activity.id)) return prev
            return [activity, ...prev.slice(0, 499)] // Keep max 500 items
          })

          onNewActivity?.(activity)

          // Check for critical events
          if (activity.severity_level === 'critical' || activity.severity_level === 'error') {
            onCriticalActivity?.(activity)
          }
        } catch (err) {
          console.error('Failed to parse activity:', err)
        }
      })

      eventSource.addEventListener('stats_update', (event) => {
        try {
          const stats = JSON.parse(event.data)
          setFeedStats({
            total: stats.total || 0,
            critical: stats.critical || 0,
            errors: stats.errors || 0,
            warnings: stats.warnings || 0,
            security: stats.security || 0,
            suspicious: stats.suspicious || 0
          })
          onStatsUpdate?.(stats)
        } catch (err) {
          console.error('Failed to parse stats:', err)
        }
      })

      eventSource.onerror = () => {
        setIsStreaming(false)
        eventSource.close()
        onDisconnect?.()

        // Attempt reconnect after 5 seconds
        setTimeout(() => {
          if (enableStreaming && !eventSourceRef.current) {
            startStreaming()
          }
        }, 5000)
      }

      eventSourceRef.current = eventSource
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to start streaming')
      setError(error)
      onError?.(error)
    }
  }, [currentFilters, enableStreaming, isPaused, onConnect, onCriticalActivity, onDisconnect, onError, onNewActivity, onStatsUpdate])

  const stopStreaming = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setIsStreaming(false)
    onDisconnect?.()
  }, [onDisconnect])

  // =====================================================
  // PUBLIC ACTIONS
  // =====================================================

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return
    await fetchActivities(true)
  }, [fetchActivities, hasMore, isLoading])

  const refresh = useCallback(async () => {
    setPage(1)
    await Promise.all([
      fetchActivities(false),
      fetchStatistics()
    ])
  }, [fetchActivities, fetchStatistics])

  const pause = useCallback(() => {
    setIsPaused(true)
  }, [])

  const resume = useCallback(() => {
    setIsPaused(false)
  }, [])

  const clearActivities = useCallback(() => {
    setActivities([])
    setTotal(0)
    setPage(1)
    setHasMore(false)
  }, [])

  const setFilters = useCallback((newFilters: ActivityFilters) => {
    setCurrentFilters(newFilters)
    setPage(1)
  }, [])

  const resetFilters = useCallback(() => {
    setCurrentFilters({})
    setPage(1)
  }, [])

  const acknowledgeActivity = useCallback(async (id: string, userId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/superadmin/realtime-feed/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'acknowledge', user_id: userId })
      })

      if (!response.ok) return false

      const data = await response.json()

      if (data.success) {
        setActivities(prev =>
          prev.map(a => a.id === id ? { ...a, status: 'acknowledged', acknowledged_at: new Date().toISOString() } : a)
        )
        return true
      }

      return false
    } catch {
      return false
    }
  }, [])

  const resolveActivity = useCallback(async (id: string, userId: string, notes?: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/superadmin/realtime-feed/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'resolve', user_id: userId, notes })
      })

      if (!response.ok) return false

      const data = await response.json()

      if (data.success) {
        setActivities(prev =>
          prev.map(a => a.id === id ? { ...a, status: 'resolved', resolved_at: new Date().toISOString() } : a)
        )
        return true
      }

      return false
    } catch {
      return false
    }
  }, [])

  // =====================================================
  // EFFECTS
  // =====================================================

  // Initial fetch
  useEffect(() => {
    fetchActivities(false)
    fetchStatistics()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch when filters change
  useEffect(() => {
    fetchActivities(false)
  }, [currentFilters]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh && !isPaused && !enableStreaming) {
      refreshIntervalRef.current = setInterval(() => {
        fetchActivities(false)
      }, refreshInterval)

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current)
        }
      }
    }
  }, [autoRefresh, enableStreaming, fetchActivities, isPaused, refreshInterval])

  // Streaming
  useEffect(() => {
    if (enableStreaming) {
      startStreaming()
    }

    return () => {
      stopStreaming()
    }
  }, [enableStreaming]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [])

  return {
    // Data
    activities,
    statistics,
    feedStats,

    // State
    isLoading,
    isStreaming,
    isPaused,
    error,

    // Pagination
    total,
    page,
    hasMore,

    // Actions
    loadMore,
    refresh,
    pause,
    resume,
    clearActivities,

    // Filters
    setFilters,
    resetFilters,
    currentFilters,

    // Activity actions
    acknowledgeActivity,
    resolveActivity,

    // Streaming
    startStreaming,
    stopStreaming
  }
}

export default useRealtimeFeed
