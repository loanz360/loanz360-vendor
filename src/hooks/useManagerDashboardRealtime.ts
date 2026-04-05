/**
 * Real-time Dashboard Updates Hook for Accounts Manager
 * Subscribes to cp_applications and partner_payout_applications changes
 * to keep the dashboard updated without polling.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'

export interface DashboardRealtimeEvent {
  table: 'cp_applications' | 'partner_payout_applications'
  event: 'INSERT' | 'UPDATE' | 'DELETE'
  new_status?: string
  old_status?: string
  timestamp: string
}

interface UseManagerDashboardRealtimeOptions {
  onUpdate: () => void // callback to refresh dashboard data
  enabled?: boolean
}

export function useManagerDashboardRealtime({ onUpdate, enabled = true }: UseManagerDashboardRealtimeOptions) {
  const [isConnected, setIsConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<DashboardRealtimeEvent | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Debounced refresh: batch rapid changes into a single API call
  const debouncedRefresh = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onUpdate()
    }, 2000) // 2-second debounce
  }, [onUpdate])

  useEffect(() => {
    if (!enabled) return

    const supabase = createClient()
    const channels: RealtimeChannel[] = []

    // Subscribe to CP application status changes
    const cpChannel = supabase
      .channel('manager-dashboard-cp')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'cp_applications',
          filter: 'status=in.(PENDING,UNDER_REVIEW,ACCOUNTS_VERIFICATION,ACCOUNTS_VERIFIED,REJECTED,ON_HOLD)',
        },
        (payload) => {
          setLastEvent({
            table: 'cp_applications',
            event: 'UPDATE',
            new_status: (payload.new as { status?: string })?.status,
            old_status: (payload.old as { status?: string })?.status,
            timestamp: new Date().toISOString(),
          })
          debouncedRefresh()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'cp_applications',
        },
        () => {
          setLastEvent({
            table: 'cp_applications',
            event: 'INSERT',
            timestamp: new Date().toISOString(),
          })
          debouncedRefresh()
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setIsConnected(true)
      })

    channels.push(cpChannel)

    // Subscribe to partner payout application status changes
    const partnerChannel = supabase
      .channel('manager-dashboard-partner')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'partner_payout_applications',
          filter: 'status=in.(PENDING,ACCOUNTS_VERIFICATION,ACCOUNTS_VERIFIED,REJECTED,ON_HOLD)',
        },
        (payload) => {
          setLastEvent({
            table: 'partner_payout_applications',
            event: 'UPDATE',
            new_status: (payload.new as { status?: string })?.status,
            old_status: (payload.old as { status?: string })?.status,
            timestamp: new Date().toISOString(),
          })
          debouncedRefresh()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'partner_payout_applications',
        },
        () => {
          setLastEvent({
            table: 'partner_payout_applications',
            event: 'INSERT',
            timestamp: new Date().toISOString(),
          })
          debouncedRefresh()
        }
      )
      .subscribe()

    channels.push(partnerChannel)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      channels.forEach(ch => supabase.removeChannel(ch))
      setIsConnected(false)
    }
  }, [enabled, debouncedRefresh])

  return { isConnected, lastEvent }
}
