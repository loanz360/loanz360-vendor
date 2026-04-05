'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// ─── Route definitions ───────────────────────────────────────────────
const CRO_ROUTES = {
  d: '/employees/cro',
  c: '/employees/cro/ai-crm/contacts',
  l: '/employees/cro/ai-crm/leads',
  e: '/employees/cro/ai-crm/deals',
  f: '/employees/cro/followups-v2',
  p: '/employees/cro/performance',
  a: '/employees/cro/ai-crm/analytics',
} as const

// ─── Shortcut metadata (for help panel rendering) ────────────────────
export interface ShortcutEntry {
  keys: string
  description: string
  category: 'navigation' | 'action' | 'search' | 'general'
}

export const CRO_SHORTCUTS: ShortcutEntry[] = [
  // Navigation
  { keys: 'g d', description: 'Go to Dashboard', category: 'navigation' },
  { keys: 'g c', description: 'Go to Contacts', category: 'navigation' },
  { keys: 'g l', description: 'Go to Leads', category: 'navigation' },
  { keys: 'g e', description: 'Go to Deals', category: 'navigation' },
  { keys: 'g f', description: 'Go to Follow-ups', category: 'navigation' },
  { keys: 'g p', description: 'Go to Performance', category: 'navigation' },
  { keys: 'g a', description: 'Go to Analytics', category: 'navigation' },
  // Actions
  { keys: 'n c', description: 'New Contact', category: 'action' },
  { keys: 'n l', description: 'New Lead', category: 'action' },
  { keys: 'n f', description: 'New Follow-up', category: 'action' },
  // Search
  { keys: '/', description: 'Focus global search', category: 'search' },
  { keys: 'Escape', description: 'Close modals / panels', category: 'search' },
  // General
  { keys: '?', description: 'Show shortcuts help', category: 'general' },
]

// ─── Types ───────────────────────────────────────────────────────────
export interface UseCROKeyboardShortcutsOptions {
  onNewContact?: () => void
  onNewLead?: () => void
  onNewFollowup?: () => void
  onFocusSearch?: () => void
  onEscape?: () => void
  enabled?: boolean
}

export interface UseCROKeyboardShortcutsReturn {
  showHelp: boolean
  setShowHelp: (show: boolean) => void
  pendingChord: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────
const CHORD_TIMEOUT_MS = 500

/**
 * Returns true when the keyboard event target is an interactive element
 * where normal typing should not trigger shortcuts.
 */
function isEditableTarget(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null
  if (!target) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  )
}

// ─── Hook ────────────────────────────────────────────────────────────
export function useCROKeyboardShortcuts(
  options: UseCROKeyboardShortcutsOptions = {}
): UseCROKeyboardShortcutsReturn {
  const {
    onNewContact,
    onNewLead,
    onNewFollowup,
    onFocusSearch,
    onEscape,
    enabled = true,
  } = options

  const router = useRouter()

  // State
  const [showHelp, setShowHelp] = useState(false)
  const [pendingChord, setPendingChord] = useState<string | null>(null)

  // Refs to keep callbacks fresh without re-subscribing the event listener
  const optionsRef = useRef(options)
  optionsRef.current = options

  const pendingChordRef = useRef<string | null>(null)
  const chordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Clear any pending chord ──────────────────────────────────────
  const clearChord = useCallback(() => {
    if (chordTimerRef.current) {
      clearTimeout(chordTimerRef.current)
      chordTimerRef.current = null
    }
    pendingChordRef.current = null
    setPendingChord(null)
  }, [])

  // ── Start a chord sequence ───────────────────────────────────────
  const startChord = useCallback(
    (firstKey: string) => {
      pendingChordRef.current = firstKey
      setPendingChord(firstKey)

      // Auto-expire after timeout
      chordTimerRef.current = setTimeout(() => {
        pendingChordRef.current = null
        setPendingChord(null)
        chordTimerRef.current = null
      }, CHORD_TIMEOUT_MS)
    },
    []
  )

  // ── Main keydown handler ─────────────────────────────────────────
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return

      // Ignore modifier-only presses
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return

      const inEditable = isEditableTarget(event)
      const key = event.key

      // ── Escape is always handled (even inside inputs) ────────────
      if (key === 'Escape') {
        // If help panel is open, close it first
        if (showHelp) {
          setShowHelp(false)
          event.preventDefault()
          return
        }
        // If a chord is pending, cancel it
        if (pendingChordRef.current) {
          clearChord()
          event.preventDefault()
          return
        }
        // Delegate to consumer
        optionsRef.current.onEscape?.()
        return
      }

      // All other shortcuts are suppressed inside editable elements
      if (inEditable) return

      // Ignore if any modifier key (Ctrl/Meta/Alt) is held —
      // we only use plain keys and Shift (for '?')
      if (event.ctrlKey || event.metaKey || event.altKey) return

      // ── Second key of a chord ────────────────────────────────────
      const pending = pendingChordRef.current
      if (pending) {
        event.preventDefault()
        clearChord()

        if (pending === 'g') {
          const route = CRO_ROUTES[key as keyof typeof CRO_ROUTES]
          if (route) {
            router.push(route)
          }
          return
        }

        if (pending === 'n') {
          switch (key) {
            case 'c':
              optionsRef.current.onNewContact?.()
              return
            case 'l':
              optionsRef.current.onNewLead?.()
              return
            case 'f':
              optionsRef.current.onNewFollowup?.()
              return
          }
          return
        }

        // Unknown chord — just fall through
        return
      }

      // ── Single-key shortcuts ─────────────────────────────────────

      // '?' (Shift + /) — toggle help panel
      if (key === '?' && event.shiftKey) {
        event.preventDefault()
        setShowHelp((prev) => !prev)
        return
      }

      // '/' — focus search
      if (key === '/') {
        event.preventDefault()
        optionsRef.current.onFocusSearch?.()
        return
      }

      // ── Chord starters ──────────────────────────────────────────
      if (key === 'g' || key === 'n') {
        event.preventDefault()
        startChord(key)
        return
      }
    },
    [enabled, showHelp, router, clearChord, startChord]
  )

  // ── Attach / detach listener ─────────────────────────────────────
  useEffect(() => {
    if (!enabled) {
      clearChord()
      return
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      clearChord()
    }
  }, [enabled, handleKeyDown, clearChord])

  return {
    showHelp,
    setShowHelp,
    pendingChord,
  }
}

export default useCROKeyboardShortcuts
