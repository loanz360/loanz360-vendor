/**
 * Unified Dashboard Loading Hook
 *
 * Coordinates multiple loading states across a dashboard to ensure
 * all components load together and display simultaneously.
 *
 * Usage:
 * ```tsx
 * const { isLoading, registerLoader, unregisterLoader } = useDashboardLoader({
 *   minimumLoadTime: 800,
 *   authLoading: true
 * })
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react'

interface DashboardLoaderOptions {
  /** Minimum time to show loading state (prevents flash) */
  minimumLoadTime?: number
  /** Authentication loading state */
  authLoading?: boolean
  /** Additional loading states to wait for */
  additionalLoaders?: boolean[]
}

interface DashboardLoaderReturn {
  /** Overall loading state - true if ANY loader is pending */
  isLoading: boolean
  /** Register a new loader (returns unregister function) */
  registerLoader: (id: string) => () => void
  /** Manually unregister a loader */
  unregisterLoader: (id: string) => void
  /** Check if a specific loader is active */
  isLoaderActive: (id: string) => boolean
}

export function useDashboardLoader(options: DashboardLoaderOptions = {}): DashboardLoaderReturn {
  const {
    minimumLoadTime = 0, // REMOVED ARTIFICIAL DELAY - Show content immediately when ready
    authLoading = false,
    additionalLoaders = []
  } = options

  const [activeLoaders, setActiveLoaders] = useState<Set<string>>(new Set())
  const [minimumTimeElapsed, setMinimumTimeElapsed] = useState(true) // Start as true - no delay
  const mountTimeRef = useRef<number>(Date.now())

  // Start minimum time counter on mount (only if minimumLoadTime > 0)
  useEffect(() => {
    if (minimumLoadTime === 0) {
      setMinimumTimeElapsed(true)
      return
    }

    mountTimeRef.current = Date.now()
    setMinimumTimeElapsed(false)

    const timer = setTimeout(() => {
      setMinimumTimeElapsed(true)
    }, minimumLoadTime)

    return () => clearTimeout(timer)
  }, [minimumLoadTime])

  // Register a loader
  const registerLoader = useCallback((id: string) => {
    setActiveLoaders(prev => {
      const next = new Set(prev)
      next.add(id)
      return next
    })

    // Return unregister function
    return () => {
      setActiveLoaders(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }, [])

  // Manually unregister a loader
  const unregisterLoader = useCallback((id: string) => {
    setActiveLoaders(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  // Check if a specific loader is active
  const isLoaderActive = useCallback((id: string) => {
    return activeLoaders.has(id)
  }, [activeLoaders])

  // Calculate overall loading state
  const isLoading =
    !minimumTimeElapsed ||  // Minimum time hasn't passed
    authLoading ||           // Auth is still loading
    activeLoaders.size > 0 || // Active loaders exist
    additionalLoaders.some(loader => loader === true) // Any additional loader is true

  return {
    isLoading,
    registerLoader,
    unregisterLoader,
    isLoaderActive
  }
}

/**
 * Hook to register a component's loading state with the dashboard loader
 *
 * Usage:
 * ```tsx
 * const { isLoading } = useDashboardLoader({ authLoading })
 * useComponentLoader(isLoading, registerLoader, 'banner-carousel', bannerLoading)
 * ```
 */
export function useComponentLoader(
  shouldRegister: boolean,
  registerLoader: (id: string) => () => void,
  componentId: string,
  componentLoading: boolean
) {
  useEffect(() => {
    if (!shouldRegister) return

    if (componentLoading) {
      const unregister = registerLoader(componentId)
      return unregister
    }
  }, [shouldRegister, registerLoader, componentId, componentLoading])
}
