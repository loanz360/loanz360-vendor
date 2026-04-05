'use client'

import { useEffect, useCallback, useRef } from 'react'

interface Shortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  description: string
  handler: () => void
  /** Only active on specific pages */
  scope?: string
}

interface UseKeyboardShortcutsOptions {
  shortcuts: Shortcut[]
  enabled?: boolean
  scope?: string
}

export function useKeyboardShortcuts({ shortcuts, enabled = true, scope }: UseKeyboardShortcutsOptions) {
  const shortcutsRef = useRef(shortcuts)
  shortcutsRef.current = shortcuts

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) {
      return
    }

    for (const shortcut of shortcutsRef.current) {
      if (scope && shortcut.scope && shortcut.scope !== scope) continue

      const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey)
      const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey
      const altMatch = shortcut.alt ? e.altKey : !e.altKey
      const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase()

      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        e.preventDefault()
        shortcut.handler()
        break
      }
    }
  }, [scope])

  useEffect(() => {
    if (!enabled) return
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, handleKeyDown])
}

// Pre-defined shortcut sets
export const HR_SHORTCUTS = {
  SEARCH: { key: '/', ctrl: false, description: 'Focus search' },
  NEW: { key: 'n', ctrl: true, description: 'Create new item' },
  SAVE: { key: 's', ctrl: true, description: 'Save changes' },
  EXPORT: { key: 'e', ctrl: true, shift: true, description: 'Export data' },
  REFRESH: { key: 'r', ctrl: true, shift: true, description: 'Refresh data' },
  ESCAPE: { key: 'Escape', description: 'Close modal / Cancel' },
  HELP: { key: '?', shift: true, description: 'Show shortcuts help' },
}
