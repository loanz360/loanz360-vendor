/**
 * Client-side Rate Limiter for Login Attempts
 * Enterprise-grade brute force protection
 *
 * SECURITY: Prevents automated attacks on authentication endpoints
 * - Tracks failed login attempts per email
 * - Implements exponential lockout
 * - Stores in localStorage (cleared on successful login)
 */

import * as React from 'react'
import { clientLogger } from '@/lib/utils/client-logger'

interface LoginAttempt {
  email: string
  attempts: number
  lockoutUntil: number | null
  lastAttempt: number
}

const STORAGE_KEY = 'loanz360_login_attempts'
const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION = 15 * 60 * 1000 // 15 minutes in milliseconds

/**
 * Get login attempts for an email
 */
function getAttempts(email: string): LoginAttempt {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return {
        email,
        attempts: 0,
        lockoutUntil: null,
        lastAttempt: 0
      }
    }

    const allAttempts: Record<string, LoginAttempt> = JSON.parse(stored)
    const attempt = allAttempts[email.toLowerCase()]

    if (!attempt) {
      return {
        email,
        attempts: 0,
        lockoutUntil: null,
        lastAttempt: 0
      }
    }

    // Check if lockout has expired
    if (attempt.lockoutUntil && attempt.lockoutUntil < Date.now()) {
      return {
        email,
        attempts: 0,
        lockoutUntil: null,
        lastAttempt: 0
      }
    }

    return attempt
  } catch (error) {
    clientLogger.error('Failed to get login attempts', { error })
    return {
      email,
      attempts: 0,
      lockoutUntil: null,
      lastAttempt: 0
    }
  }
}

/**
 * Save login attempts for an email
 */
function saveAttempts(attempt: LoginAttempt): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    const allAttempts: Record<string, LoginAttempt> = stored ? JSON.parse(stored) : {}

    allAttempts[attempt.email.toLowerCase()] = attempt
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allAttempts))
  } catch (error) {
    clientLogger.error('Failed to save login attempts', { error })
  }
}

/**
 * Clear login attempts for an email (call on successful login)
 */
export function clearLoginAttempts(email: string): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return

    const allAttempts: Record<string, LoginAttempt> = JSON.parse(stored)
    delete allAttempts[email.toLowerCase()]

    if (Object.keys(allAttempts).length === 0) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allAttempts))
    }

    clientLogger.info('Login attempts cleared', { email })
  } catch (error) {
    clientLogger.error('Failed to clear login attempts', { error })
  }
}

/**
 * Check if user is currently locked out
 */
export function isLockedOut(email: string): { locked: boolean; remainingTime: number } {
  const attempt = getAttempts(email)

  if (!attempt.lockoutUntil) {
    return { locked: false, remainingTime: 0 }
  }

  const remainingTime = attempt.lockoutUntil - Date.now()

  if (remainingTime <= 0) {
    // Lockout expired, clear it
    clearLoginAttempts(email)
    return { locked: false, remainingTime: 0 }
  }

  return { locked: true, remainingTime }
}

/**
 * Record a failed login attempt
 */
export function recordFailedAttempt(email: string): {
  attempts: number
  remainingAttempts: number
  isLocked: boolean
  lockoutUntil: number | null
} {
  const attempt = getAttempts(email)
  const newAttempts = attempt.attempts + 1

  const isLocked = newAttempts >= MAX_ATTEMPTS
  const lockoutUntil = isLocked ? Date.now() + LOCKOUT_DURATION : null

  const updated: LoginAttempt = {
    email,
    attempts: newAttempts,
    lockoutUntil,
    lastAttempt: Date.now()
  }

  saveAttempts(updated)

  clientLogger.warn('Failed login attempt recorded', {
    email,
    attempts: newAttempts,
    isLocked
  })

  return {
    attempts: newAttempts,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - newAttempts),
    isLocked,
    lockoutUntil
  }
}

/**
 * Get remaining attempts for an email
 */
export function getRemainingAttempts(email: string): number {
  const attempt = getAttempts(email)
  return Math.max(0, MAX_ATTEMPTS - attempt.attempts)
}

/**
 * React hook for rate limiting
 */
export function useLoginRateLimit(email: string) {
  const [locked, setLocked] = React.useState(false)
  const [remainingTime, setRemainingTime] = React.useState(0)
  const [attempts, setAttempts] = React.useState(0)

  React.useEffect(() => {
    if (!email) return

    const { locked, remainingTime } = isLockedOut(email)
    setLocked(locked)
    setRemainingTime(remainingTime)

    const attempt = getAttempts(email)
    setAttempts(attempt.attempts)

    // Update countdown if locked
    if (locked) {
      const interval = setInterval(() => {
        const { locked: stillLocked, remainingTime: newRemaining } = isLockedOut(email)
        setLocked(stillLocked)
        setRemainingTime(newRemaining)

        if (!stillLocked) {
          clearInterval(interval)
          setAttempts(0)
        }
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [email])

  const recordFailed = React.useCallback(() => {
    const result = recordFailedAttempt(email)
    setAttempts(result.attempts)
    setLocked(result.isLocked)
    if (result.lockoutUntil) {
      setRemainingTime(result.lockoutUntil - Date.now())
    }
    return result
  }, [email])

  const clearAttempts = React.useCallback(() => {
    clearLoginAttempts(email)
    setAttempts(0)
    setLocked(false)
    setRemainingTime(0)
  }, [email])

  const remainingAttempts = Math.max(0, MAX_ATTEMPTS - attempts)

  return {
    isLocked: locked,
    remainingTime,
    attempts,
    remainingAttempts,
    recordFailed,
    clearAttempts
  }
}
