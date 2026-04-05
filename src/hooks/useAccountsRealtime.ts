import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

/**
 * Real-time subscription hook for Accounts Executive portal
 * Subscribes to changes on cp_applications and partner_payout_applications tables
 * Triggers callbacks when applications are created, updated, or status changes
 *
 * Uses refs for callbacks to avoid re-subscribing when callers pass inline functions
 */
export function useAccountsRealtime(options?: {
  onCPChange?: () => void
  onBAChange?: () => void
  onBPChange?: () => void
  enabled?: boolean
}) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const { onCPChange, onBAChange, onBPChange, enabled = true } = options || {}

  // Store callbacks in refs so channel doesn't re-subscribe on every render
  const onCPChangeRef = useRef(onCPChange)
  const onBAChangeRef = useRef(onBAChange)
  const onBPChangeRef = useRef(onBPChange)

  useEffect(() => { onCPChangeRef.current = onCPChange }, [onCPChange])
  useEffect(() => { onBAChangeRef.current = onBAChange }, [onBAChange])
  useEffect(() => { onBPChangeRef.current = onBPChange }, [onBPChange])

  useEffect(() => {
    if (!enabled) return

    const supabase = createClient()

    const channel = supabase
      .channel('accounts-executive-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cp_applications' },
        () => {
          onCPChangeRef.current?.()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'partner_payout_applications', filter: 'partner_type=eq.BA' },
        () => {
          onBAChangeRef.current?.()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'partner_payout_applications', filter: 'partner_type=eq.BP' },
        () => {
          onBPChangeRef.current?.()
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [enabled]) // Only re-subscribe when enabled changes, not on callback changes

  return { channel: channelRef.current }
}

/**
 * Real-time hook specifically for CP applications page
 */
export function useCPApplicationsRealtime(onUpdate: () => void, enabled = true) {
  return useAccountsRealtime({ onCPChange: onUpdate, enabled })
}

/**
 * Real-time hook specifically for BA applications page
 */
export function useBAApplicationsRealtime(onUpdate: () => void, enabled = true) {
  return useAccountsRealtime({ onBAChange: onUpdate, enabled })
}

/**
 * Real-time hook specifically for BP applications page
 */
export function useBPApplicationsRealtime(onUpdate: () => void, enabled = true) {
  return useAccountsRealtime({ onBPChange: onUpdate, enabled })
}
