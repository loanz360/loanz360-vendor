'use client'

import { useState, useEffect, useRef } from 'react'
import { clientLogger } from '@/lib/utils/client-logger'

interface UsePageLoadTimeoutOptions {
  timeoutMs?: number
  pageName?: string
}

export function usePageLoadTimeout(options: UsePageLoadTimeoutOptions = {}) {
  const { timeoutMs = 10000, pageName = 'Page' } = options
  const [isLoading, setIsLoading] = useState(true)
  const [hasTimedOut, setHasTimedOut] = useState(false)
  const loadingRef = useRef(true)

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loadingRef.current) {
        clientLogger.warn(`${pageName} load timeout after ${timeoutMs}ms - displaying with available data`)
        setIsLoading(false)
        setHasTimedOut(true)
        loadingRef.current = false
      }
    }, timeoutMs)

    return () => clearTimeout(timeout)
  }, [timeoutMs, pageName])

  const finishLoading = () => {
    setIsLoading(false)
    loadingRef.current = false
  }

  const startLoading = () => {
    setIsLoading(true)
    loadingRef.current = true
    setHasTimedOut(false)
  }

  return { isLoading, hasTimedOut, finishLoading, startLoading }
}
