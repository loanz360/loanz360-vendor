'use client'

import { useCallback, useEffect, useRef, useState, useMemo } from 'react'

// ============================================================================
// Performance Monitoring Hook
// ============================================================================

interface PerformanceMetrics {
  fcp: number | null // First Contentful Paint
  lcp: number | null // Largest Contentful Paint
  fid: number | null // First Input Delay
  cls: number | null // Cumulative Layout Shift
  ttfb: number | null // Time to First Byte
  domLoad: number | null
  pageLoad: number | null
}

export function usePerformanceMetrics(): PerformanceMetrics {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fcp: null,
    lcp: null,
    fid: null,
    cls: null,
    ttfb: null,
    domLoad: null,
    pageLoad: null
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Get navigation timing
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    if (navigation) {
      setMetrics(prev => ({
        ...prev,
        ttfb: navigation.responseStart - navigation.requestStart,
        domLoad: navigation.domContentLoadedEventEnd - navigation.startTime,
        pageLoad: navigation.loadEventEnd - navigation.startTime
      }))
    }

    // Observe paint entries
    const paintObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          setMetrics(prev => ({ ...prev, fcp: entry.startTime }))
        }
      }
    })

    // Observe LCP
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries()
      const lastEntry = entries[entries.length - 1]
      setMetrics(prev => ({ ...prev, lcp: lastEntry.startTime }))
    })

    // Observe FID
    const fidObserver = new PerformanceObserver((entryList) => {
      const firstEntry = entryList.getEntries()[0] as PerformanceEventTiming
      setMetrics(prev => ({ ...prev, fid: firstEntry.processingStart - firstEntry.startTime }))
    })

    // Observe CLS
    let clsValue = 0
    const clsObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries() as any[]) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value
          setMetrics(prev => ({ ...prev, cls: clsValue }))
        }
      }
    })

    try {
      paintObserver.observe({ type: 'paint', buffered: true })
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })
      fidObserver.observe({ type: 'first-input', buffered: true })
      clsObserver.observe({ type: 'layout-shift', buffered: true })
    } catch (e) {
      // Some browsers don't support all metrics
    }

    return () => {
      paintObserver.disconnect()
      lcpObserver.disconnect()
      fidObserver.disconnect()
      clsObserver.disconnect()
    }
  }, [])

  return metrics
}

// ============================================================================
// Virtualized List Hook (for large lists)
// ============================================================================

interface VirtualizedListOptions {
  itemHeight: number
  overscan?: number
  containerHeight: number
}

export function useVirtualizedList<T>(
  items: T[],
  options: VirtualizedListOptions
) {
  const { itemHeight, overscan = 3, containerHeight } = options
  const [scrollTop, setScrollTop] = useState(0)

  const visibleCount = Math.ceil(containerHeight / itemHeight)
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const endIndex = Math.min(items.length, startIndex + visibleCount + overscan * 2)

  const visibleItems = useMemo(
    () => items.slice(startIndex, endIndex).map((item, index) => ({
      item,
      index: startIndex + index,
      style: {
        position: 'absolute' as const,
        top: (startIndex + index) * itemHeight,
        height: itemHeight,
        left: 0,
        right: 0
      }
    })),
    [items, startIndex, endIndex, itemHeight]
  )

  const totalHeight = items.length * itemHeight

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  return {
    visibleItems,
    totalHeight,
    handleScroll,
    containerStyle: {
      overflow: 'auto',
      height: containerHeight,
      position: 'relative' as const
    },
    innerStyle: {
      height: totalHeight,
      position: 'relative' as const
    }
  }
}

// ============================================================================
// Intersection Observer Hook (Lazy Loading)
// ============================================================================

interface UseIntersectionObserverOptions {
  threshold?: number | number[]
  root?: Element | null
  rootMargin?: string
  freezeOnceVisible?: boolean
}

export function useIntersectionObserver(
  options: UseIntersectionObserverOptions = {}
): [React.RefObject<HTMLDivElement>, boolean] {
  const { threshold = 0, root = null, rootMargin = '0px', freezeOnceVisible = false } = options
  const elementRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const frozen = useRef(false)

  useEffect(() => {
    const element = elementRef.current
    if (!element || (frozen.current && freezeOnceVisible)) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isElementVisible = entry.isIntersecting
        setIsVisible(isElementVisible)

        if (isElementVisible && freezeOnceVisible) {
          frozen.current = true
          observer.disconnect()
        }
      },
      { threshold, root, rootMargin }
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [threshold, root, rootMargin, freezeOnceVisible])

  return [elementRef, isVisible]
}

// ============================================================================
// Request Animation Frame Throttle
// ============================================================================

export function useRAFThrottle<T extends (...args: any[]) => void>(
  callback: T
): T {
  const rafId = useRef<number | null>(null)
  const lastArgs = useRef<Parameters<T> | null>(null)

  const throttledFn = useCallback(
    (...args: Parameters<T>) => {
      lastArgs.current = args

      if (rafId.current === null) {
        rafId.current = requestAnimationFrame(() => {
          callback(...(lastArgs.current as Parameters<T>))
          rafId.current = null
        })
      }
    },
    [callback]
  ) as T

  useEffect(() => {
    return () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current)
      }
    }
  }, [])

  return throttledFn
}

// ============================================================================
// Memory-Optimized State Hook
// ============================================================================

interface UseOptimizedStateOptions<T> {
  maxHistoryLength?: number
  debounceMs?: number
}

