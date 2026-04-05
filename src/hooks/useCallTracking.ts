'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export interface CallSession {
  contactId: string
  contactType: 'contact' | 'positive_contact' | 'lead'
  customerName: string
  customerPhone: string
  leadId?: string
  startTime: number
}

interface UseCallTrackingReturn {
  /** Start a call - opens native dialer and tracks the session */
  initiateCall: (params: Omit<CallSession, 'startTime'>) => void
  /** Current active call session (null if no call in progress) */
  activeCall: CallSession | null
  /** Calculated call duration in seconds when call ends */
  callDuration: number
  /** Whether the post-call modal should be shown */
  showPostCallModal: boolean
  /** Close the post-call modal and clear the session */
  dismissPostCallModal: () => void
}

const CALL_SESSION_KEY = 'cro_active_call'

/**
 * Custom hook for SIM-based call tracking.
 *
 * Flow:
 * 1. CRO clicks "Call" → opens tel: URI → native dialer opens
 * 2. When CRO returns (visibilitychange → visible), post-call modal appears
 * 3. CRO fills outcome, notes, interest level → submits to /api/cro/call-logs
 */
export function useCallTracking(): UseCallTrackingReturn {
  const [activeCall, setActiveCall] = useState<CallSession | null>(null)
  const [callDuration, setCallDuration] = useState(0)
  const [showPostCallModal, setShowPostCallModal] = useState(false)
  const hasInitiated = useRef(false)

  // Restore session from sessionStorage on mount (in case page refreshed during call)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(CALL_SESSION_KEY)
      if (stored) {
        const session: CallSession = JSON.parse(stored)
        setActiveCall(session)
      }
    } catch {
      // Invalid stored data
      sessionStorage.removeItem(CALL_SESSION_KEY)
    }
  }, [])

  // Listen for page visibility change (user returns from phone call)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        try {
          const stored = sessionStorage.getItem(CALL_SESSION_KEY)
          if (stored) {
            const session: CallSession = JSON.parse(stored)
            const duration = Math.round((Date.now() - session.startTime) / 1000)

            // Only show modal if at least 3 seconds passed (filter out accidental switches)
            if (duration >= 3) {
              setActiveCall(session)
              setCallDuration(duration)
              setShowPostCallModal(true)
              sessionStorage.removeItem(CALL_SESSION_KEY)
            }
          }
        } catch {
          sessionStorage.removeItem(CALL_SESSION_KEY)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  const initiateCall = useCallback((params: Omit<CallSession, 'startTime'>) => {
    // Prevent double-initiation
    if (hasInitiated.current) return
    hasInitiated.current = true

    const session: CallSession = {
      ...params,
      startTime: Date.now(),
    }

    // Store in sessionStorage so we can recover on page focus
    sessionStorage.setItem(CALL_SESSION_KEY, JSON.stringify(session))
    setActiveCall(session)

    // Open native dialer
    const phone = params.customerPhone.replace(/[^+\d]/g, '')
    window.location.href = `tel:${phone.startsWith('+') ? phone : '+91' + phone}` // TODO: Make country code configurable when expanding beyond India

    // Reset initiation guard after a short delay
    setTimeout(() => { hasInitiated.current = false }, 2000)
  }, [])

  const dismissPostCallModal = useCallback(() => {
    setShowPostCallModal(false)
    setActiveCall(null)
    setCallDuration(0)
    sessionStorage.removeItem(CALL_SESSION_KEY)
  }, [])

  return {
    initiateCall,
    activeCall,
    callDuration,
    showPostCallModal,
    dismissPostCallModal,
  }
}
