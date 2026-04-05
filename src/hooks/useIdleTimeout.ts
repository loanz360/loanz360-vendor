'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'

interface UseIdleTimeoutOptions {
  /**
   * Time in milliseconds before user is considered idle
   * Default: 5 minutes (300000ms)
   */
  timeout?: number

  /**
   * Time in milliseconds before showing warning
   * Default: 1 minute before timeout (timeout - 60000ms)
   */
  warningTime?: number

  /**
   * URL to redirect to after logout
   */
  logoutUrl: string

  /**
   * Optional logout API endpoint to call before redirecting
   */
  logoutApiUrl?: string

  /**
   * Callback when user becomes idle (before logout)
   */
  onIdle?: () => void

  /**
   * Callback when warning should be shown
   */
  onWarning?: (remainingSeconds: number) => void

  /**
   * Callback when user activity is detected and timer resets
   */
  onActive?: () => void

  /**
   * Whether the idle timeout is enabled
   * Default: true
   */
  enabled?: boolean
}

interface UseIdleTimeoutReturn {
  /**
   * Whether the user is currently idle
   */
  isIdle: boolean

  /**
   * Whether the warning is currently showing
   */
  isWarning: boolean

  /**
   * Remaining seconds before logout (only during warning period)
   */
  remainingSeconds: number

  /**
   * Manually reset the idle timer
   */
  resetTimer: () => void

  /**
   * Manually trigger logout
   */
  logout: () => void
}

/**
 * Hook to handle idle timeout and automatic logout
 *
 * Tracks user activity (mouse, keyboard, touch, scroll) and automatically
 * logs out the user after a period of inactivity.
 *
 * @example
 * ```tsx
 * const { isWarning, remainingSeconds, resetTimer } = useIdleTimeout({
 *   timeout: 5 * 60 * 1000, // 5 minutes
 *   logoutUrl: '/auth/login',
 *   logoutApiUrl: '/api/auth/logout',
 *   onWarning: (seconds) => console.log(`Logging out in ${seconds} seconds`),
 * })
 * ```
 */
export function useIdleTimeout({
  timeout = 5 * 60 * 1000, // 5 minutes default
  warningTime,
  logoutUrl,
  logoutApiUrl,
  onIdle,
  onWarning,
  onActive,
  enabled = true,
}: UseIdleTimeoutOptions): UseIdleTimeoutReturn {
  const router = useRouter()
  const [isIdle, setIsIdle] = useState(false)
  const [isWarning, setIsWarning] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(0)

  const idleTimerRef = useRef<NodeJS.Timeout | null>(null)
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  const lastActivityRef = useRef<number>(Date.now())

  // Calculate warning time (default: 1 minute before timeout)
  const effectiveWarningTime = warningTime ?? Math.max(timeout - 60000, timeout / 2)
  const warningDuration = timeout - effectiveWarningTime

  // Logout function
  const logout = useCallback(async () => {
    setIsIdle(true)
    onIdle?.()

    // Clear all timers
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)

    // Call logout API if provided
    if (logoutApiUrl) {
      try {
        await fetch(logoutApiUrl, {
          method: 'POST',
          credentials: 'include',
        })
      } catch (error) {
        console.error('[IdleTimeout] Logout API error:', error)
      }
    }

    // Redirect to login page using hard redirect to clear state
    window.location.href = logoutUrl
  }, [logoutApiUrl, logoutUrl, onIdle])

  // Start warning countdown
  const startWarningCountdown = useCallback(() => {
    setIsWarning(true)
    const totalSeconds = Math.ceil(warningDuration / 1000)
    setRemainingSeconds(totalSeconds)

    let secondsLeft = totalSeconds
    onWarning?.(secondsLeft)

    countdownRef.current = setInterval(() => {
      secondsLeft -= 1
      setRemainingSeconds(secondsLeft)
      onWarning?.(secondsLeft)

      if (secondsLeft <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current)
        logout()
      }
    }, 1000)
  }, [warningDuration, onWarning, logout])

  // Reset all timers
  const resetTimer = useCallback(() => {
    if (!enabled) return

    lastActivityRef.current = Date.now()

    // Clear existing timers
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)

    // Reset states
    if (isWarning || isIdle) {
      setIsWarning(false)
      setIsIdle(false)
      setRemainingSeconds(0)
      onActive?.()
    }

    // Set warning timer
    warningTimerRef.current = setTimeout(() => {
      startWarningCountdown()
    }, effectiveWarningTime)

    // Set idle timer (backup in case countdown fails)
    idleTimerRef.current = setTimeout(() => {
      logout()
    }, timeout)
  }, [enabled, isWarning, isIdle, effectiveWarningTime, timeout, startWarningCountdown, logout, onActive])

  // Set up activity listeners
  useEffect(() => {
    if (!enabled) return

    const events = [
      'mousedown',
      'mousemove',
      'keydown',
      'keypress',
      'touchstart',
      'touchmove',
      'scroll',
      'wheel',
      'click',
    ]

    // Throttle activity detection to avoid excessive resets
    let throttleTimer: NodeJS.Timeout | null = null
    const throttleDelay = 1000 // 1 second throttle

    const handleActivity = () => {
      if (throttleTimer) return

      throttleTimer = setTimeout(() => {
        throttleTimer = null
      }, throttleDelay)

      resetTimer()
    }

    // Add event listeners
    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    // Also listen for visibility change (tab focus)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check if we should have timed out while tab was hidden
        const elapsed = Date.now() - lastActivityRef.current
        if (elapsed >= timeout) {
          logout()
        } else if (elapsed >= effectiveWarningTime) {
          const remaining = timeout - elapsed
          setIsWarning(true)
          setRemainingSeconds(Math.ceil(remaining / 1000))
        } else {
          resetTimer()
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Initialize timer
    resetTimer()

    // Cleanup
    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity)
      })
      document.removeEventListener('visibilitychange', handleVisibilityChange)

      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
      if (throttleTimer) clearTimeout(throttleTimer)
    }
  }, [enabled, timeout, effectiveWarningTime, resetTimer, logout])

  return {
    isIdle,
    isWarning,
    remainingSeconds,
    resetTimer,
    logout,
  }
}

export default useIdleTimeout