export function useOptimizedState<T>(
  initialValue: T,
  options: UseOptimizedStateOptions<T> = {}
): [T, (value: T | ((prev: T) => T)) => void, { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean }] {
  const { maxHistoryLength = 10, debounceMs = 0 } = options
  const [state, setState] = useState(initialValue)
  const historyRef = useRef<T[]>([initialValue])
  const indexRef = useRef(0)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const setStateWithHistory = useCallback((value: T | ((prev: T) => T)) => {
    const updateState = () => {
      setState(prev => {
        const newValue = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value

        // Add to history
        const newHistory = historyRef.current.slice(0, indexRef.current + 1)
        newHistory.push(newValue)

        // Trim history if needed
        if (newHistory.length > maxHistoryLength) {
          newHistory.shift()
        } else {
          indexRef.current++
        }

        historyRef.current = newHistory
        return newValue
      })
    }

    if (debounceMs > 0) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(updateState, debounceMs)
    } else {
      updateState()
    }
  }, [maxHistoryLength, debounceMs])

  const undo = useCallback(() => {
    if (indexRef.current > 0) {
      indexRef.current--
      setState(historyRef.current[indexRef.current])
    }
  }, [])

  const redo = useCallback(() => {
    if (indexRef.current < historyRef.current.length - 1) {
      indexRef.current++
      setState(historyRef.current[indexRef.current])
    }
  }, [])

  const canUndo = indexRef.current > 0
  const canRedo = indexRef.current < historyRef.current.length - 1

  return [state, setStateWithHistory, { undo, redo, canUndo, canRedo }]
}

// ============================================================================
// Prefetch Hook
// ============================================================================

const prefetchCache = new Map<string, Promise<any>>()

export function usePrefetch() {
  const prefetch = useCallback(async (url: string, options?: RequestInit) => {
    if (prefetchCache.has(url)) {
      return prefetchCache.get(url)
    }

    const promise = fetch(url, {
      ...options,
      priority: 'low' as any
    }).then(res => res.json())

    prefetchCache.set(url, promise)

    // Clean up after 5 minutes
    setTimeout(() => prefetchCache.delete(url), 5 * 60 * 1000)

    return promise
  }, [])

  const prefetchOnHover = useCallback((url: string) => {
    return {
      onMouseEnter: () => prefetch(url),
      onFocus: () => prefetch(url)
    }
  }, [prefetch])

  return { prefetch, prefetchOnHover }
}

// ============================================================================
// Image Preload Hook
// ============================================================================

export function useImagePreload(src: string): { loaded: boolean; error: boolean } {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!src) return

    const img = new Image()
    img.src = src

    img.onload = () => {
      setLoaded(true)
      setError(false)
    }

    img.onerror = () => {
      setLoaded(false)
      setError(true)
    }

    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [src])

  return { loaded, error }
}

// ============================================================================
// Reduced Motion Hook
// ============================================================================

export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mediaQuery.matches)

    const handler = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches)
    }

    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  return reducedMotion
}

// ============================================================================
// Memory Pressure Hook
// ============================================================================

export function useMemoryPressure(): 'low' | 'moderate' | 'critical' | null {
  const [pressure, setPressure] = useState<'low' | 'moderate' | 'critical' | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !('memory' in performance)) return

    const checkMemory = () => {
      const memory = (performance as any).memory
      if (!memory) return

      const usedRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit

      if (usedRatio > 0.9) {
        setPressure('critical')
      } else if (usedRatio > 0.7) {
        setPressure('moderate')
      } else {
        setPressure('low')
      }
    }

    checkMemory()
    const interval = setInterval(checkMemory, 10000)

    return () => clearInterval(interval)
  }, [])

  return pressure
}

// ============================================================================
// Network Status Hook
// ============================================================================

interface NetworkStatus {
  online: boolean
  effectiveType: '4g' | '3g' | '2g' | 'slow-2g' | null
  downlink: number | null
  rtt: number | null
  saveData: boolean
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    effectiveType: null,
    downlink: null,
    rtt: null,
    saveData: false
  })

  useEffect(() => {
    const updateStatus = () => {
      const connection = (navigator as any).connection

      setStatus({
        online: navigator.onLine,
        effectiveType: connection?.effectiveType || null,
        downlink: connection?.downlink || null,
        rtt: connection?.rtt || null,
        saveData: connection?.saveData || false
      })
    }

    updateStatus()

    window.addEventListener('online', updateStatus)
    window.addEventListener('offline', updateStatus)

    const connection = (navigator as any).connection
    if (connection) {
      connection.addEventListener('change', updateStatus)
    }

    return () => {
      window.removeEventListener('online', updateStatus)
      window.removeEventListener('offline', updateStatus)

      if (connection) {
        connection.removeEventListener('change', updateStatus)
      }
    }
  }, [])

  return status
}

// ============================================================================
// Idle Callback Hook
// ============================================================================

export function useIdleCallback(
  callback: () => void,
  options?: { timeout?: number }
): void {
  useEffect(() => {
    if (typeof window === 'undefined') return

    let handle: number

    if ('requestIdleCallback' in window) {
      handle = (window as any).requestIdleCallback(callback, options)
      return () => (window as any).cancelIdleCallback(handle)
    } else {
      // Fallback for browsers without requestIdleCallback
      handle = window.setTimeout(callback, 1)
      return () => window.clearTimeout(handle)
    }
  }, [callback, options])
}
