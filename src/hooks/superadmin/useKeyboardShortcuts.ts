'use client'

/**
 * E17: Keyboard Shortcuts for SuperAdmin Power Users
 * Ctrl+K: Global search, J/K: Navigate items, Esc: Close modals
 */

import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface ShortcutConfig {
  /** Enable/disable shortcuts */
  enabled?: boolean
  /** Callback when Ctrl+K is pressed (global search) */
  onSearch?: () => void
  /** Callback when Escape is pressed */
  onEscape?: () => void
}

export function useKeyboardShortcuts(config: ShortcutConfig = {}) {
  const { enabled = true, onSearch, onEscape } = config
  const router = useRouter()

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return

      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        // Only handle Escape in inputs
        if (event.key === 'Escape' && onEscape) {
          onEscape()
        }
        return
      }

      // Ctrl+K or Cmd+K: Global search
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault()
        onSearch?.()
      }

      // Escape: Close modal/dialog
      if (event.key === 'Escape') {
        onEscape?.()
      }

      // Alt+D: Go to dashboard
      if (event.altKey && event.key === 'd') {
        event.preventDefault()
        router.push('/superadmin')
      }

      // Alt+L: Go to leads
      if (event.altKey && event.key === 'l') {
        event.preventDefault()
        router.push('/superadmin/unified-crm')
      }

      // Alt+P: Go to payouts
      if (event.altKey && event.key === 'p') {
        event.preventDefault()
        router.push('/superadmin/payout-management')
      }

      // Alt+E: Go to employees
      if (event.altKey && event.key === 'e') {
        event.preventDefault()
        router.push('/superadmin/employee-management')
      }

      // Alt+R: Go to realtime feed
      if (event.altKey && event.key === 'r') {
        event.preventDefault()
        router.push('/superadmin/realtime-feed')
      }

      // ? : Show keyboard shortcuts help (when not in input)
      if (event.key === '?' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault()
        // Dispatch custom event for shortcuts panel
        window.dispatchEvent(new CustomEvent('show-keyboard-shortcuts'))
      }
    },
    [enabled, onSearch, onEscape, router]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

/**
 * Keyboard shortcuts reference for help panel
 */
export const KEYBOARD_SHORTCUTS = [
  { keys: ['Ctrl', 'K'], description: 'Global Search' },
  { keys: ['Esc'], description: 'Close Modal / Cancel' },
  { keys: ['Alt', 'D'], description: 'Go to Dashboard' },
  { keys: ['Alt', 'L'], description: 'Go to Leads' },
  { keys: ['Alt', 'P'], description: 'Go to Payouts' },
  { keys: ['Alt', 'E'], description: 'Go to Employees' },
  { keys: ['Alt', 'R'], description: 'Go to Activity Feed' },
  { keys: ['?'], description: 'Show Keyboard Shortcuts' },
] as const
