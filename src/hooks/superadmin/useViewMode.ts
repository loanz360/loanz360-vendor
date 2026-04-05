'use client'

/**
 * E16: Persisted View Mode Hook
 * Stores user's view preference (cards/dashboard) in localStorage
 */

import { useState, useEffect, useCallback } from 'react'

type ViewMode = 'cards' | 'dashboard'

/**
 * Hook to persist view mode preference across page reloads
 * @param key - Unique key for this page's view mode
 * @param defaultMode - Default view mode if no preference saved
 */
export function useViewMode(key: string, defaultMode: ViewMode = 'cards') {
  const storageKey = `superadmin_viewMode_${key}`
  const [viewMode, setViewModeState] = useState<ViewMode>(defaultMode)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load saved preference on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey) as ViewMode | null
      if (saved === 'cards' || saved === 'dashboard') {
        setViewModeState(saved)
      }
    } catch {
      // localStorage not available
    }
    setIsLoaded(true)
  }, [storageKey])

  // Update both state and localStorage
  const setViewMode = useCallback(
    (mode: ViewMode) => {
      setViewModeState(mode)
      try {
        localStorage.setItem(storageKey, mode)
      } catch {
        // localStorage not available
      }
    },
    [storageKey]
  )

  const toggleViewMode = useCallback(() => {
    setViewMode(viewMode === 'cards' ? 'dashboard' : 'cards')
  }, [viewMode, setViewMode])

  return { viewMode, setViewMode, toggleViewMode, isLoaded }
}
