import { useEffect, useCallback } from 'react'

type KeyCombo = {
  key: string
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
}

export function useKeyboardShortcut(
  combo: KeyCombo,
  callback: () => void,
  enabled: boolean = true
) {
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
        // Allow Escape in inputs
        if (event.key !== 'Escape') return
      }

      const matchesKey = event.key === combo.key || event.key === combo.key.toLowerCase()
      const matchesCtrl = combo.ctrlKey ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey
      const matchesShift = combo.shiftKey ? event.shiftKey : !event.shiftKey
      const matchesAlt = combo.altKey ? event.altKey : !event.altKey

      if (matchesKey && matchesCtrl && matchesShift && matchesAlt) {
        event.preventDefault()
        callback()
      }
    },
    [combo, callback, enabled]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
